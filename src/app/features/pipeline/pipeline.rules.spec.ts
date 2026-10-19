import type { Contact, Conversation, Message } from '../../shared/api/models';
import { formatWaiting, stageTotalCents, waitingLevel, waitingMs } from './pipeline.rules';

describe('pipeline rules', () => {
  const now = new Date('2026-10-09T10:24:00-04:00');
  const conversation = { status: 'open' } as Conversation;
  const inbound = { direction: 'inbound', createdAt: '2026-10-09T05:24:00-04:00' } as Message;

  it('counts waiting time only when the customer wrote last', () => {
    expect(waitingMs(conversation, inbound, now)).toBe(5 * 3_600_000);
    expect(waitingMs(conversation, { ...inbound, direction: 'outbound' }, now)).toBeNull();
    expect(waitingMs({ status: 'resolved' } as Conversation, inbound, now)).toBeNull();
  });

  it('grades and formats the wait', () => {
    expect(waitingLevel(30 * 60_000)).toBe('none');
    expect(waitingLevel(2 * 3_600_000)).toBe('warn');
    expect(waitingLevel(5 * 3_600_000)).toBe('late');
    expect(formatWaiting(6 * 60_000)).toBe('6 min');
    expect(formatWaiting(30 * 3_600_000)).toBe('1 d');
  });

  it('adds up the quotes of a stage', () => {
    expect(stageTotalCents([{ quoteCents: 4300 }, { quoteCents: null }, {}] as Contact[])).toBe(4300);
  });
});
