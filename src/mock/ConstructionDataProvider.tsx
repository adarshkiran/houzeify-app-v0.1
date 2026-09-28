import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type * as Inputs from "../domain/commandInputs"
import * as conversationCommands from "../domain/conversationCommands"
import type { LogCallInput, PostMessageInput } from "../domain/conversationCommands"
import * as commands from "../domain/constructionCommands"
import type {
  CallLog,
  ConstructionDataState,
  ConstructionStage,
  DailyProgress,
  EntityId,
  Evidence,
  Issue,
  Message,
  Project,
  ProjectMembership,
  ProjectUnit,
  ReviewDecision,
  Task,
  TaskAssignment,
  TaskStatus,
  TaskTemplate,
  Thread,
  Trade,
  WorkPlanItem,
  WorkType,
  Worker,
  WorkerProjectAssignment,
} from "../domain/models"
import type {
  Clock,
  Command,
  ConstructionRepository,
  IdGenerator,
} from "../domain/ports"
import {
  canTransitionTask,
  getAllowedTaskTransitions,
} from "../domain/taskTransitions"
import { useSession } from "../session/SessionProvider"
import {
  createInMemoryRepository,
  systemClock,
  uuidGenerator,
} from "./repository"

export type {
  AddEvidenceInput,
  AddLibraryStageInput,
  AddLibraryTradeInput,
  AddLibraryWorkTypeInput,
  AddProjectUnitInput,
  AddWorkPlanItemInput,
  AddWorkerInput,
  AssignWorkerToProjectInput,
  CreateProjectInput,
  CreateTaskInput,
  InviteProjectMemberInput,
  IssueEvidenceInput,
  ReportIssueInput,
  ResubmitDailyProgressInput,
  SubmitDailyProgressInput,
} from "../domain/commandInputs"

interface ConstructionDataContextValue {
  state: ConstructionDataState
  updateOrganizationProfile: (
    organizationId: EntityId,
    input: Inputs.BusinessProfileInput,
  ) => void
  createProject: (input: Inputs.CreateProjectInput) => Project
  setStageBaselines: (
    projectId: EntityId,
    baselines: Record<EntityId, number>,
  ) => Project
  addProjectUnit: (input: Inputs.AddProjectUnitInput) => ProjectUnit
  addProjectUnits: (inputs: Inputs.AddProjectUnitInput[]) => ProjectUnit[]
  inviteProjectMember: (input: Inputs.InviteProjectMemberInput) => ProjectMembership
  addWorkPlanItem: (input: Inputs.AddWorkPlanItemInput) => WorkPlanItem
  createTask: (input: Inputs.CreateTaskInput) => Task
  assignTask: (
    taskId: EntityId,
    assigneeType: TaskAssignment["assigneeType"],
    assigneeId: EntityId,
  ) => TaskAssignment
  assignWorkerToProject: (
    input: Inputs.AssignWorkerToProjectInput,
  ) => WorkerProjectAssignment
  addWorker: (input: Inputs.AddWorkerInput) => {
    worker: Worker
    assignment?: WorkerProjectAssignment
  }
  addLibraryStage: (input: Inputs.AddLibraryStageInput) => ConstructionStage
  addLibraryTrade: (input: Inputs.AddLibraryTradeInput) => Trade
  addLibraryWorkType: (input: Inputs.AddLibraryWorkTypeInput) => {
    workType: WorkType
    template: TaskTemplate
  }
  transitionTask: (taskId: EntityId, nextStatus: TaskStatus) => void
  acceptTaskAssignment: (taskId: EntityId) => void
  startTask: (taskId: EntityId) => void
  addEvidence: (input: Inputs.AddEvidenceInput) => Evidence
  submitDailyProgress: (input: Inputs.SubmitDailyProgressInput) => DailyProgress
  resubmitDailyProgress: (
    previousId: EntityId,
    input: Inputs.ResubmitDailyProgressInput,
  ) => DailyProgress
  reviewDailyProgress: (
    progressId: EntityId,
    decision: ReviewDecision,
    note?: string,
  ) => void
  publishDailyProgress: (progressId: EntityId, evidenceIds: EntityId[]) => void
  reportIssue: (input: Inputs.ReportIssueInput) => Issue
  assignIssue: (issueId: EntityId, membershipId: EntityId | undefined) => void
  transitionIssue: (
    issueId: EntityId,
    next: Issue["status"],
    resolutionNote?: string,
  ) => void
  addIssueEvidence: (
    issueId: EntityId,
    items: Inputs.IssueEvidenceInput[],
  ) => Evidence[]
  postMessage: (input: PostMessageInput) => Message
  logCall: (input: LogCallInput) => CallLog
  openDirectThread: (projectId: EntityId, otherMembershipId: EntityId) => Thread
  markThreadRead: (threadId: EntityId) => void
  markThreadUnread: (threadId: EntityId) => void
}

