/** "1 needs help", "3 need help". */
export function helpCountLabel(count: number): string {
  return `${count} ${count === 1 ? "needs" : "need"} help`;
}
