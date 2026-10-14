import { describe, expect, it } from "vitest"
import {
  workerFromRow,
  workerToRow,
  workerProjectAssignmentFromRow,
  workerOnboardingFromRow,
  workerOnboardingToRow,
  taskFromRow,
  taskAssignmentFromRow,
  workPlanItemFromRow,
  dailyProgressFromRow,
  progressReviewFromRow,
  progressPublicationFromRow,
  evidenceFromRow,
  documentFromRow,
  issueFromRow,
  threadFromRow,
  messageFromRow,
  threadReadFromRow,
  callLogFromRow,
  estimateFromRow,
  marketplaceRequirementFromRow,
  marketplaceRequirementFromPreviewRow,
  marketplaceUnlockFromRow,
  proposalFromRow,
  planFromRow,
  subscriptionFromRow,
  creditWalletFromRow,
  creditTransactionFromRow,
} from "./rows"

describe("worker row mapping", () => {
  it("maps a worker row to a Worker with languages and tradeIds arrays", () => {
    const worker = workerFromRow({
      id: "11111111-1111-1111-1111-111111111111",
      legacy_id: "worker-2",
      organization_id: "org-uuid",
      user_id: "person-uuid",
      phone: "+919000011122",
      name: "Ravi Naik",
      trade_ids: ["trade-civil"],
      languages: ["hi", "en"],
      onboarding_method: "otp",
      status: "active",
    })
    expect(worker).toEqual({
      id: "worker-2",
      organizationId: "org-uuid",
      userId: "person-uuid",
      phone: "+919000011122",
      name: "Ravi Naik",
      tradeIds: ["trade-civil"],
      languages: ["hi", "en"],
      onboardingMethod: "otp",
      status: "active",
    })
  })

  it("round-trips every Worker field through the row shape", () => {
    const worker = {
      id: "worker-9",
      organizationId: "org-buildright",
      userId: "person-ravi",
      name: "Meera Dsouza",
      phone: "+919000022233",
      tradeIds: ["trade-civil", "trade-tiling"],
      languages: ["kn", "en"],
      onboardingMethod: "qr" as const,
      status: "invited" as const,
    }
    expect(workerFromRow({ id: "row-uuid", ...workerToRow(worker) })).toEqual(worker)
  })
})

describe("assignment row mapping", () => {
  it("maps startedAt, endedAt and endReason", () => {
    const assignment = workerProjectAssignmentFromRow({
      id: "a-uuid",
      legacy_id: "assignment-1",
      project_id: "p-uuid",
      worker_id: "w-uuid",
      project_unit_ids: [],
      started_at: "2026-10-01T03:30:00Z",
      ended_at: "2026-10-05T12:00:00Z",
      end_reason: "reassigned",
      status: "inactive",
      created_at: "2026-09-30T10:00:00Z",
    })
    expect(assignment.startedAt).toBe("2026-10-01T03:30:00Z")
    expect(assignment.endedAt).toBe("2026-10-05T12:00:00Z")
    expect(assignment.endReason).toBe("reassigned")
    expect(assignment.status).toBe("inactive")
  })
})

describe("onboarding row mapping", () => {
  it("maps acceptedAt and expiresAt", () => {
    const onboarding = workerOnboardingFromRow({
      id: "o-uuid",
      legacy_id: "onboarding-1",
      worker_id: "w-uuid",
      organization_id: "org-uuid",
      method: "qr",
      status: "accepted",
      join_code: null,
      invited_at: "2026-10-01T00:00:00Z",
      accepted_at: "2026-10-02T09:00:00Z",
      expires_at: "2026-10-08T00:00:00Z",
    })
    expect(onboarding.acceptedAt).toBe("2026-10-02T09:00:00Z")
    expect(onboarding.expiresAt).toBe("2026-10-08T00:00:00Z")
    expect(onboarding.joinCode).toBeUndefined()
  })

  it("round-trips an onboarding through its row shape", () => {
    const onboarding = {
      id: "onboarding-7",
      workerId: "worker-7",
      organizationId: "org-buildright",
      method: "qr" as const,
      status: "invited" as const,
      joinCode: "482913",
      invitedAt: "2026-10-01T00:00:00Z",
      expiresAt: "2026-10-08T00:00:00Z",
    }
    expect(workerOnboardingFromRow({ id: "row-uuid", ...workerOnboardingToRow(onboarding) })).toEqual(onboarding)
  })
})

