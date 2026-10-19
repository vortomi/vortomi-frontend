/**
 * Product identity, in one place. The name is final (16 Oct 2026); the domain is still
 * an example until registered (doc. 06, question 5). index.html keeps a copy of the
 * name as the pre-boot <title>.
 */
const DOMAIN = 'vortomi.com';

export const BRAND = {
  name: 'Vortomi',
  initial: 'V',
  tagline: 'CRM de WhatsApp',
  domain: DOMAIN,
  noReplyEmail: `no-responder@${DOMAIN}`,
} as const;