export { getAllowedTaskTransitions, canTransitionTask }

const ConstructionDataContext =
  createContext<ConstructionDataContextValue | null>(null)

interface ConstructionDataProviderProps {
  children: ReactNode
  /** Where data lives. Defaults to an in-memory store seeded with mock data. */
  repository?: ConstructionRepository
  clock?: Clock
  ids?: IdGenerator
}

export default function ConstructionDataProvider({
  children,
  repository,
  clock = systemClock,
  ids = uuidGenerator,
}: ConstructionDataProviderProps) {
  const { session } = useSession()

  // Dependencies are fixed for the provider's lifetime.
  const repo = useRef<ConstructionRepository>(
    repository ?? createInMemoryRepository(),
  ).current
  const [state, setState] = useState<ConstructionDataState>(() => repo.load())

  // Commands read the latest state and session through refs so they never see
  // stale values, and back-to-back commands in one tick compose correctly.
  const stateRef = useRef(state)
  const sessionRef = useRef(session)
  sessionRef.current = session

  /** Runs a pure command against current state, commits the result, returns it. */
  const run = useCallback(
    <T,>(command: Command<T>): T => {
      const { state: next, result } = command(stateRef.current, {
        actor: sessionRef.current,
        clock,
        ids,
      })
      if (next !== stateRef.current) {
        stateRef.current = next
        repo.save(next)
        setState(next)
      }
      return result
    },
    [repo, clock, ids],
  )

  const value = useMemo<ConstructionDataContextValue>(
    () => ({
      state,
      updateOrganizationProfile: (id, input) =>
        run(commands.updateOrganizationProfile(id, input)),
      createProject: (input) => run(commands.createProject(input)),
      setStageBaselines: (id, baselines) =>
        run(commands.setStageBaselines(id, baselines)),
      addProjectUnit: (input) => run(commands.addProjectUnit(input)),
      addProjectUnits: (inputs) => run(commands.addProjectUnits(inputs)),
      inviteProjectMember: (input) => run(commands.inviteProjectMember(input)),
      addWorkPlanItem: (input) => run(commands.addWorkPlanItem(input)),
      createTask: (input) => run(commands.createTask(input)),
      assignTask: (taskId, type, assigneeId) =>
        run(commands.assignTask(taskId, type, assigneeId)),
      assignWorkerToProject: (input) =>
        run(commands.assignWorkerToProject(input)),
      addWorker: (input) => run(commands.addWorker(input)),
      addLibraryStage: (input) => run(commands.addLibraryStage(input)),
      addLibraryTrade: (input) => run(commands.addLibraryTrade(input)),
      addLibraryWorkType: (input) => run(commands.addLibraryWorkType(input)),
      transitionTask: (taskId, status) =>
        run(commands.transitionTask(taskId, status)),
      acceptTaskAssignment: (taskId) =>
        run(commands.acceptTaskAssignment(taskId)),
      startTask: (taskId) => run(commands.startTask(taskId)),
      addEvidence: (input) => run(commands.addEvidence(input)),
      submitDailyProgress: (input) => run(commands.submitDailyProgress(input)),
      resubmitDailyProgress: (id, input) =>
        run(commands.resubmitDailyProgress(id, input)),
      reviewDailyProgress: (id, decision, note) =>
        run(commands.reviewDailyProgress(id, decision, note)),
      publishDailyProgress: (id, evidenceIds) =>
        run(commands.publishDailyProgress(id, evidenceIds)),
      reportIssue: (input) => run(commands.reportIssue(input)),
      assignIssue: (id, membershipId) =>
        run(commands.assignIssue(id, membershipId)),
      transitionIssue: (id, next, note) =>
        run(commands.transitionIssue(id, next, note)),
      addIssueEvidence: (id, items) =>
        run(commands.addIssueEvidence(id, items)),
      postMessage: (input) => run(conversationCommands.postMessage(input)),
      logCall: (input) => run(conversationCommands.logCall(input)),
      openDirectThread: (projectId, otherId) =>
        run(conversationCommands.openDirectThread(projectId, otherId)),
      markThreadRead: (threadId) =>
        run(conversationCommands.markThreadRead(threadId)),
      markThreadUnread: (threadId) =>
        run(conversationCommands.markThreadUnread(threadId)),
    }),
    [state, run],
  )

  return (
    <ConstructionDataContext.Provider value={value}>
      {children}
    </ConstructionDataContext.Provider>
  )
}

export function useConstructionData() {
  const context = useContext(ConstructionDataContext)

  if (!context) {
    throw new Error(
      "useConstructionData must be used within ConstructionDataProvider",
    )
  }

  return context
}
