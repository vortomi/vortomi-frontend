import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatUsdCents } from '../../../shared/format/money';
import { Icon } from '../../../shared/ui/icon';

/**
 * A plan as a card (mockup web-34): name, base price, description and benefits. The list puts its
 * switch in [plan-top] and its actions in [plan-foot]; the editor shows it bare, as a preview.
 */
@Component({
  selector: 'app-plan-card',
  imports: [Icon],
  template: `
    <div class="top"><b class="name">{{ name() || 'Nombre del plan' }}</b><ng-content select="[plan-top]" /></div>
    <div class="body">
      <p class="price">{{ price() }} <small>al mes</small></p>
      @if (description()) { <p class="desc">{{ description() }}</p> }
      @if (benefits().length) {
        <ul>
          @for (benefit of benefits(); track $index) { <li><app-icon name="check" />{{ benefit }}</li> }
        </ul>
      }
    </div>
    <ng-content select="[plan-foot]" />
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 10px; padding: 16px 18px; background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-lg); min-width: 0; }
    :host(.off) { background: var(--color-surface-muted); }
    :host(.off) .body { opacity: 0.55; }
    .top { display: flex; align-items: center; gap: 8px; min-height: 24px; }
    .name { font-size: 16px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .body { display: flex; flex-direction: column; gap: 8px; }
    .price { font-size: 26px; font-weight: 700; line-height: 1.2; }
    .price small { font-size: 13px; font-weight: 500; color: var(--color-text-muted); }
    .desc { font-size: 13.5px; color: var(--color-text-2); line-height: 1.45; }
    ul { list-style: none; display: flex; flex-direction: column; gap: 6px; font-size: 13.5px; color: var(--color-text-2); }
    li { display: flex; align-items: flex-start; gap: 8px; --icon-size: 15px; }
    li app-icon { color: var(--color-success); margin-top: 2px; flex: none; }
  `,
  host: { '[class.off]': 'suspended()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanCard {
  readonly name = input('');
  readonly priceCents = input<number | null>(null);
  readonly description = input('');
  readonly benefits = input<string[]>([]);
  /** Suspended: the card fades. */
  readonly suspended = input(false);

  protected readonly price = computed(() => {
    const cents = this.priceCents();
    return cents && cents > 0 ? formatUsdCents(cents) : '0,00 $';
  });
}