describe("task row mapping", () => {
  it("maps a task row, defaulting fields the schema does not store", () => {
    const task = taskFromRow({
      id: "t-uuid",
      legacy_id: "task-1",
      project_id: "p-uuid",
      work_plan_item_id: null,
      project_unit_id: "unit-uuid",
      stage_id: "stage-uuid",
      trade_id: "trade-uuid",
      work_type_id: "work-type-uuid",
      title: "Pour foundation",
      status: "in-progress",
      planned_quantity: 10,
      planned_quantity_unit: "m3",
      completed_quantity: 4,
      completed_quantity_unit: "m3",
      created_at: "2026-10-01T00:00:00Z",
    })
    expect(task).toEqual({
      id: "task-1",
      projectId: "p-uuid",
      projectUnitId: "unit-uuid",
      stageId: "stage-uuid",
      tradeId: "trade-uuid",
      workTypeId: "work-type-uuid",
      templateId: undefined,
      title: "Pour foundation",
      status: "in-progress",
      priority: "medium",
      plannedQuantity: { value: 10, unit: "m3" },
      completedQuantity: { value: 4, unit: "m3" },
      checklist: [],
      createdByMembershipId: "",
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
    })
  })

  it("maps a task assignment row as a worker assignment", () => {
    const assignment = taskAssignmentFromRow({
      id: "ta-uuid",
      legacy_id: "assignment-task-1",
      project_id: "p-uuid",
      task_id: "task-uuid",
      worker_id: "worker-uuid",
      assigned_at: "2026-10-01T00:00:00Z",
    })
    expect(assignment).toEqual({
      id: "assignment-task-1",
      taskId: "task-uuid",
      assigneeType: "worker",
      assigneeId: "worker-uuid",
      assignedByMembershipId: "",
      status: "assigned",
      assignedAt: "2026-10-01T00:00:00Z",
    })
  })
})

describe("work plan item row mapping", () => {
  it("maps a work plan item, defaulting the missing quantity to zero", () => {
    const item = workPlanItemFromRow({
      id: "wpi-uuid",
      legacy_id: "wpi-1",
      project_id: "p-uuid",
      project_unit_id: "unit-uuid",
      stage_id: "stage-uuid",
      trade_id: "trade-uuid",
      work_type_id: "worktype-uuid",
      title: "Block A flooring",
      planned_start: "2026-10-01",
      planned_end: "2026-10-15",
      status: "ready",
      created_at: "2026-09-20T00:00:00Z",
    })
    expect(item).toEqual({
      id: "wpi-1",
      projectId: "p-uuid",
      projectUnitId: "unit-uuid",
      stageId: "stage-uuid",
      tradeId: "trade-uuid",
      workTypeId: "worktype-uuid",
      plannedQuantity: { value: 0, unit: "nos" },
      plannedStart: "2026-10-01",
      dueDate: "2026-10-15",
      status: "ready",
      createdAt: "2026-09-20T00:00:00Z",
    })
  })
})

