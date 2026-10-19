import { TestBed } from '@angular/core/testing';
import type { MessageTemplate, QuickReply } from '../../../shared/api/models';
import { MessageComposer } from './message-composer';

const REPLIES: QuickReply[] = [
  { id: 'qr_payment', tenantId: 't', shortcut: 'pago', title: 'Formas de pago', body: 'Aceptamos Pago Móvil.' },
  { id: 'qr_hours', tenantId: 't', shortcut: 'horario', title: 'Horario', body: 'De 8 a 5.' },
];

const TEMPLATES: MessageTemplate[] = [
  { id: 'tpl_ok', tenantId: 't', name: 'order_shipped', category: 'utility', language: 'es', status: 'approved', rejectionReason: null, body: 'Hola {{1}}' },
  { id: 'tpl_no', tenantId: 't', name: 'brake_promo', category: 'marketing', language: 'es', status: 'rejected', rejectionReason: 'x', body: 'Promo' },
];

async function setup(windowOpen = true) {
  const fixture = TestBed.createComponent(MessageComposer);
  fixture.componentRef.setInput('conversationId', 'cnv_1');
  fixture.componentRef.setInput('windowOpen', windowOpen);
  fixture.componentRef.setInput('quickReplies', REPLIES);
  fixture.componentRef.setInput('templates', TEMPLATES);
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  const type = async (text: string) => {
    const box = host.querySelector('textarea')!;
    box.value = text;
    box.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const enter = async () => {
    host.querySelector('textarea')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
  };
  return { fixture, host, type, enter };
}

describe('MessageComposer', () => {
  it('shows matching quick replies after "/" and Enter inserts the first one', async () => {
    const { host, type, enter } = await setup();
    await type('/pa');
    expect(host.querySelectorAll('.replies button')).toHaveLength(1);
    await enter();
    expect(host.querySelector('textarea')!.value).toBe('Aceptamos Pago Móvil.');
    expect(host.querySelector('.replies')).toBeNull();
  });

  it('emits the reply on Enter and clears the box', async () => {
    const { fixture, host, type, enter } = await setup();
    const sent: string[] = [];
    fixture.componentInstance.reply.subscribe((body) => sent.push(body));
    await type('  Hola José  ');
    await enter();
    expect(sent).toEqual(['Hola José']);
    expect(host.querySelector('textarea')!.value).toBe('');
  });

  it('blocks free replies when the 24 h window is closed', async () => {
    const { host } = await setup(false);
    expect(host.querySelector('textarea')).toBeNull();
    expect(host.querySelector('.closed')?.textContent).toContain('ventana de 24 h está cerrada');
  });

  it('offers only templates approved by Meta', async () => {
    const { fixture, host } = await setup(false);
    (host.querySelector('.closed button') as HTMLButtonElement).click();
    await fixture.whenStable();
    const names = [...host.querySelectorAll('.tpl b')].map((b) => b.textContent?.trim());
    expect(names).toEqual(['order_shipped']);
  });
});
