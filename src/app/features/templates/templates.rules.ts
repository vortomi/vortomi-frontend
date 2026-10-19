// Checks a template before sending it to Meta, so people fix obvious problems without waiting
// for a rejection. The final word is Meta's review.
import type { TemplateCategory } from '../../shared/api/models';

export interface TemplateDraft {
  name: string;
  category: TemplateCategory;
  language: string;
  body: string;
  /** Sample value for each {{n}}, required by Meta's review. */
  examples: string[];
}

export interface TemplateIssue {
  level: 'error' | 'warning';
  text: string;
}

export const MAX_BODY_LENGTH = 1024;
const PROMO_WORDS = /\b(descuento|oferta|promoci[oó]n|gratis|rebaja|aprovecha|black friday)\b/i;
const SHORTENERS = /\b(bit\.ly|tinyurl\.com|t\.co|goo\.gl|cutt\.ly|is\.gd)\//i;

/** Numbers of the {{n}} placeholders, in order of first appearance, without repeats. */
export function templateVariables(body: string): number[] {
  return [...new Set([...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])))];
}

export function templateIssues(draft: TemplateDraft, existingNames: string[]): TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  const body = draft.body.trim();
  if (!/^[a-z0-9_]+$/.test(draft.name)) issues.push({ level: 'error', text: 'El nombre solo admite minúsculas, números y guion bajo (ej.: pedido_enviado).' });
  if (existingNames.includes(draft.name)) issues.push({ level: 'error', text: 'Ya hay una plantilla con ese nombre.' });
  if (!body) issues.push({ level: 'error', text: 'Escribe el texto del mensaje.' });
  if (body.length > MAX_BODY_LENGTH) issues.push({ level: 'error', text: `El texto pasa de ${MAX_BODY_LENGTH} caracteres.` });

  const variables = templateVariables(body);
  const sorted = [...variables].sort((a, b) => a - b);
  if (sorted.some((n, i) => n !== i + 1)) issues.push({ level: 'error', text: 'Las variables deben ser {{1}}, {{2}}, {{3}}… sin saltarse números.' });
  if (/^\{\{\d+\}\}/.test(body) || /\{\{\d+\}\}[.!?]?$/.test(body)) {
    issues.push({ level: 'error', text: 'Meta no acepta que el texto empiece o termine con una variable.' });
  }
  if (sorted.some((n) => !draft.examples[n - 1]?.trim())) issues.push({ level: 'error', text: 'Escribe un ejemplo para cada variable: Meta lo pide para revisarla.' });
  if (draft.category === 'utility' && PROMO_WORDS.test(body)) {
    issues.push({ level: 'warning', text: 'Suena a promoción: Meta puede pasarla a Marketing, que cuesta más.' });
  }
  return issues;
}

/** Prototype stand-in for Meta's review. */
export function simulateReview(draft: TemplateDraft): { status: 'approved' } | { status: 'rejected'; reason: string } {
  if (SHORTENERS.test(draft.body)) return { status: 'rejected', reason: 'Incluye un enlace acortado, que Meta no permite en plantillas.' };
  return { status: 'approved' };
}

/** Body with the sample values in place of the variables. */
export function renderPreview(body: string, examples: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (match, n: string) => examples[Number(n) - 1]?.trim() || match);
}
