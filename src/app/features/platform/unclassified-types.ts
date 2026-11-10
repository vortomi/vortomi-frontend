import { Component, computed, inject, output, signal } from '@angular/core';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import { BusinessTypes } from '../../core/business-types';
import type { Id } from '../../shared/api/models';
import { Confirm } from '../../shared/ui/confirm';
import { SelectMenu } from '../../shared/ui/select-menu';
import { Toaster } from '../../shared/ui/toaster';
import { PlatformRemote, type UnclassifiedType } from './platform-remote';

/** "papeleria y libreria" → "Papeleria y libreria": a tidy starting label for the new type. */
const tidy = (text: string) => text.trim().charAt(0).toUpperCase() + text.trim().slice(1);

/**
 * «Rubros por clasificar» (block C): what companies wrote under «Otro», grouped. Our team turns
 * a group into a new type of the list, or moves its companies to one that exists. Server only:
 * the prototype has nothing to classify.
 */
@Component({
  selector: 'app-unclassified-types',
  imports: [SelectMenu],
  template: `
    @if (groups().length) {
      <section class="card box">
        <div class="head">
          <h2>Rubros por clasificar</h2>
          <span class="muted">Escritos por empresas que eligieron «Otro»</span>
        </div>
        @for (group of groups(); track group.text) {
          <div class="row">
            <div class="what">
              <b>{{ group.text }}</b>
              <span class="muted">{{ group.tenants.length }} · {{ names(group) }}</span>
            </div>
            <div class="actions">
              <button type="button" class="btn btn--primary btn--sm" [disabled]="busy()" (click)="create(group)"><span>Crear rubro «{{ tidy(group.text) }}»</span></button>
              <app-select-menu class="move" label="Mover a un rubro" placeholder="Mover a…" [searchable]="true" [disabled]="busy()" [options]="targets()"
                (picked)="move(group, $event)" />
            </div>
          </div>
        }
      </section>
    }
  `,
  styles: `
    :host { display: block; }
    .box { padding: 20px 22px; margin-bottom: 18px; }
    .head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
    .head h2 { font-size: 16px; font-weight: 600; }
    .muted { font-size: 13px; color: var(--color-text-muted); }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 12px 0;
      border-top: 1px solid var(--color-border); }
    .what { display: flex; flex-direction: column; gap: 2px; }
    .actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .move { width: 240px; }
  `,
})
export class UnclassifiedTypes {
  private readonly remote = inject(API_CONFIG).mode === 'api' ? inject(PlatformRemote) : null;
  private readonly businessTypes = inject(BusinessTypes);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(Confirm);
  /** Companies changed type: the list of companies should be read again. */
  readonly changed = output<void>();

  protected readonly groups = signal<UnclassifiedType[]>([]);
  protected readonly busy = signal(false);
  protected readonly tidy = tidy;
  /** Every type but «Otro» itself. */
  protected readonly targets = computed(() => this.businessTypes.options().filter((o) => o.value !== 'other'));

  constructor() {
    void this.load();
  }

  protected names(group: UnclassifiedType): string {
    return group.tenants.map((t) => t.name).join(', ');
  }

  protected create(group: UnclassifiedType): Promise<void> {
    const count = group.tenants.length;
    const question = {
      title: `¿Crear el rubro «${tidy(group.text)}»?`,
      message: `Se agrega a la lista de rubros y ${count === 1 ? 'su empresa pasa' : `sus ${count} empresas pasan`} a tenerlo.`,
      confirmLabel: 'Crear rubro',
    };
    return this.run(question, async (remote) => {
      const type = await remote.createBusinessType(tidy(group.text), this.ids(group));
      return `Rubro «${type.label}» creado; ${group.tenants.length === 1 ? 'su empresa ya lo tiene' : 'sus empresas ya lo tienen'}.`;
    });
  }

  protected move(group: UnclassifiedType, code: string): Promise<void> {
    const count = group.tenants.length;
    const question = {
      title: `¿Mover a «${this.businessTypes.labelOf(code)}»?`,
      message: `${count === 1 ? 'La empresa que escribió' : `Las ${count} empresas que escribieron`} «${group.text}» ${count === 1 ? 'pasa' : 'pasan'} a ese rubro.`,
      confirmLabel: 'Mover',
    };
    return this.run(question, async (remote) => {
      const { moved } = await remote.reclassify(code, this.ids(group));
      return `${moved} ${moved === 1 ? 'empresa movida' : 'empresas movidas'} a «${this.businessTypes.labelOf(code)}».`;
    });
  }

  private ids(group: UnclassifiedType): Id[] {
    return group.tenants.map((t) => t.id);
  }

  /** Asks first; the dialog shows the circle while the server works, and its error if it fails. */
  private async run(question: { title: string; message: string; confirmLabel: string }, work: (remote: PlatformRemote) => Promise<string>): Promise<void> {
    const remote = this.remote;
    if (!remote || this.busy()) return;
    this.busy.set(true);
    let done = '';
    try {
      const yes = await this.confirm.ask({ ...question, action: async () => (done = await work(remote)) });
      if (!yes) return;
      this.toaster.show(done);
      await Promise.all([this.load(), this.businessTypes.reload()]);
      this.changed.emit();
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
    } finally {
      this.busy.set(false);
    }
  }

  private async load(): Promise<void> {
    if (!this.remote) return;
    try {
      this.groups.set(await this.remote.unclassified());
    } catch {
      // Secondary: the list of companies still works without it.
    }
  }
}
