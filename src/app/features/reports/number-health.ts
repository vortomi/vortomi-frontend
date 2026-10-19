import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { QUALITY } from '../../shared/api/labels';
import type { ChannelAccount, Tone, UsageMonth } from '../../shared/api/models';
import { FREE_SERVICE_PER_NUMBER } from '../../shared/billing/meta-pricing';
import { formatCount } from '../../shared/format/money';
import { Icon } from '../../shared/ui/icon';
import { Pill } from '../../shared/ui/pill';

/** Quality and limits Meta gives each number, plus its free replies left this month. */
@Component({
  selector: 'app-number-health',
  imports: [Icon, Pill],
  template: `
    <header>
      <h2>Salud de los números</h2>
      <span class="muted">según Meta</span>
    </header>
    @for (item of items(); track item.id) {
      <div class="row">
        <span class="ico" [style.color]="item.color"><app-icon name="phone" /></span>
        <div class="text">
          <b>{{ item.label }}</b> · {{ item.number }}
          <span>{{ item.hint }}</span>
          <div class="free">
            <div class="track"><i [style.width.%]="item.percent" [class.over]="item.over"></i></div>
            <small>{{ item.used }} de {{ free }} respuestas gratis</small>
          </div>
        </div>
        <app-pill [tone]="item.tone">{{ item.status }}</app-pill>
      </div>
    } @empty {
      <p class="muted empty">Esta empresa todavía no tiene números conectados.</p>
    }
  `,
  styles: `
    :host { display: block; }
    header { display: flex; align-items: baseline; justify-content: space-between; padding: 18px 22px 8px; }
    h2 { font-size: 16px; }
    header .muted { font-size: 12.5px; }
    .row { display: flex; align-items: flex-start; gap: 12px; padding: 13px 22px; border-top: 1px solid var(--color-border-soft); }
    .ico { --icon-size: 20px; padding-top: 2px; }
    .text { flex: 1; min-width: 0; font-size: 14px; }
    .text span { display: block; font-size: 12.5px; color: var(--color-text-muted); margin-top: 2px; }
    .free { display: flex; align-items: center; gap: 8px; margin-top: 7px; }
    .track { flex: 0 0 70px; height: 5px; background: #eef0f3; border-radius: 99px; overflow: hidden; }
    .track i { display: block; height: 100%; background: var(--color-success); }
    .track i.over { background: var(--color-warning); }
    small { font-size: 12px; color: var(--color-text-muted); white-space: nowrap; }
    .empty { padding: 14px 22px 20px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NumberHealth {
  readonly channels = input.required<ChannelAccount[]>();
  readonly usage = input.required<UsageMonth[]>();

  protected readonly free = formatCount(FREE_SERVICE_PER_NUMBER);

  protected readonly items = computed(() => {
    const usage = new Map(this.usage().map((u) => [u.channelAccountId, u]));
    return this.channels().map((channel) => {
      const used = usage.get(channel.id)?.serviceMessages ?? 0;
      const { status, tone, hint } = this.health(channel);
      return {
        id: channel.id,
        label: channel.label,
        number: channel.displayNumber,
        color: channel.color,
        status,
        tone,
        hint,
        used: formatCount(used),
        percent: Math.min(100, Math.round((used / FREE_SERVICE_PER_NUMBER) * 100)),
        over: used > FREE_SERVICE_PER_NUMBER,
      };
    });
  });

  private health(channel: ChannelAccount): { status: string; tone: Tone; hint: string } {
    if (channel.status === 'disconnected') {
      return { status: 'Desconectado', tone: 'red', hint: 'No recibe mensajes: hay que volver a dar acceso en Meta' };
    }
    if (channel.status === 'restricted') {
      return { status: 'Restringido', tone: 'red', hint: 'Meta limitó los envíos por quejas de los clientes' };
    }
    const quality = QUALITY[channel.qualityRating];
    // Meta sets this limit per business portfolio: all its numbers share it.
    const limit = `Puede escribir primero a ${formatCount(channel.messagingTier)} clientes por día, entre todos sus números`;
    const hint =
      channel.qualityRating === 'high'
        ? limit
        : channel.qualityRating === 'medium'
          ? 'Algunos clientes lo bloquearon o reportaron: revisa las plantillas'
          : 'Si sigue bajando, Meta reduce cuántos clientes puede contactar';
    return { status: `Calidad ${quality.text.toLowerCase()}`, tone: quality.tone, hint };
  }
}
