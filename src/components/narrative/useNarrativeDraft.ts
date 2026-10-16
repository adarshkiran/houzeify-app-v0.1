import { useCallback, useEffect, useMemo, useState } from "react"
import { hashFacts } from "../../../supabase/functions/_shared/narrative/hash"
import type { Narrative, NarrativeFacts } from "../../../supabase/functions/_shared/narrative/types"

/** A narrative is stale once the facts it was written from have changed. */
export function isStale(narrative: Narrative | undefined, currentHash: string | undefined): boolean {
  return !!narrative && narrative.factsHash !== currentHash
}

export interface NarrativeDraft {
  narrative: Narrative | undefined
  useAi: boolean
  /** What should be kept with the report: the AI text only while it is current and chosen. */
  chosen: Narrative | undefined
  set(narrative: Narrative): void
  setUseAi(value: boolean): void
  clear(): void
}

export function useNarrativeDraft(facts: NarrativeFacts | undefined): NarrativeDraft {
  const [narrative, setNarrative] = useState<Narrative>()
  const [useAi, setUseAi] = useState(true)

  useEffect(() => {
    if (!narrative) return
    let cancelled = false
    void (async () => {
      const current = facts ? await hashFacts(facts) : undefined
      if (!cancelled && isStale(narrative, current)) setNarrative(undefined)
    })()
    return () => {
      cancelled = true
    }
  }, [facts, narrative])

  const set = useCallback((next: Narrative) => {
    setNarrative(next)
    setUseAi(true)
  }, [])
  const clear = useCallback(() => setNarrative(undefined), [])

  return useMemo(
    () => ({ narrative, useAi, chosen: narrative && useAi ? narrative : undefined, set, setUseAi, clear }),
    [narrative, useAi, set, clear],
  )
}
