// Phone OTP sign-in and session resolution for the Supabase data source.
// resolveSession is pure (testable without a database); the functions below
// it are the thin Supabase wrappers.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { EntityId } from "../domain/models"
import type { Session } from "../domain/session"

export interface PersonRecord {
  /** Domain id (legacy id when the seed set one, else the uuid). */
  id: EntityId
  phone: string | null
}

export interface WorkerRecord {
  /** Domain id of the person this worker row belongs to, when linked. */
  userId: EntityId | null
  organizationId: EntityId
  phone: string
  /** 'invited' | 'active' | 'inactive' (workers_status_check). */
  status: string
}

export interface MembershipRecord {
  personId: EntityId
  organizationId: EntityId
  /** 'homeowner' | 'worker' | a business role (project-manager, site-engineer, ...). */
  role: string
  /** 'active' | 'invited' | 'removed'. */
  status: string
}

export interface ResolutionInput {
  person: PersonRecord | null
  workers: readonly WorkerRecord[]
  memberships: readonly MembershipRecord[]
}

/**
 * Worker rows take precedence: a person on a site team signs in as a worker.
 * Otherwise a business membership signs in as business. A verified person with
 * neither a worker row nor a membership signs in as a homeowner (no organization).
 *
 * Only an active worker row counts (an invited or inactive row yields no
 * worker session), and only an active membership whose role is neither
 * 'homeowner' nor 'worker' counts as business -- mirroring select_proposal's
 * own check in supabase/migrations/0006_functions_billing_marketplace.sql
 * (`m.status = 'active' and m.project_id is null`'s intent: a membership
 * row alone is not proof of staff standing) and
 * src/domain/constructionCommands.ts's authorizeOrganization/is_org_staff,
 * which treat 'worker' and 'homeowner' memberships as never conferring
 * business access. An invited/removed membership or inactive worker falls
 * through, same as having no row at all.
 */
export function resolveSession({ person, workers, memberships }: ResolutionInput): Session | null {
  if (!person) return null
  const worker = workers.find((row) => row.userId === person.id && row.status === "active")
  if (worker) {
    return {
      accountType: "worker",
      personId: person.id,
      organizationId: worker.organizationId,
      phone: worker.phone || person.phone || undefined,
    }
  }
  const membership = memberships.find(
    (row) =>
      row.personId === person.id &&
      row.status === "active" &&
      row.role !== "homeowner" &&
      row.role !== "worker",
  )
  if (membership) {
    return {
      accountType: "business",
      personId: person.id,
      organizationId: membership.organizationId,
    }
  }
  return { accountType: "homeowner", personId: person.id }
}

/** Sends a one-time code by SMS to an existing demo or site phone. */
export async function signInWithPhone(client: SupabaseClient, phone: string): Promise<void> {
  const { error } = await client.auth.signInWithOtp({ phone })
  if (error) throw new Error(error.message)
}

/** Verifies the SMS code and returns the resolved session, or null when the phone has no role. */
export async function verifyOtp(
  client: SupabaseClient,
  phone: string,
  code: string,
): Promise<Session | null> {
  const { error } = await client.auth.verifyOtp({ phone, token: code, type: "sms" })
  if (error) throw new Error(error.message)
  return currentSession(client)
}

/** Loads the signed-in auth user's person, workers and memberships and resolves them. */
export async function currentSession(client: SupabaseClient): Promise<Session | null> {
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError || !userData.user) return null
  const authUserId = userData.user.id

  const { data: personRow, error: personError } = await client
    .from("people")
    .select("id, legacy_id, phone")
    .eq("auth_user_id", authUserId)
    .maybeSingle()
  if (personError) throw new Error(personError.message)
  if (!personRow) return null

  const personId: EntityId = personRow.legacy_id ?? personRow.id

  const [workerResult, membershipResult] = await Promise.all([
    client
      .from("workers")
      .select("organization_id, phone, status")
      .eq("user_id", personRow.id),
    client
      .from("memberships")
      .select("organization_id, role, status")
      .eq("person_id", personRow.id),
  ])
  if (workerResult.error) throw new Error(workerResult.error.message)
  if (membershipResult.error) throw new Error(membershipResult.error.message)

  const orgUuids = [
    ...(workerResult.data ?? []).map((row) => row.organization_id),
    ...(membershipResult.data ?? []).map((row) => row.organization_id),
  ]
  const orgDomainIds = new Map<string, EntityId>()
  if (orgUuids.length) {
    const { data: orgs, error: orgError } = await client
      .from("organizations")
      .select("id, legacy_id")
      .in("id", orgUuids)
    if (orgError) throw new Error(orgError.message)
    for (const org of orgs ?? []) orgDomainIds.set(org.id, org.legacy_id ?? org.id)
  }

  return resolveSession({
    person: { id: personId, phone: personRow.phone },
    workers: (workerResult.data ?? []).map((row) => ({
      userId: personId,
      organizationId: orgDomainIds.get(row.organization_id) ?? row.organization_id,
      phone: row.phone,
      status: row.status,
    })),
    memberships: (membershipResult.data ?? []).map((row) => ({
      personId,
      organizationId: orgDomainIds.get(row.organization_id) ?? row.organization_id,
      role: row.role,
      status: row.status,
    })),
  })
}
