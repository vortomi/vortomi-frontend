import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import type { ApiWabaLookup } from '../../shared/api/contract';
import type { ChannelAccount, Id } from '../../shared/api/models';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { PlatformData } from './platform.data';

type FoundNumber = ApiWabaLookup['numbers'][number];

/**
 * «Cambiar número» of a connected number, from the console: a number connected by mistake, or the
 * company's real number instead of a test one. The numbers come from Meta (never typed by hand); the
 * number keeps its place in Vortomi, so conversations, contacts and orders stay with the company.
 * The dialog itself is the confirmation: it says what changes before the button.
 */
@Component({
  selector: 'app-change-number-dialog',
  imports: [Dialog, Icon],
  template: `
    <app-dialog [open]="open()" [title]="'Cambiar el número ' + channel().label" [locked]="saving()" (closed)="closed.emit()">
      <p class="lead">Hoy: <b>{{ channel().displayNumber }}</b>. Elige el número correcto de la cuenta de WhatsApp de la empresa; Vortomi lo lee de Meta.</p>
      @if (error(); as message) {
        <div class="form-alert" role="alert"><app-icon name="alert" />{{ message }}</div>
      }
      <form class="search" (submit)="search($event)" novalidate>
        <div class="field">
          <label for="cn-waba">Identificador de la cuenta de WhatsApp</label>
          <input id="cn-waba" class="input mono" inputmode="numeric" autocomplete="off" [value]="wabaId()" (input)="wabaId.set(value($event))" />
        </div>
        <div class="field">
          <label for="cn-token">Token de acceso <span class="opt">opcional</span></label>
          <input id="cn-token" class="input mono" type="password" autocomplete="off" [value]="token()" (input)="token.set(value($event))" />
          <p class="field-hint">Vacío: se usa el acceso que ya está guardado para este número.</p>
        </div>
        <button type="submit" class="btn" [disabled]="searching() || !wabaId().trim()" [attr.aria-busy]="searching()"><app-icon name="search" /><span>Buscar números</span></button>
      </form>

      @if (found(); as list) {
        @if (list.wabaTakenBy) {
          <div class="form-alert" role="alert"><app-icon name="alert" />Esa cuenta de WhatsApp ya es de {{ list.wabaTakenBy }}.</div>
        } @else {
          <div class="numbers" role="radiogroup" aria-label="Números de la cuenta">
            @for (n of list.numbers; track n.phoneNumberId) {
              <button type="button" class="number" role="radio" [attr.aria-checked]="picked() === n.phoneNumberId" [class.on]="picked() === n.phoneNumberId"
                [disabled]="!!n.takenBy || isCurrent(n)" (click)="picked.set(n.phoneNumberId)">
                <span class="text"><b>{{ n.displayNumber }}</b><small>{{ n.verifiedName }}</small></span>
                @if (isCurrent(n)) { <span class="tag">Actual</span> }
                @else if (n.takenBy) { <span class="tag">Es de {{ n.takenBy }}</span> }
                @else if (n.alreadyHere) { <span class="tag">Ya es de esta empresa</span> }
              </button>
            } @empty {
              <p class="field-hint">Esa cuenta no tiene números.</p>
            }
          </div>
          <p class="form-alert warn"><app-icon name="info" />Las conversaciones, contactos y pedidos se quedan en la empresa. Desde el cambio, solo llegan los mensajes del número nuevo.</p>
        }
      }
      <ng-container dialog-actions>
        <button type="button" class="btn" [disabled]="saving()" (click)="closed.emit()">Cancelar</button>
        <button type="button" class="btn btn--primary" [disabled]="saving() || !picked()" [attr.aria-busy]="saving()" (click)="change()"><span>Cambiar número</span></button>
      </ng-container>
    </app-dialog>
  `,
  styles: `
    :host { --dialog-width: 600px; }
    .search { display: grid; grid-template-columns: 1fr 1fr auto; gap: 12px; align-items: start; }
    .search .btn { margin-top: 26px; }
    @media (max-width: 640px) { .search { grid-template-columns: 1fr; } .search .btn { margin-top: 0; } }
    .mono { font-family: var(--font-mono); }
    .numbers { display: flex; flex-direction: column; gap: 8px; }
    .number { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--color-border-strong); border-radius: var(--radius-md);
      background: var(--color-surface); color: var(--color-text); text-align: left; cursor: pointer; }
    .number:hover:not(:disabled) { border-color: var(--color-text-faint); }
    .number.on { border-color: var(--color-primary); box-shadow: 0 0 0 1px var(--color-primary); background: var(--color-primary-softer); }
    .number:disabled { opacity: 0.6; cursor: not-allowed; }
    .text { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .text b { font-size: 14px; } .text small { font-size: 12.5px; color: var(--color-text-muted); }
    .tag { font-size: 12px; color: var(--color-text-muted); background: var(--color-surface-hover); border-radius: 6px; padding: 2px 8px; }
  `,
})
export class ChangeNumberDialog {
  private readonly data = inject(PlatformData);

  readonly tenantId = input.required<Id>();
  readonly channel = input.required<ChannelAccount>();
  readonly open = input(false);
  readonly closed = output<void>();
  readonly changed = output<void>();

  protected readonly wabaId = signal('');
  protected readonly token = signal('');
  protected readonly found = signal<ApiWabaLookup | null>(null);
  protected readonly picked = signal<string | null>(null);
  protected readonly searching = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  /** The account searched last, so the change goes to that one even if the field is edited after. */
  private readonly searchedWaba = signal('');
  private readonly currentId = computed(() => this.channel().phoneNumberId);

  constructor() {
    // Each time it opens: the number's own account, nothing searched yet.
    effect(() => {
      if (!this.open()) return;
      const wabaId = this.channel().wabaId;
      untracked(() => {
        this.wabaId.set(wabaId);
        this.token.set('');
        this.found.set(null);
        this.picked.set(null);
        this.error.set(null);
      });
    });
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected isCurrent(number: FoundNumber): boolean {
    return number.phoneNumberId === this.currentId() && number.alreadyHere;
  }

  protected async search(event: Event): Promise<void> {
    event.preventDefault();
    if (this.searching() || !this.wabaId().trim()) return;
    this.searching.set(true);
    this.error.set(null);
    this.picked.set(null);
    const result = await this.data.lookupForChannel(this.tenantId(), this.channel().id, this.wabaId(), this.token());
    this.searching.set(false);
    if ('error' in result) {
      this.found.set(null);
      this.error.set(result.error);
      return;
    }
    this.found.set(result);
    this.searchedWaba.set(this.wabaId());
  }

  protected async change(): Promise<void> {
    const phoneNumberId = this.picked();
    if (!phoneNumberId || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    const failure = await this.data.replaceNumber(this.tenantId(), this.channel().id, { wabaId: this.searchedWaba(), phoneNumberId, accessToken: this.token() });
    this.saving.set(false);
    if (failure) this.error.set(failure);
    else this.changed.emit();
  }
}
