import { agentRows, companyKpis, type CompanyUsage, dayBars, durationText, hourBars, numberRows, operationRows, whoAnswers } from './usage-company.rules';

const usage: CompanyUsage = {
  from: '2026-11-01',
  to: '2026-11-03',
  tenant: { id: 't', name: 'Agua Potable', plan: 'internal', status: 'active', city: 'Naguanagua', createdAt: '2026-10-19T20:25:55Z' },
  days: [
    { date: '2026-11-01', fromCustomers: 8, automatic: 9, staff: 1, ownerApp: 0 },
    { date: '2026-11-03', fromCustomers: 2, automatic: 1, staff: 1, ownerApp: 0 },
  ],
  hours: [{ hour: 11, fromCustomers: 8, answers: 9 }],
  replies: { customerMessages: 10, unanswered: 1, medianSec: 21 },
  delivery: { outbound: 12, delivered: 12, failed: 0 },
  staffPeople: 1,
  agent: {
    settings: { enabled: true, schedule: 'always', humanPauseMinutes: 5 },
    months: [
      { month: '2026-10', replies: 16, inputTokens: 53_859, outputTokens: 1_689 },
      { month: '2026-11', replies: 19, inputTokens: 94_794, outputTokens: 1_444 },
    ],
  },
  numbers: [{ id: 'n', label: 'Vortomi', displayNumber: '+1 555-660-1436', status: 'connected', statusReason: null, coexistence: false, tokenExpiresAt: null }],
  operation: {
    conversations: 2,
    open: 2,
    newConversations: 0,
    orders: [{ status: 'confirmed', count: 2 }, { status: 'awaiting_payment', count: 1 }],
    people: [{ role: 'admin', count: 1 }, { role: 'agent', count: 2 }],
    approvedTemplates: 0,
  },
};

describe('one company\'s «Uso y salud» rules', () => {
  it('sums the period; with nothing before, there is nothing to compare', () => {
    expect(companyKpis(usage, { ...usage, days: [] })).toMatchObject({ messages: 22, messagesChange: null, medianSec: 21, automatic: 10, answers: 12, automaticPercent: 83 });
  });

  it('says waiting times as people do', () => {
    expect([durationText(null), durationText(21), durationText(240), durationText(7800)]).toEqual(['—', '21 s', '4 min', '2 h 10 min']);
  });

  it('draws every day of the range and the 24 hours, labelled every three', () => {
    expect(dayBars(usage, { from: '2026-11-01', to: '2026-11-02' })).toEqual([
      { date: '2026-11-01', conversations: 8, onTime: 10 },
      { date: '2026-11-02', conversations: 0, onTime: 0 },
    ]);
    const hours = hourBars(usage);
    expect(hours).toHaveLength(24);
    expect(hours[11]).toEqual({ date: 'h11', conversations: 8, onTime: 9, label: '', title: '11:00 a 11:59' });
    expect(hours[12]!.label).toBe('12 h');
  });

  it('splits the answers between automatic, the team and the owner', () => {
    expect(whoAnswers(usage).map((r) => r.value)).toEqual(['10 · 83 %', '2 · 17 %', '0 · 0 %']);
    expect(whoAnswers(usage)[1]!.detail).toBe('1 persona respondió');
  });

  it('shows the agent\'s month, the one before and how it is set up', () => {
    expect(agentRows(usage).map((r) => [r.title, r.value])).toEqual([
      ['Respuestas del período', '19'],
      ['Tokens leídos y escritos', '94.794 · 1.444'],
      ['Octubre', '16 respuestas'],
      ['Cuándo responde · espera si alguien escribe', 'Siempre · 5 min'],
    ]);
  });

  it('describes numbers and operation in words', () => {
    expect(numberRows(usage)[0]).toMatchObject({ status: 'Conectado', tone: 'green', detail: 'Sin coexistencia · acceso sin fecha de vencimiento' });
    expect(operationRows(usage).map((r) => r.detail)).toEqual([
      '2 en total · 0 nuevas en el período',
      '2 confirmados · 1 esperando pago',
      '1 administrador · 2 agentes',
      'para escribir fuera de la ventana de 24 h',
    ]);
  });
});
