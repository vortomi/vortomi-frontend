// Pure pipeline rules: who is waiting for an answer and how much each stage is worth.
import type { Contact, Conversation, Message } from '../../shared/api/models';
import { formatDuration } from '../../shared/format/duration';

const HOUR_MS = 3_600_000;

export type WaitingLevel = 'none' | 'warn' | 'late';

/** Time the customer has been waiting: only when their message is the last one of an open chat. */
export function waitingMs(conversation: Conversation | null, lastMessage: Message | undefined, now: Date): number | null {
  if (!conversation || conversation.status !== 'open' || lastMessage?.direction !== 'inbound') return null;
  return Math.max(0, now.getTime() - new Date(lastMessage.createdAt).getTime());
}

export function waitingLevel(ms: number | null): WaitingLevel {
  if (ms === null || ms < HOUR_MS) return 'none';
  return ms < 4 * HOUR_MS ? 'warn' : 'late';
}

/** How long the customer has been waiting: "6 min", "3 h", "2 d". */
export const formatWaiting = formatDuration;

export function stageTotalCents(contacts: Contact[]): number {
  return contacts.reduce((sum, c) => sum + (c.quoteCents ?? 0), 0);
}
