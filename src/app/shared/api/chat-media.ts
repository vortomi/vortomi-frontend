import type { ApiMessage } from './contract';
import type { ChatMedia, ChatMediaKind, ChatMediaState } from './models';

const KINDS: readonly string[] = ['image', 'audio', 'sticker', 'document', 'video'] satisfies ChatMediaKind[];
/** Being copied takes seconds; past this, the file is shown as «open it on the phone». */
const COPY_GRACE_MS = 15 * 60_000;

/**
 * The file a message brought, as the chat shows it (mockup web-24), or null when it brought none.
 * Videos are never kept; a file Vortomi never noted (older than this feature) is gone.
 */
export function chatMediaOf(row: Pick<ApiMessage, 'type' | 'media' | 'createdAt'>, now: number): ChatMedia | null {
  if (!KINDS.includes(row.type)) return null;
  const kind = row.type as ChatMediaKind;
  const media = row.media ?? null;
  return { kind, state: stateOf(kind, media, row.createdAt, now), fileName: media?.fileName ?? null, sizeBytes: media?.sizeBytes ?? null };
}

function stateOf(kind: ChatMediaKind, media: ApiMessage['media'], createdAt: string, now: number): ChatMediaState {
  if (kind === 'video') return 'not_kept';
  switch (media?.status) {
    case 'stored':
      return 'ready';
    case 'too_large':
      return 'too_large';
    case 'pending':
      return now - Date.parse(createdAt) > COPY_GRACE_MS ? 'waiting' : 'loading';
    default:
      return 'gone';
  }
}

/** «840 KB», «2,4 MB»: a file's size as people read it. */
export function fileSizeText(bytes: number | null): string {
  if (bytes === null) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/** «PDF», «XLSX»: the label on a document's icon. */
export function fileTypeLabel(fileName: string | null): string {
  const extension = fileName?.match(/\.([a-z0-9]{1,5})$/i)?.[1];
  return extension ? extension.toUpperCase() : 'DOC';
}
