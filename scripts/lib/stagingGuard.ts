import { readFileSync } from "node:fs"
import { createInterface } from "node:readline/promises"

// Guard for every script that touches the hosted staging project. A staging
// run must point at a hosted Supabase project whose ref equals
// STAGING_PROJECT_REF, must match the linked project when one is linked, and
// the operator must retype the ref. Reasons never echo the url, refs or keys.

const REF_PATTERN = /^[a-z]{20}$/

export function projectRefFromUrl(url: string): string | undefined {
  let hostname: string
  try {
    hostname = new URL(url).hostname
  } catch {
    return undefined
  }
  return /^([a-z]{20})\.supabase\.co$/.exec(hostname)?.[1]
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

export function readLinkedRef(path = "supabase/.temp/project-ref"): string | undefined {
  try {
    return readFileSync(path, "utf8").trim() || undefined
  } catch {
    return undefined
  }
}

async function askOnTerminal(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    return await rl.question(question)
  } finally {
    rl.close()
  }
}

export async function requireStagingTarget(
  options: {
    env?: NodeJS.ProcessEnv
    ask?: (question: string) => Promise<string>
    linkedRef?: string | undefined
  } = {},
): Promise<string> {
  const env = options.env ?? process.env
  const ask = options.ask ?? askOnTerminal
  const url = env.VITE_SUPABASE_URL
  const expectedRef = env.STAGING_PROJECT_REF

  // Every static check first, without prompting; the typed ref is only the last gate.
  const early = checkStagingTarget({ url, expectedRef, typedRef: expectedRef, linkedRef: options.linkedRef })
  if (!early.ok) throw new Error(`staging guard: ${early.reason}`)

  console.log(`Staging target: https://${early.ref}.supabase.co`)
  const typedRef = (await ask("Type the staging project ref to continue: ")).trim()
  const result = checkStagingTarget({ url, expectedRef, typedRef, linkedRef: options.linkedRef })
  if (!result.ok) throw new Error(`staging guard: ${result.reason}`)
  return result.ref
}