describe("daily progress row mapping", () => {
  const baseRow = {
    id: "dp-uuid",
    legacy_id: "progress-1",
    project_id: "p-uuid",
    project_unit_id: "unit-uuid",
    task_id: "task-uuid",
    stage_id: "stage-uuid",
    trade_id: "trade-uuid",
    work_type_id: "worktype-uuid",
    date: "2026-10-05",
    workers_present: 4,
    planned_quantity: 10,
    planned_quantity_unit: "m2",
    completed_quantity: 6,
    completed_quantity_unit: "m2",
    progress_before: 20,
    progress_after: 50,
    yesterday_summary: "Formwork done",
    today_summary: "Poured slab",
    tomorrow_plan: "Curing",
    blocker_summary: null,
    submitted_by_membership_id: "membership-uuid",
    submitted_at: "2026-10-05T18:00:00Z",
    review_status: "submitted",
    publication_status: "private",
    version: 1,
    supersedes_id: null,
    superseded_by_id: null,
    created_at: "2026-10-05T18:00:00Z",
  }

  it("maps version fields and quantities, with no review or publication yet", () => {
    const progress = dailyProgressFromRow(baseRow)
    expect(progress.version).toBe(1)
    expect(progress.supersedesId).toBeUndefined()
    expect(progress.supersededById).toBeUndefined()
    expect(progress.plannedQuantity).toEqual({ value: 10, unit: "m2" })
    expect(progress.completedQuantity).toEqual({ value: 6, unit: "m2" })
    expect(progress.review).toBeUndefined()
    expect(progress.publication).toBeUndefined()
  })

  it("maps a correction's supersedesId and version", () => {
    const progress = dailyProgressFromRow({
      ...baseRow,
      id: "dp-uuid-2",
      legacy_id: "progress-2",
      version: 2,
      supersedes_id: "dp-uuid",
    })
    expect(progress.version).toBe(2)
    expect(progress.supersedesId).toBe("dp-uuid")
  })

  it("attaches a review built from a progress_reviews row", () => {
    const review = progressReviewFromRow({
      id: "review-uuid",
      legacy_id: "review-1",
      daily_progress_id: "dp-uuid",
      decision: "approve",
      note: null,
      reviewer_membership_id: "reviewer-uuid",
      reviewed_at: "2026-10-06T09:00:00Z",
    })
    expect(review).toEqual({
      decision: "approve",
      note: undefined,
      reviewedByMembershipId: "reviewer-uuid",
      reviewedAt: "2026-10-06T09:00:00Z",
    })
    const progress = dailyProgressFromRow(baseRow, undefined, review)
    expect(progress.review).toEqual(review)
  })

  it("attaches a publication built from a progress_publications row and the shared evidence ids", () => {
    const publication = progressPublicationFromRow(
      {
        id: "pub-uuid",
        legacy_id: "pub-1",
        daily_progress_id: "dp-uuid",
        published_by_membership_id: "publisher-uuid",
        published_at: "2026-10-07T09:00:00Z",
      },
      ["evidence-1", "evidence-2"],
    )
    expect(publication).toEqual({
      publishedByMembershipId: "publisher-uuid",
      publishedAt: "2026-10-07T09:00:00Z",
      evidenceIds: ["evidence-1", "evidence-2"],
    })
    const progress = dailyProgressFromRow(baseRow, undefined, undefined, publication)
    expect(progress.publication).toEqual(publication)
  })
})

describe("evidence and document row mapping", () => {
  it("maps an evidence row", () => {
    const evidence = evidenceFromRow({
      id: "ev-uuid",
      legacy_id: "evidence-1",
      project_id: "p-uuid",
      project_unit_id: "unit-uuid",
      task_id: "task-uuid",
      daily_progress_id: "dp-uuid",
      issue_id: null,
      type: "photo",
      url: "https://example.com/photo.jpg",
      thumbnail_url: null,
      caption: "Slab poured",
      captured_by_membership_id: "membership-uuid",
      captured_by_worker_id: null,
      captured_at: "2026-10-05T18:05:00Z",
      customer_visibility: "private",
    })
    expect(evidence).toEqual({
      id: "evidence-1",
      projectId: "p-uuid",
      projectUnitId: "unit-uuid",
      taskId: "task-uuid",
      dailyProgressId: "dp-uuid",
      type: "photo",
      url: "https://example.com/photo.jpg",
      thumbnailUrl: undefined,
      caption: "Slab poured",
      capturedByMembershipId: "membership-uuid",
      capturedByWorkerId: undefined,
      capturedAt: "2026-10-05T18:05:00Z",
      customerVisibility: "private",
    })
  })

  it("maps a document row's shared_with_homeowner flag to customerVisibility", () => {
    const shared = documentFromRow({
      id: "doc-uuid",
      legacy_id: "document-1",
      project_id: "p-uuid",
      title: "Approval letter",
      category: "approval",
      url: "https://example.com/doc.pdf",
      uploaded_by_membership_id: "membership-uuid",
      shared_with_homeowner: true,
      created_at: "2026-10-01T00:00:00Z",
    })
    expect(shared.customerVisibility).toBe("customer-visible")

    const privateDoc = documentFromRow({
      id: "doc-uuid-2",
      legacy_id: "document-2",
      project_id: "p-uuid",
      title: "Internal contract",
      category: "contract",
      url: "https://example.com/doc2.pdf",
      uploaded_by_membership_id: null,
      shared_with_homeowner: false,
      created_at: "2026-10-01T00:00:00Z",
    })
    expect(privateDoc.customerVisibility).toBe("private")
    expect(privateDoc.uploadedByMembershipId).toBe("")
  })
})

