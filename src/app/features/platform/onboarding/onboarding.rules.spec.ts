import type { ChannelAccount } from '../../../shared/api/models';
import { DEMO_NEW_WABA_ID, type WabaNumber, classifyWabaLookup, connectionChecks, normalizeTaxId, slugify } from './onboarding.rules';

const channel: ChannelAccount = {
  id: 'ch_a',
  tenantId: 'ten_a',
  label: 'Ventas',
  displayNumber: '0412-555-0101',
  phoneNumberId: '100000000000001',
  wabaId: '200000000000001',
  status: 'connected',
  qualityRating: 'high',
  messagingTier: 1000,
  coexistence: false,
  color: '#000',
  accessExpiresAt: null,
};
const names = new Map([['ten_a', 'Repuestos Andinos']]);

describe('slugify', () => {
  it('builds a readable, accent-free identifier', () => {
    expect(slugify('  Pastelería Dulce Hogar, C.A. ')).toBe('pasteleria-dulce-hogar-c-a');
  });
});

describe('classifyWabaLookup', () => {
  it('finds the demo account with a free number', () => {
    const lookup = classifyWabaLookup(DEMO_NEW_WABA_ID, [channel], names, 'Pastelería Dulce Hogar');
    expect(lookup).toEqual({
      status: 'found',
      account: { businessVerified: false, hasPaymentMethod: false },
      numbers: [expect.objectContaining({ displayNumber: '+58 424-555-0133', verifiedName: 'Dulce Hogar', nameStatus: 'pending_review', takenBy: null })],
    });
  });

  it('marks numbers that already belong to another company', () => {
    const lookup = classifyWabaLookup('2000 0000 0000 001', [channel], names, 'Nueva');
    expect(lookup.status === 'found' && lookup.numbers[0]?.takenBy).toBe('Repuestos Andinos');
  });

  it('reports unknown accounts', () => {
    expect(classifyWabaLookup('123', [channel], names, 'Nueva')).toEqual({ status: 'not_found' });
  });
});

describe('normalizeTaxId', () => {
  it.each([
    ['J-41234567-8', 'J-41234567-8'],
    ['j 41.234.567 8', 'J-41234567-8'],
    ['V123456789', 'V-12345678-9'],
  ])('reads %s', (text, expected) => {
    expect(normalizeTaxId(text)).toBe(expected);
  });

  it.each(['', '41234567', 'X-41234567-8', 'J-4123456-8'])('rejects %s', (text) => {
    expect(normalizeTaxId(text)).toBeNull();
  });
});

describe('connectionChecks', () => {
  const number: WabaNumber = { phoneNumberId: '1', displayNumber: '+58 424-555-0133', verifiedName: 'Dulce Hogar', nameStatus: 'approved', takenBy: null };
  const warnings = (checks: { title: string; outcome: string }[]) => checks.filter((c) => c.outcome === 'warn').map((c) => c.title);

  it('passes everything for a verified, paying company with an approved name', () => {
    expect(warnings(connectionChecks({ businessVerified: true, hasPaymentMethod: true }, number))).toEqual([]);
  });

  it('warns, without blocking, about what a new company still lacks', () => {
    const checks = connectionChecks({ businessVerified: false, hasPaymentMethod: false }, { ...number, nameStatus: 'pending_review' });
    expect(warnings(checks)).toEqual([
      'Nombre visible «Dulce Hogar» en revisión de Meta',
      'Su negocio no está verificado en Meta',
      'Falta el método de pago en Meta',
    ]);
  });
});
