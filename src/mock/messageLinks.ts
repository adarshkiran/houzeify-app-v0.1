import type { EntityId, Issue, Task } from "../domain/models"

export interface MessageLink {
  kind: "task" | "issue"
  id: EntityId
  title: string
}

/** Records created from messages in one thread, keyed by message id. Pass only what the viewer may read. */
export function messageLinks(threadId: EntityId, tasks: Task[], issues: Issue[]): Map<EntityId, MessageLink[]> {
  const links = new Map<EntityId, MessageLink[]>()
  const add = (messageId: EntityId, link: MessageLink) => links.set(messageId, [...(links.get(messageId) ?? []), link])
  for (const task of tasks) if (task.source?.threadId === threadId) add(task.source.messageId, { kind: "task", id: task.id, title: task.title })
  for (const issue of issues) if (issue.source?.threadId === threadId) add(issue.source.messageId, { kind: "issue", id: issue.id, title: issue.title })
  return links
}
