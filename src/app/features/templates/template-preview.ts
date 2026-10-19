import { Component, input } from '@angular/core';

/** How the customer will see the template in WhatsApp. */
@Component({
  selector: 'app-template-preview',
  template: `
    <div class="phone">
      <div class="head"><span class="dot"></span><b>{{ businessName() }}</b><small>cuenta de empresa</small></div>
      <div class="chat">
        <div class="bubble">
          <p>{{ text() || 'El texto de la plantilla aparece aquí.' }}</p>
          <small>10:24</small>
        </div>
      </div>
    </div>
  `,
  styles: `
    .phone { width: 280px; background: #0f1320; border-radius: 30px; padding: 9px; box-shadow: 0 14px 30px rgba(20, 30, 50, .18); }
    .head { background: #fff; border-radius: 22px 22px 0 0; padding: 12px 14px; display: flex; align-items: center; gap: 8px; }
    .head .dot { width: 26px; height: 26px; border-radius: 50%; background: var(--color-primary); }
    .head b { font-size: 13px; } .head small { font-size: 11px; color: var(--color-text-muted); margin-left: auto; }
    .chat { background: var(--color-chat-bg); border-radius: 0 0 22px 22px; min-height: 260px; padding: 14px 10px; }
    .bubble { background: #fff; border-radius: 8px; padding: 8px 10px; font-size: 13px; line-height: 1.45; max-width: 92%;
      box-shadow: 0 1px 1px rgba(0,0,0,.07); white-space: pre-wrap; overflow-wrap: anywhere; }
    .bubble small { display: block; text-align: right; font-size: 10px; color: var(--color-bubble-meta); }
  `,
})
export class TemplatePreview {
  readonly text = input.required<string>();
  readonly businessName = input('');
}
