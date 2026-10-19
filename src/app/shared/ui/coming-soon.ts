import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from './icon';

/** Placeholder for screens whose route exists but whose prototype comes in a later step. */
@Component({
  selector: 'app-coming-soon',
  imports: [Icon],
  template: `
    <header class="top">
      <h1>{{ title() }}</h1>
    </header>
    <section class="body">
      <div class="card">
        <app-icon name="hammer" />
        <h2>Pantalla en preparación</h2>
        <p>
          El diseño ya está aprobado en <code>graphics/{{ mockup() }}.png</code>. Se programa en uno de los
          próximos pasos del prototipo.
        </p>
      </div>
    </section>
  `,
  styles: `
    :host { display: flex; flex-direction: column; height: 100%; }
    .top { height: 62px; border-bottom: 1px solid var(--color-border); background: var(--color-surface);
      display: flex; align-items: center; padding: 0 26px; flex-shrink: 0; }
    h1 { font-size: 20px; font-weight: 600; }
    .body { flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { max-width: 420px; text-align: center; background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-lg); padding: 32px 28px; display: flex; flex-direction: column; align-items: center;
      gap: 10px; --icon-size: 34px; color: var(--color-primary); }
    h2 { font-size: 17px; color: var(--color-text); }
    p { color: var(--color-text-muted); line-height: 1.5; }
    code { font-family: var(--font-mono); font-size: 12.5px; background: var(--color-canvas); padding: 1px 5px; border-radius: 5px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComingSoon {
  // Bound from the route data (withComponentInputBinding).
  readonly title = input('');
  readonly mockup = input('');
}
