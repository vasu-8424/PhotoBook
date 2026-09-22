export function mmToPt(mm: number): number {
  return (mm * 72) / 25.4;
}

export function ptToMm(pt: number): number {
  return (pt * 25.4) / 72;
}
