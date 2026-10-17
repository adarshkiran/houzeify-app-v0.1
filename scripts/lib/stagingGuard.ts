import { readFileSync } from "node:fs"
import { createInterface } from "node:readline/promises"
import { fileURLToPath } from "node:url"

// Guard for every script that touches the hosted staging project. A staging
// run must point at a hosted Supabase project whose ref equals
// STAGING_PROJECT_REF, must match the linked project when one is linked, and
// the operator must retype the ref. Reasons never echo the url, refs or keys.

const REF_LENGTH = 20
const REF_SOURCE = `[a-z]{${REF_LENGTH}}`
const REF_PATTERN = new RegExp(`^${REF_SOURCE}$`)
const HOSTED_HOST_PATTERN = new RegExp(`^(${REF_SOURCE})\\.supabase\\.co$`)

const DEFAULT_LINKED_REF_PATH = fileURLToPath(new URL("../../supabase/.temp/project-ref", import.meta.url))
const UNREADABLE_LINKED_REF = "staging guard: the linked project ref could not be read"

export function projectRefFromUrl(url: string): string | undefined {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return undefined
  }
  // Only the default https origin counts: no plain http, no explicit port, no userinfo.
  if (parsed.protocol !== "https:" || parsed.port !== "" || parsed.username !== "" || parsed.password !== "") {
    return undefined
  }
  return HOSTED_HOST_PATTERN.exec(parsed.hostname)?.[1]
}

export interface StagingTargetInput {
  url: string | undefined
  expectedRef: string | undefined
  typedRef: string | undefined
  linkedRef?: string | undefined
}

export type StagingTargetResult = { ok: true; ref: string } | { ok: false; reason: string }

const refuse = (reason: string): StagingTargetResult => ({ ok: false, reason })

export function checkStagingTarget(input: StagingTargetInput): StagingTargetResult {
  const { url, expectedRef, typedRef, linkedRef } = input
  if (!expectedRef || !REF_PATTERN.test(expectedRef)) {
    return refuse("STAGING_PROJECT_REF must be set to the 20-letter staging project ref")
  }
  if (!url) return refuse("VITE_SUPABASE_URL is not set")
  const urlRef = projectRefFromUrl(url)
  if (!urlRef) return refuse("the target is not a hosted Supabase project; local stacks are not staging")
  if (urlRef !== expectedRef) return refuse("the target project does not match STAGING_PROJECT_REF")
  if (linkedRef !== undefined && linkedRef !== expectedRef) {
    return refuse("the linked Supabase project does not match STAGING_PROJECT_REF")
  }
  if (typedRef !== expectedRef) return refuse("the typed project ref does not match")
  return { ok: true, ref: expectedRef }
}

// Returns undefined only when no linked-project file exists (an unlinked checkout).
// A file that exists but cannot be read, or does not hold exactly one ref, throws.
export function readLinkedRef(path: string = DEFAULT_LINKED_REF_PATH): string | undefined {
  let raw: string
  try {
    raw = readFileSync(path, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined
    throw new Error(UNREADABLE_LINKED_REF)
  }
  const ref = raw.trim()
  if (!REF_PATTERN.test(ref)) throw new Error(UNREADABLE_LINKED_REF)
  return ref
}

async function askOnTerminal(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  // Closed or non-TTY stdin ends without an answer; fail closed instead of hanging.
  const closed = new Promise<never>((_, reject) => {
    rl.once("close", () => reject(new Error("staging guard: no terminal input")))
  })
  try {
    return await Promise.race([rl.question(question), closed])
  } finally {
    rl.close()
  }
}

export async function requireStagingTarget(
  options: {
    env?: NodeJS.ProcessEnv
    ask?: (question: string) => Promise<string>
    linkedRef?: string | undefined
    linkedRefPath?: string
  } = {},
): Promise<string> {
  const env = options.env ?? process.env
  const ask = options.ask ?? askOnTerminal
  const url = env.VITE_SUPABASE_URL
  const expectedRef = env.STAGING_PROJECT_REF
  // Omitting linkedRef reads the real linked project; passing undefined explicitly means "no linked project".
  const linkedRef = "linkedRef" in options ? options.linkedRef : readLinkedRef(options.linkedRefPath)

  // Every static check first, without prompting; the typed ref is only the last gate.
  const early = checkStagingTarget({ url, expectedRef, typedRef: expectedRef, linkedRef })
  if (!early.ok) throw new Error(`staging guard: ${early.reason}`)

  console.log(`Staging target: ${new URL(url ?? "").origin}`)
  const typedRef = (await ask("Type the staging project ref to continue: ")).trim()
  const result = checkStagingTarget({ url, expectedRef, typedRef, linkedRef })
  if (!result.ok) throw new Error(`staging guard: ${result.reason}`)
  return result.ref
}
