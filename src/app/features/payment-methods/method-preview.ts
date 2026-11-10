import { Component, computed, input } from '@angular/core';
import { type MessageMethod, paymentMessage } from './payment-message';

/** The sample order of the preview. */
const SAMPLE = { customerName: 'María', totalCents: 1000 };

/**
 * «Vista previa»: the WhatsApp message the customer gets right after confirming an order, with this
 * method's data and the amount in its currency, exactly as the server writes it.
 */
@Component({
  selector: 'app-method-preview',
  template: `
    <h2>Vista previa</h2>
    <p class="lead">Así le llega al cliente por WhatsApp, justo después de confirmar un pedido de USD 10,00.</p>
    <div class="chat">
      <div class="bubble">{{ text() }}<span class="time">10:42</span></div>
    </div>
    @if (method().currency === 'VES' && !bsPerUsd()) {
      <p class="hint">Sin tasa del día, el monto en bolívares queda «te lo confirmamos en un momento». Cárgala en Ajustes → Tasa de cambio.</p>
    }
    <p class="hint">Cada dato va en su propia línea, para que el cliente lo copie con facilidad.</p>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 10px; }
    h2 { font-size: 15.5px; }
    .hint { font-size: 13px; color: var(--color-text-muted); margin: 0; }
    .chat { background: var(--color-chat-bg); border-radius: 12px; padding: 14px; }
    .bubble { background: var(--color-bubble-out); border-radius: 10px 0 10px 10px; padding: 8px 10px 18px; font-size: 13.5px; line-height: 1.45; white-space: pre-wrap;
      word-break: break-word; position: relative; box-shadow: var(--shadow-sm); margin-left: 24px; color: var(--color-text); }
    .time { position: absolute; right: 8px; bottom: 4px; font-size: 11px; color: var(--color-bubble-meta); }
  `,
})
export class MethodPreview {
  readonly method = input.required<MessageMethod>();
  /** The company's rate of the day, for the amount in bolívares. */
  readonly bsPerUsd = input<string | null>(null);

  protected readonly text = computed(() => paymentMessage(this.method(), { ...SAMPLE, bsPerUsd: this.bsPerUsd() }));
}
