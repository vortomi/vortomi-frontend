import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Loading placeholder with the shape of what is coming (mockups web-14 and web-17), shown instead
 * of "Cargando…" text. Pick the shape of the screen:
 * - table: header + rows of `cols` cells (put it inside the same `.card.table-card`);
 * - list: avatar + two lines per row (conversations, people);
 * - rows: one line + short end per row (settings lists);
 * - cards: a grid of cards;
 * - detail: title + two columns of blocks;
 * - form: labels and fields;
 * - chat: message bubbles.
 */
export type SkeletonKind = 'table' | 'list' | 'rows' | 'cards' | 'detail' | 'form' | 'chat';

// Fixed widths (no randomness): the same screen always draws the same skeleton.
const WIDTHS = [72, 55, 64, 48, 80, 60, 68, 52];

@Component({
  selector: 'app-skeleton',
  template: `
    @switch (kind()) {
      @case ('table') {
        <div class="t-head"><span class="sk" style="width: 40%"></span></div>
        @for (r of rowList(); track r) {
          <div class="t-row" [style.grid-template-columns]="'repeat(' + cols() + ', 1fr)'">
            @for (c of colList(); track c) { <span class="sk" [style.width.%]="width(r + c)"></span> }
          </div>
        }
      }
      @case ('list') {
        @for (r of rowList(); track r) {
          <div class="l-row">
            <span class="sk round avatar"></span>
            <div class="lines"><span class="sk" [style.width.%]="width(r)"></span><span class="sk small" [style.width.%]="width(r + 3) + 15"></span></div>
          </div>
        }
      }
      @case ('rows') {
        @for (r of rowList(); track r) {
          <div class="r-row"><span class="sk" [style.width.%]="width(r) - 20"></span><span class="sk end"></span></div>
        }
      }
      @case ('cards') {
        <div class="cards">
          @for (r of rowList(); track r) {
            <div class="s-card">
              <span class="sk" style="width: 45%; height: 14px"></span>
              <span class="sk" [style.width.%]="width(r)"></span>
              <span class="sk" [style.width.%]="width(r + 2)"></span>
              <span class="sk block"></span>
            </div>
          }
        </div>
      }
      @case ('detail') {
        <span class="sk" style="width: 260px; height: 22px"></span>
        <div class="two">
          <div class="s-card"><span class="sk" style="width: 35%; height: 14px"></span>@for (r of rowList(); track r) { <span class="sk" [style.width.%]="width(r)"></span> }</div>
          <div class="s-card"><span class="sk" style="width: 40%; height: 14px"></span><span class="sk block tall"></span></div>
        </div>
      }
      @case ('form') {
        @for (r of rowList(); track r) {
          <div class="f-row"><span class="sk" style="width: 140px"></span><span class="sk field"></span></div>
        }
      }
      @case ('chat') {
        @for (r of rowList(); track r) {
          <span class="sk bubble" [class.out]="r % 2 === 1" [style.width.%]="width(r) - 25"></span>
        }
      }
    }
  `,
  host: { role: 'status', 'aria-label': 'Cargando', 'aria-live': 'polite', '[class]': 'kind()' },
  styles: `
    :host { display: flex; flex-direction: column; gap: 14px; }
    :host(.table) { gap: 0; }
    .sk.small { height: 10px; }
    .t-head { padding: 14px 16px; background: var(--color-surface-muted); border-bottom: 1px solid var(--color-border); }
    .t-head .sk { height: 10px; }
    .t-row { display: grid; gap: 18px; align-items: center; padding: 16px; border-bottom: 1px solid var(--color-border); }
    .t-row:last-child { border-bottom: 0; }
    .l-row { display: flex; gap: 12px; align-items: center; padding: 6px 0; }
    .avatar { width: 40px; height: 40px; flex: none; }
    .lines { flex: 1; display: flex; flex-direction: column; gap: 8px; }
    .r-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-top: 1px solid var(--color-border-soft); }
    .r-row:first-child { border-top: 0; }
    .end { width: 64px; height: 22px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
    .s-card { display: flex; flex-direction: column; gap: 12px; padding: 18px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-surface); }
    .block { height: 36px; width: 100%; border-radius: var(--radius-sm); }
    .block.tall { height: 180px; }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 1000px) { .two { grid-template-columns: 1fr; } }
    .f-row { display: flex; flex-direction: column; gap: 8px; }
    .field { height: 42px; width: 100%; border-radius: var(--radius-sm); }
    .bubble { height: 42px; border-radius: 12px; align-self: flex-start; }
    .bubble.out { align-self: flex-end; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Skeleton {
  readonly kind = input<SkeletonKind>('rows');
  /** How many rows (or cards, bubbles, fields). */
  readonly rows = input(4);
  /** Cells per row, for tables. */
  readonly cols = input(4);

  protected readonly rowList = computed(() => Array.from({ length: this.rows() }, (_, i) => i));
  protected readonly colList = computed(() => Array.from({ length: this.cols() }, (_, i) => i));

  protected width(n: number): number {
    return WIDTHS[n % WIDTHS.length]!;
  }
}
