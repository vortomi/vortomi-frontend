import type { Message } from '../../../shared/api/models';

// Preview mode (no server): the sample chats show drawn files, so the screens can be seen.
const PHOTO = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="440" viewBox="0 0 640 440">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e5e7eb"/><stop offset="1" stop-color="#9ca3af"/></linearGradient></defs>
<rect width="640" height="440" fill="url(#g)"/>
<circle cx="320" cy="225" r="140" fill="#374151"/><circle cx="320" cy="225" r="112" fill="#6b7280"/>
<rect x="190" y="200" width="260" height="50" rx="14" fill="#b45309"/><circle cx="320" cy="225" r="34" fill="#1f2937"/></svg>`;

export function sampleMediaFile(message: Message): Blob {
  switch (message.media?.kind) {
    case 'image':
    case 'sticker':
      return new Blob([PHOTO], { type: 'image/svg+xml' });
    case 'document':
      return new Blob(['Documento de ejemplo'], { type: 'text/plain' });
    default:
      return new Blob([], { type: 'audio/mpeg' });
  }
}
