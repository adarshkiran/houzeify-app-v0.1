/**
 * Digits only, keeping the last 10 so "+91 98765 43210", "098765-43210" and
 * "9876543210" compare equal. Returns "" when there is nothing usable.
 */
export function normalizePhone(phone: string | undefined | null): string {
  const digits = (phone ?? "").replace(/\D/g, "")
  return digits.length > 10 ? digits.slice(-10) : digits
}

/** True when both numbers are present and equal once normalized. */
export function samePhone(
  a: string | undefined | null,
  b: string | undefined | null,
): boolean {
  const left = normalizePhone(a)
  return left !== "" && left === normalizePhone(b)
}