describe("issue row mapping", () => {
  it("maps an issue row's customer_visible flag and defaults evidenceIds to []", () => {
    const issue = issueFromRow({
      id: "issue-uuid",
      legacy_id: "issue-1",
      project_id: "p-uuid",
      project_unit_id: "unit-uuid",
      stage_id: null,
      trade_id: null,
      task_id: "task-uuid",
      daily_progress_id: null,
      title: "Cracked tile",
      description: "Tile cracked during transit",
      severity: "medium",
      status: "open",
      assigned_membership_id: "membership-uuid",
      customer_visible: false,
      created_by_membership_id: "creator-uuid",
      created_at: "2026-10-01T00:00:00Z",
      updated_at: null,
      resolved_at: null,
      resolution_note: null,
      closed_at: null,
    })
    expect(issue.evidenceIds).toEqual([])
    expect(issue.customerVisibility).toBe("private")
    expect(issue.createdByMembershipId).toBe("creator-uuid")
  })
})

describe("thread, message, thread-read and call-log row mapping", () => {
  it("maps a thread row's participant ids", () => {
    const thread = threadFromRow({
      id: "thread-uuid",
      legacy_id: "thread-1",
      project_id: "p-uuid",
      subject: "direct",
      target_id: null,
      audience: "internal",
      participant_membership_ids: ["m-1", "m-2"],
      created_at: "2026-10-01T00:00:00Z",
      last_message_at: "2026-10-02T00:00:00Z",
    })
    expect(thread.participantMembershipIds).toEqual(["m-1", "m-2"])
    expect(thread.targetId).toBeUndefined()
  })

  it("maps a message row's voice fields only when voice_url is set", () => {
    const withVoice = messageFromRow({
      id: "msg-uuid",
      legacy_id: "message-1",
      thread_id: "thread-uuid",
      author_membership_id: "membership-uuid",
      body: null,
      voice_url: "https://example.com/voice.m4a",
      voice_duration_sec: 12,
      voice_transcript: "hello",
      created_at: "2026-10-01T00:00:00Z",
    })
    expect(withVoice.voice).toEqual({ url: "https://example.com/voice.m4a", durationSec: 12, transcript: "hello" })

    const textOnly = messageFromRow({
      id: "msg-uuid-2",
      legacy_id: "message-2",
      thread_id: "thread-uuid",
      author_membership_id: "membership-uuid",
      body: "hi there",
      voice_url: null,
      voice_duration_sec: null,
      voice_transcript: null,
      created_at: "2026-10-01T00:00:00Z",
    })
    expect(textOnly.voice).toBeUndefined()
    expect(textOnly.body).toBe("hi there")
  })

  it("maps a thread_reads row, which has no id column", () => {
    const read = threadReadFromRow({
      thread_id: "thread-uuid",
      membership_id: "membership-uuid",
      last_read_at: "2026-10-02T00:00:00Z",
    })
    expect(read).toEqual({
      threadId: "thread-uuid",
      membershipId: "membership-uuid",
      lastReadAt: "2026-10-02T00:00:00Z",
    })
  })

  it("maps a call log row", () => {
    const call = callLogFromRow({
      id: "call-uuid",
      legacy_id: "call-1",
      thread_id: "thread-uuid",
      logged_by_membership_id: "membership-uuid",
      other_membership_id: "other-uuid",
      type: "voice",
      started_at: "2026-10-01T10:00:00Z",
      duration_minutes: 5,
      note: "Discussed delay",
      created_at: "2026-10-01T10:05:00Z",
    })
    expect(call).toEqual({
      id: "call-1",
      threadId: "thread-uuid",
      loggedByMembershipId: "membership-uuid",
      otherMembershipId: "other-uuid",
      type: "voice",
      startedAt: "2026-10-01T10:00:00Z",
      durationMinutes: 5,
      note: "Discussed delay",
      createdAt: "2026-10-01T10:05:00Z",
    })
  })
})

