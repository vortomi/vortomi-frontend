import { Injectable, inject, signal } from '@angular/core';
import { AccessTokenSource } from '../../core/api/access-token';
import { ApiClient } from '../../core/api/api-client';
import type { Id } from '../../shared/api/models';

/** What the server says changed: a conversation, or somewhere in the company (null). Never content. */
export interface InboxChange {
  conversationId: Id | null;
}

/** Waits between reconnection attempts after a failure: 2 s, 4 s, 8 s... up to 30 s. */
const RETRY_MIN_MS = 2_000;
const RETRY_MAX_MS = 30_000;

interface ServerEvent {
  event: string;
  data: string;
}

/**
 * The inbox's live line to vortomi-backend ('api' mode): a Server-Sent Events stream of change
 * notices for the active company. Read with fetch, not EventSource, so the session token goes
 * in a header and never in the URL. The server ends the stream every few minutes; it is opened
 * again with a fresh token, and after a failure with growing waits.
 */
@Injectable({ providedIn: 'root' })
export class InboxRealtime {
  private readonly api = inject(ApiClient);
  private readonly tokens = inject(AccessTokenSource);

  /** True while the stream is open: the inbox can then poll much less often. */
  readonly connected = signal(false);

  /**
   * Listens for one company until the returned function is called. `onReady` runs each time the
   * line opens (again): whatever changed while it was down has to be read then.
   */
  listen(tenantId: Id, onChange: (change: InboxChange) => void, onReady: () => void = () => undefined): () => void {
    const controller = new AbortController();
    void this.run(tenantId, onChange, onReady, controller.signal);
    return () => {
      controller.abort();
      this.connected.set(false);
    };
  }

  private async run(tenantId: Id, onChange: (change: InboxChange) => void, onReady: () => void, signal: AbortSignal): Promise<void> {
    let wait = RETRY_MIN_MS;
    while (!signal.aborted) {
      try {
        await this.stream(tenantId, signal, (event) => {
          if (event.event === 'ready') {
            this.connected.set(true);
            wait = RETRY_MIN_MS;
            onReady();
          } else if (event.event === 'change') {
            onChange(JSON.parse(event.data) as InboxChange);
          }
        });
      } catch {
        // Network down, server restarting, session expired: try again a little later.
      }
      this.connected.set(false);
      if (signal.aborted) return;
      await pause(wait, signal);
      wait = Math.min(wait * 2, RETRY_MAX_MS);
    }
  }

  /** One stream, until the server ends it or the connection drops. */
  private async stream(tenantId: Id, signal: AbortSignal, onEvent: (event: ServerEvent) => void): Promise<void> {
    const token = await this.tokens.token();
    if (!token) throw new Error('No session');
    const response = await fetch(this.api.url(this.api.company(tenantId, 'events')), {
      headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
      signal,
    });
    if (!response.ok || !response.body) throw new Error(`Stream refused (${response.status})`);
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += value;
      // Events end with a blank line; a partial one stays in the buffer for the next chunk.
      let end = buffer.indexOf('\n\n');
      while (end !== -1) {
        const event = parseEvent(buffer.slice(0, end));
        if (event) onEvent(event);
        buffer = buffer.slice(end + 2);
        end = buffer.indexOf('\n\n');
      }
    }
  }
}

/** "event: change\ndata: {...}" -> { event, data }. Comments (": ping") carry nothing. */
function parseEvent(block: string): ServerEvent | null {
  let event = 'message';
  const data: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).trim());
  }
  return data.length ? { event, data: data.join('\n') } : null;
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
