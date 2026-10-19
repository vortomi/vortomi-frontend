// Images people upload (logos, product photos). Raster only: an SVG can carry scripts.
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export function imageFileError(file: { type: string; size: number }, maxBytes: number): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return 'Usa una imagen PNG, JPG o WebP.';
  if (file.size > maxBytes) return `La imagen pesa más de ${Math.round(maxBytes / 1000)} KB.`;
  return null;
}

export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