describe("estimate row mapping", () => {
  it("maps breakdown fields and defaults lines to [] (no backing table)", () => {
    const estimate = estimateFromRow({
      id: "est-uuid",
      legacy_id: "estimate-1",
      homeowner_person_id: "person-uuid",
      project_name: "Villa",
      property_type: "independent",
      location: "Hyderabad, Telangana",
      built_up_area_sqft: 1200,
      floors: 2,
      construction_level: "standard",
      total_low: 1000000,
      total_high: 1200000,
      breakdown: { materials: 500000, labour: 300000, finishing: 150000, contingency: 50000 },
      review_status: "confirmed",
      created_at: "2026-09-01T00:00:00Z",
    })
    expect(estimate.lines).toEqual([])
    expect(estimate.breakdown).toEqual({ materials: 500000, labour: 300000, finishing: 150000, contingency: 50000 })
    expect(estimate.source).toBe("ai")
    expect(estimate.createdBy).toBe("ai")
  })
})

describe("marketplace requirement row mapping", () => {
  const fullRow = {
    id: "req-uuid",
    legacy_id: "req-1",
    estimate_id: "est-uuid",
    homeowner_person_id: "person-uuid",
    project_name: "Villa",
    location: "Plot 12, Road 3, Hyderabad, Telangana",
    built_up_area_sqft: 1200,
    construction_level: "standard",
    property_type: "independent",
    estimate_total_low: 1050000,
    estimate_total_high: 1230000,
    status: "posted",
    posted_at: "2026-10-01T00:00:00Z",
    awarded_proposal_id: null,
    created_at: "2026-09-25T00:00:00Z",
  }

  it("maps the full base-table row", () => {
    const requirement = marketplaceRequirementFromRow(fullRow)
    expect(requirement).toEqual({
      id: "req-1",
      estimateId: "est-uuid",
      homeownerPersonId: "person-uuid",
      projectName: "Villa",
      location: "Plot 12, Road 3, Hyderabad, Telangana",
      builtUpAreaSqft: 1200,
      constructionLevel: "standard",
      propertyType: "independent",
      estimateTotalLow: 1050000,
      estimateTotalHigh: 1230000,
      status: "posted",
      postedAt: "2026-10-01T00:00:00Z",
      awardedProposalId: undefined,
      createdAt: "2026-09-25T00:00:00Z",
    })
  })

  it("maps the partner preview row with the exact fields hidden, mirroring marketplaceVisibility's unlocked-less view", () => {
    const preview = marketplaceRequirementFromPreviewRow({
      id: "req-uuid",
      location: "Hyderabad",
      property_type: "independent",
      area_band: "1,000–1,500 sq ft",
      estimate_total_low: 1000000,
      estimate_total_high: 1300000,
      status: "posted",
    })
    expect(preview.location).toBe("Hyderabad")
    expect(preview.estimateTotalLow).toBe(1000000)
    expect(preview.estimateTotalHigh).toBe(1300000)
    expect(preview.status).toBe("posted")
    // Exact fields are not knowable from the preview until unlock.
    expect(preview.builtUpAreaSqft).toBe(0)
    // ...but the view's own area band is carried through, not recomputed from 0.
    expect(preview.areaBand).toBe("1,000–1,500 sq ft")
    expect(preview.projectName).toBe("")
    expect(preview.homeownerPersonId).toBe("")
  })
})

