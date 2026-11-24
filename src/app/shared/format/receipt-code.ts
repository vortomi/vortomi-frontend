/** Vortomi's receipt number as printed on the PDF: 1 → "VTM-000001". */
export function receiptCode(n: number): string {
  return `VTM-${String(n).padStart(6, '0')}`;
}
