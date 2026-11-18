import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../../core/api/api-client';
import { API_CONFIG } from '../../../core/api/api-config';
import type { Message } from '../../../shared/api/models';
import { sampleMediaFile } from './sample-media';

export type MediaSize = 'thumb' | 'full';

/** Object URLs kept at once; the oldest is released past this. */
const MAX_KEPT = 120;

/**
 * The files of the chat, fetched with the person's session (an <img src> could not send it) and
 * turned into object URLs. Each file is fetched once per session; the browser also keeps the
 * answer (the API marks it immutable), so reopening a chat spends nothing.
 */
@Injectable({ providedIn: 'root' })
export class MediaLoader {
  private readonly api = inject(ApiClient);
  private readonly preview = inject(API_CONFIG).mode !== 'api';
  private readonly kept = new Map<string, Promise<string>>();

  /** An object URL of the file, to show or play. */
  url(message: Message, size: MediaSize = 'full'): Promise<string> {
    const key = `${message.tenantId}/${message.id}/${size}`;
    let url = this.kept.get(key);
    if (!url) {
      url = this.blob(message, size).then((blob) => URL.createObjectURL(blob));
      // A failure is not kept: the next look tries again.
      url.catch(() => this.kept.delete(key));
      this.kept.set(key, url);
      this.trim();
    }
    return url;
  }

  /** The file itself, to open or save. */
  blob(message: Message, size: MediaSize = 'full'): Promise<Blob> {
    if (this.preview) return Promise.resolve(sampleMediaFile(message));
    return this.api.blob(this.api.company(message.tenantId, `conversations/${message.conversationId}/messages/${message.id}/media?size=${size}`));
  }

  private trim(): void {
    while (this.kept.size > MAX_KEPT) {
      const [oldest] = this.kept.entries();
      if (!oldest) return;
      this.kept.delete(oldest[0]);
      void oldest[1].then((url) => URL.revokeObjectURL(url), () => undefined);
    }
  }
}