describe("marketplace unlock and proposal row mapping", () => {
  it("maps an unlock row", () => {
    const unlock = marketplaceUnlockFromRow({
      id: "unlock-uuid",
      legacy_id: "unlock-1",
      requirement_id: "req-uuid",
      partner_organization_id: "org-uuid",
      unlocked_at: "2026-10-01T00:00:00Z",
      credit_transaction_id: "txn-uuid",
    })
    expect(unlock).toEqual({
      id: "unlock-1",
      requirementId: "req-uuid",
      partnerOrganizationId: "org-uuid",
      unlockedAt: "2026-10-01T00:00:00Z",
      creditTransactionId: "txn-uuid",
    })
  })

  it("maps a proposal row's catalog lines, filling the id/source/effectiveDate the catalog does not carry", () => {
    const proposal = proposalFromRow({
      id: "prop-uuid",
      legacy_id: "proposal-1",
      requirement_id: "req-uuid",
      partner_organization_id: "org-uuid",
      submitted_by_person_id: "person-uuid",
      lines: [
        { category: "materials", item: "Cement", quantity: 100, unit: "bags", rate: 350, amount: 35000, confidence: "medium" },
      ],
      total: 35000,
      assumptions: ["Materials supplied"],
      exclusions: [],
      status: "submitted",
      submitted_at: "2026-10-01T00:00:00Z",
    })
    expect(proposal.lines).toEqual([
      {
        id: "proposal-1-line-0",
        category: "materials",
        item: "Cement",
        quantity: 100,
        unit: "bags",
        rate: 350,
        amount: 35000,
        source: "catalog",
        effectiveDate: "2026-10-01T00:00:00Z",
        confidence: "medium",
      },
    ])
    expect(proposal.total).toBe(35000)
  })
})

describe("plan, subscription and credit row mapping", () => {
  it("maps a plan row's entitlements", () => {
    const plan = planFromRow({
      id: "plan-uuid",
      legacy_id: "plan-1",
      name: "Contractor Starter",
      price_label: "₹999/mo",
      entitlements: ["marketplace.unlock", "marketplace.propose"],
      monthly_credits: 50,
    })
    expect(plan).toEqual({
      id: "plan-1",
      name: "Contractor Starter",
      priceLabel: "₹999/mo",
      entitlements: ["marketplace.unlock", "marketplace.propose"],
      monthlyCredits: 50,
    })
  })

  it("maps a subscription row", () => {
    const subscription = subscriptionFromRow({
      id: "sub-uuid",
      legacy_id: "sub-1",
      organization_id: "org-uuid",
      plan_id: "plan-uuid",
      status: "active",
      started_at: "2026-10-01T00:00:00Z",
    })
    expect(subscription).toEqual({
      id: "sub-1",
      organizationId: "org-uuid",
      planId: "plan-uuid",
      status: "active",
      startedAt: "2026-10-01T00:00:00Z",
    })
  })

  it("maps a credit wallet row, which has no id column", () => {
    const wallet = creditWalletFromRow({ organization_id: "org-uuid", balance: 30 })
    expect(wallet).toEqual({ organizationId: "org-uuid", balance: 30 })
  })

  it("maps a credit transaction row", () => {
    const transaction = creditTransactionFromRow({
      id: "txn-uuid",
      legacy_id: "txn-1",
      organization_id: "org-uuid",
      kind: "unlock",
      amount: -10,
      balance_after: 20,
      requirement_id: "req-uuid",
      created_at: "2026-10-01T00:00:00Z",
    })
    expect(transaction).toEqual({
      id: "txn-1",
      organizationId: "org-uuid",
      kind: "unlock",
      amount: -10,
      balanceAfter: 20,
      requirementId: "req-uuid",
      createdAt: "2026-10-01T00:00:00Z",
    })
  })
})
