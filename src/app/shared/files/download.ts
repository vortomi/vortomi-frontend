/** Saves text as a file in the browser, without a server round trip. */
export function downloadText(filename: string, content: string, type = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
