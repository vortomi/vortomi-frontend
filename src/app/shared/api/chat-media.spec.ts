import { chatMediaOf, fileSizeText, fileTypeLabel } from './chat-media';

const NOW = Date.parse('2026-11-18T15:00:00Z');
const minutesAgo = (n: number) => new Date(NOW - n * 60_000).toISOString();

describe('chatMediaOf (what the chat shows of a message\'s file)', () => {
  it('a text has no file box', () => {
    expect(chatMediaOf({ type: 'text', media: null, createdAt: minutesAgo(1) }, NOW)).toBeNull();
  });

  it('a stored photo is ready; one being copied is loading, and after 15 minutes «open it on the phone»', () => {
    expect(chatMediaOf({ type: 'image', media: { status: 'stored', fileName: null, sizeBytes: 9 }, createdAt: minutesAgo(1) }, NOW)?.state).toBe('ready');
    expect(chatMediaOf({ type: 'image', media: { status: 'pending', fileName: null, sizeBytes: null }, createdAt: minutesAgo(2) }, NOW)?.state).toBe('loading');
    expect(chatMediaOf({ type: 'image', media: { status: 'pending', fileName: null, sizeBytes: null }, createdAt: minutesAgo(20) }, NOW)?.state).toBe('waiting');
  });

  it('videos are never kept; a document over 5 MB is too large; a file never copied is gone', () => {
    expect(chatMediaOf({ type: 'video', media: null, createdAt: minutesAgo(1) }, NOW)?.state).toBe('not_kept');
    expect(chatMediaOf({ type: 'document', media: { status: 'too_large', fileName: 'a.pdf', sizeBytes: 9e6 }, createdAt: minutesAgo(1) }, NOW)).toEqual({
      kind: 'document',
      state: 'too_large',
      fileName: 'a.pdf',
      sizeBytes: 9e6,
    });
    expect(chatMediaOf({ type: 'audio', media: null, createdAt: minutesAgo(60 * 24 * 9) }, NOW)?.state).toBe('gone');
    expect(chatMediaOf({ type: 'sticker', media: { status: 'unavailable', fileName: null, sizeBytes: null }, createdAt: minutesAgo(1) }, NOW)?.state).toBe('gone');
  });
});

describe('file labels', () => {
  it('sizes read as people say them, with a decimal comma', () => {
    expect(fileSizeText(860_160)).toBe('840 KB');
    expect(fileSizeText(18_874_368)).toBe('18,0 MB');
    expect(fileSizeText(null)).toBe('');
  });

  it('a document\'s icon says its type', () => {
    expect(fileTypeLabel('Menú de tortas.pdf')).toBe('PDF');
    expect(fileTypeLabel('inventario.xlsx')).toBe('XLSX');
    expect(fileTypeLabel(null)).toBe('DOC');
  });
});
