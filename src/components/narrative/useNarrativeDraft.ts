import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { hashFacts } from "../../../supabase/functions/_shared/narrative/hash"
import type { Narrative, NarrativeFacts } from "../../../supabase/functions/_shared/narrative/types"

/** A narrative is stale once the facts it was written from have changed. */
export function isStale(narrative: Narrative | undefined, currentHash: string | undefined): boolean {
  return !!narrative && narrative.factsHash !== currentHash
}

/** The draft is usable only while chosen and written from exactly the current facts. */
export function selectChosen(
  narrative: Narrative | undefined,
  useAi: boolean,
  currentHash: string | undefined,
): Narrative | undefined {
  return narrative && useAi && currentHash !== undefined && narrative.factsHash === currentHash ? narrative : undefined
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
  const [currentHash, setCurrentHash] = useState<string>()
  const hashRef = useRef<string | undefined>(undefined)

  // Hash the facts once per change; the hash is unknown until it resolves.
  useEffect(() => {
    hashRef.current = undefined
    setCurrentHash(undefined)
    if (!facts) {
      setNarrative(undefined)
      return
    }
    let cancelled = false
    void hashFacts(facts).then((hash) => {
      if (cancelled) return
      hashRef.current = hash
      setCurrentHash(hash)
    })
    return () => {
      cancelled = true
    }
  }, [facts])

  useEffect(() => {
    if (currentHash !== undefined && isStale(narrative, currentHash)) setNarrative(undefined)
  }, [currentHash, narrative])

  const set = useCallback((next: Narrative) => {
    const known = hashRef.current
    if (known !== undefined && next.factsHash !== known) return // written from older facts
    setNarrative(next)
    setUseAi(true) // a fresh draft is shown straight away
  }, [])
  const clear = useCallback(() => setNarrative(undefined), [])

  return useMemo(
    () => ({ narrative, useAi, chosen: selectChosen(narrative, useAi, currentHash), set, setUseAi, clear }),
    [narrative, useAi, currentHash, set, clear],
  )
}
