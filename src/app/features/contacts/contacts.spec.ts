import type { Contact, Membership, Tag } from '../../shared/api/models';
import { analyzeImport, guessMapping } from './contact-import';
import { EMPTY_CONTACT_FILTERS, applyContactFilters, findDuplicate, visibleContacts } from './contacts.rules';

const contact = (overrides: Partial<Contact>): Contact => ({
  id: 'con_x',
  tenantId: 'ten_a',
  channelAccountId: 'ch_sales',
  waId: '584140000000',
  name: 'X',
  phone: '+58 414-000-0000',
  stageId: null,
  tagIds: [],
  ownerUserId: null,
  purchasesCount: 0,
  purchasesTotalCents: 0,
  attributes: [],
  createdAt: '2026-10-01T10:00:00-04:00',
  ...overrides,
});

const agent: Membership = {
  tenantId: 'ten_a',
  userId: 'usr_a',
  role: 'agent',
  status: 'active',
  channelAccountIds: ['ch_sales'],
  canSeeOthers: false,
};

const jose = contact({ id: 'con_jose', name: 'José Gutiérrez', waId: '584145550187', tagIds: ['tag_vip'] });
const ana = contact({ id: 'con_ana', name: 'Ana', waId: '584245550100', channelAccountId: 'ch_shop' });
const tags: Tag[] = [{ id: 'tag_vip', tenantId: 'ten_a', name: 'Cliente frecuente', tone: 'teal' }];

describe('contact rules', () => {
  it('shows agents only the contacts of their numbers', () => {
    expect(visibleContacts([jose, ana], agent)).toEqual([jose]);
    expect(visibleContacts([jose, ana], { ...agent, role: 'admin' })).toHaveLength(2);
  });

  it('searches by name without accents and by phone digits', () => {
    expect(applyContactFilters([jose, ana], { ...EMPTY_CONTACT_FILTERS, search: 'jose' })).toEqual([jose]);
    expect(applyContactFilters([jose, ana], { ...EMPTY_CONTACT_FILTERS, search: '0187' })).toEqual([jose]);
  });

  it('treats the same phone on another number as a different contact', () => {
    expect(findDuplicate([jose], 'ch_sales', jose.waId)).toBe(jose);
    expect(findDuplicate([jose], 'ch_shop', jose.waId)).toBeNull();
  });
});

describe('contact import', () => {
  it('guesses columns from Spanish and English headers', () => {
    expect(guessMapping(['Nombre del cliente', 'Teléfono', 'Notas', 'Etiquetas'])).toEqual(['name', 'phone', 'ignore', 'tags']);
  });

  it('classifies each row before saving anything', () => {
    const rows = [
      ['María', '0424-555-0144', 'cliente frecuente'],
      ['José', '0414-555-0187', ''],
      ['Sin teléfono', 'abc', ''],
      ['', '0412-555-0000', ''],
      ['María otra vez', '0424 555 0144', ''],
    ];
    const result = analyzeImport(rows, ['name', 'phone', 'tags'], [jose], 'ch_sales', tags);
    expect(result.map((r) => r.status)).toEqual(['new', 'update', 'error', 'error', 'error']);
    expect(result[0]?.tagIds).toEqual(['tag_vip']);
    expect(result[4]?.message).toContain('línea 2');
  });
});
