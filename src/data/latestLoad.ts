/**
 * Serializes "load the state" requests so only the newest one is ever committed.
 *
 * Each supabase-mode write ends with a reload. Overlapping writes start
 * overlapping reloads, and an older response landing after a newer one would
 * overwrite fresh data with a stale snapshot. A reload that resolves after a
 * sign-out or account switch would commit the previous person's data.
 */
export function createLatestWinsLoader<T>(load: () => Promise<T>, commit: (value: T) => void) {
  let sequence = 0
  let latest: Promise<void> = Promise.resolve()

  return {
    /**
     * Starts a load and commits it only if no newer load has started and the
     * loader has not been invalidated. Resolves once the newest load has
     * settled, so a caller whose own load was superseded still sees state that
     * includes its write. Rejects only when its own load fails.
     */
    async reload(): Promise<void> {
      const ticket = ++sequence
      const own = load().then((value) => {
        if (ticket === sequence) commit(value)
      })
      latest = own.catch(() => undefined)
      await own
      let waited: Promise<void>
      do {
        waited = latest
        await waited
      } while (waited !== latest)
    },

    /** Drops the result of every load already in flight (sign-out, account switch). */
    invalidate(): void {
      sequence++
    },
  }
}
