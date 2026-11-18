import { ChangeDetectionStrategy, Component, ElementRef, inject, input, signal } from '@angular/core';
import { Icon } from './icon';

/**
 * The ⋯ button of a table row and its menu (mockups web-28 and web-30). The items are projected
 * buttons (role="menuitem", a <b> title and a <small> line; class "danger" for the last, risky one);
 * choosing one, clicking elsewhere or pressing Escape closes it. Styles: .row-menu in _components.scss.
 */
@Component({
  selector: 'app-row-menu',
  imports: [Icon],
  template: `
    <button type="button" class="row-menu__dots" [attr.aria-label]="label()" [attr.aria-expanded]="open()" (click)="open.set(!open())">
      <app-icon name="dots" />
    </button>
    @if (open()) {
      <div class="row-menu__list" role="menu" (click)="open.set(false)">
        <ng-content />
      </div>
    }
  `,
  host: { class: 'row-menu', '(document:click)': 'outside($event)', '(document:keydown.escape)': 'open.set(false)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RowMenu {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** «Acciones sobre Carlos Ruiz», for screen readers. */
  readonly label = input.required<string>();
  protected readonly open = signal(false);

  protected outside(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
}
