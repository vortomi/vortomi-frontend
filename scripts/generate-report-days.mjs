// Generates public/data/report-days.json deterministically (seeded PRNG): same output on every run.
// Usage: node scripts/generate-report-days.mjs
// Stand-in for what the backend's reports endpoint will compute from the real messages.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../public/data/report-days.json', import.meta.url));
let seed = 20261009;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const jitter = (value, spread) => value * (1 - spread + rand() * spread * 2);

// Conversations per weekday (0 = Sunday) and per agent: share, median minutes, on-time rate.
const TENANTS = {
  ten_ra: { perDay: 46, sales: true, agents: { usr_laura: [0.33, 4, 0.92], usr_carlos: [0.37, 6, 0.88], usr_andrea: [0.3, 9, 0.81] } },
  ten_sonrisa: { perDay: 70, agents: { usr_gabriela: [0.15, 5, 0.9], usr_hector: [0.3, 7, 0.86], usr_paola: [0.3, 6, 0.88], usr_miguel: [0.25, 12, 0.72] } },
  ten_vision: { perDay: 20, agents: { usr_rafael: [0.4, 11, 0.74], usr_lucia: [0.6, 8, 0.82] } },
  ten_ortiz: { perDay: 9, agents: { usr_jorge: [1, 18, 0.61] } },
  ten_valle: { perDay: 95, sales: true, agents: { usr_elena: [0.1, 4, 0.93], usr_andres: [0.25, 5, 0.9], usr_sofia: [0.25, 7, 0.85], usr_ramon: [0.2, 10, 0.79], usr_valeria: [0.2, 6, 0.87] } },
  ten_popular: { perDay: 25, agents: { usr_ernesto: [0.35, 9, 0.8], usr_carmen: [0.65, 6, 0.87] } },
  ten_vortomi: { perDay: 12, agents: { usr_yornel: [0.3, 5, 0.9], usr_mariana: [0.4, 4, 0.94], usr_daniel_f: [0.3, 6, 0.89] } },
};
const WEEKDAY = [0.15, 1.05, 1, 1.1, 1, 1.15, 0.6];
// Today (9 Oct, 10:24) is only a few hours in.
const TODAY = '2026-10-09';
const TODAY_SHARE = 0.3;

const days = [];
for (let d = new Date(Date.UTC(2026, 8, 1)); d <= new Date(`${TODAY}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
  days.push({ date: d.toISOString().slice(0, 10), weekday: d.getUTCDay() });
}

const rows = [];
for (const [tenantId, t] of Object.entries(TENANTS)) {
  for (const { date, weekday } of days) {
    // October is busier than September for the sample company, so the comparison shows growth.
    const growth = tenantId === 'ten_ra' && date >= '2026-10-01' ? 1.18 : 1;
    const dayTotal = Math.round(jitter(t.perDay * WEEKDAY[weekday] * growth, 0.18) * (date === TODAY ? TODAY_SHARE : 1));
    let assigned = 0;
    for (const [userId, [share, minutes, onTimeRate]] of Object.entries(t.agents)) {
      const conversations = Math.round(dayTotal * share * 0.97);
      assigned += conversations;
      if (conversations === 0) continue;
      const wonCount = t.sales ? Math.min(conversations, Math.floor(rand() * 2.6 * (weekday === 0 ? 0.3 : 1))) : 0;
      let wonCents = 0;
      for (let i = 0; i < wonCount; i++) wonCents += Math.round(1500 + rand() * 7500) * 1;
      rows.push({
        tenantId,
        date,
        userId,
        conversations,
        onTime: Math.min(conversations, Math.round(conversations * Math.min(1, jitter(onTimeRate, 0.06)))),
        firstResponseMedianSec: Math.round(jitter(minutes * 60, 0.25)),
        wonCount,
        wonCents: Math.round(wonCents / 100) * 100,
      });
    }
    const unanswered = Math.max(0, dayTotal - assigned);
    if (unanswered > 0) {
      rows.push({ tenantId, date, userId: null, conversations: unanswered, onTime: 0, firstResponseMedianSec: null, wonCount: 0, wonCents: 0 });
    }
  }
}

writeFileSync(out, `[\n${rows.map((r) => '  ' + JSON.stringify(r)).join(',\n')}\n]\n`);
console.log(`${rows.length} rows`);
