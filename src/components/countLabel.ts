/** "1 task", "3 tasks"; pass the plural when it isn't just + "s". */
export function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}
