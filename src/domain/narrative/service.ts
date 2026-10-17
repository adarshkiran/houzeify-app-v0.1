import type { NarrativeRequest, NarrativeResponse } from "../../../supabase/functions/_shared/narrative/types"

/**
 * Writes the prose for a report or weekly summary from anonymised facts. The
 * memory-mode implementation is the fake; Supabase mode calls the edge function.
 */
export interface NarrativeService {
  narrate(request: NarrativeRequest): Promise<NarrativeResponse>
}
