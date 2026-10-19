import { type TemplateDraft, renderPreview, simulateReview, templateIssues, templateVariables } from './templates.rules';

const draft = (overrides: Partial<TemplateDraft> = {}): TemplateDraft => ({
  name: 'pedido_enviado',
  category: 'utility',
  language: 'es',
  body: 'Hola {{1}}, tu pedido {{2}} salió hoy.',
  examples: ['Daniel', 'OP-0412'],
  ...overrides,
});
const errors = (d: TemplateDraft, names: string[] = []) => templateIssues(d, names).filter((i) => i.level === 'error');

describe('template rules', () => {
  it('accepts a well formed utility template', () => {
    expect(templateIssues(draft(), [])).toEqual([]);
  });

  it('finds variables in order without repeats', () => {
    expect(templateVariables('{{2}} y {{1}} y {{2}}')).toEqual([2, 1]);
  });

  it.each([
    ['Pedido Enviado', 'minúsculas'],
    ['pedido_enviado', 'Ya hay'],
  ])('rejects the name %s', (name, text) => {
    expect(errors(draft({ name }), ['pedido_enviado'])[0]?.text).toContain(text);
  });

  it('requires consecutive variables with an example each', () => {
    expect(errors(draft({ body: 'Hola {{1}}, tu código es {{3}}.' })).map((e) => e.text).join()).toContain('sin saltarse');
    expect(errors(draft({ examples: ['Daniel', ''] }))[0]?.text).toContain('ejemplo');
  });

  it('rejects variables at the very start or end', () => {
    expect(errors(draft({ body: '{{1}}, tu pedido salió.', examples: ['Daniel'] }))[0]?.text).toContain('empiece o termine');
    expect(errors(draft({ body: 'Tu pedido es {{1}}.', examples: ['OP-1'] }))[0]?.text).toContain('empiece o termine');
  });

  it('warns when a utility template sounds like marketing', () => {
    expect(templateIssues(draft({ body: 'Hola {{1}}, aprovecha el descuento en {{2}} hoy.' }), [])[0]?.level).toBe('warning');
  });

  it('simulates Meta rejecting shortened links', () => {
    expect(simulateReview(draft({ body: 'Míralo en bit.ly/abc ya' })).status).toBe('rejected');
    expect(simulateReview(draft()).status).toBe('approved');
  });

  it('renders the preview with the examples', () => {
    expect(renderPreview('Hola {{1}}, pedido {{2}}', ['Ana', ''])).toBe('Hola Ana, pedido {{2}}');
  });
});
