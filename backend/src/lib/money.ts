export function toNumber(value: unknown): number {
  return Math.round(Number(value) * 100) / 100;
}

export function moneyKey(value: unknown): string {
  return toNumber(value).toFixed(2);
}
