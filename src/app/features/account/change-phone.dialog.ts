import { Component, inject, output, signal } from '@angular/core';
import { DomSanitizer, type SafeUrl } from '@angular/platform-browser';
import { type Enrollment, SecondFactor } from '../../core/second-factor';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';

type Step = 'confirm' | 'scan' | 'activate' | 'done';

/** Keeps the six digits of an authenticator code. */
const digitsOf = (event: Event) => (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6);

/**
 * «Cambiar de teléfono» (mockup web-29, step 2): confirm with the current phone's code, scan a new
 * QR with the new phone, confirm its code. Only then the old phone stops working; if anything fails
 * on the way, the old one keeps working and the unconfirmed new code is thrown away.
 */
@Component({
  selector: 'app-change-phone-dialog',
  imports: [Dialog, Icon],
  template: `
    <app-dialog [title]="title()" [open]="true" [locked]="busy()" (closed)="close()">
      @if (error(); as message) {
        <div class="form-alert" role="alert"><app-icon name="alert" />{{ message }}</div>
      }
      @switch (step()) {
        @case ('confirm') {
          <p class="lead">Escribe el código de 6 números que muestra ahora tu app de autenticación, en tu teléfono <b>actual</b>.</p>
          <input class="input code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" aria-label="Código actual" [value]="code()" (input)="code.set(digits($event))" />
        }
        @case ('scan') {
          <p class="lead">Abre tu app de autenticación en el teléfono <b>nuevo</b> y escanea este código. La cuenta aparece como <b>Vortomi</b>.</p>
          <img class="qr" [src]="qr()" alt="Código para escanear con el teléfono nuevo" width="180" height="180" />
          <p class="field-hint center">¿No puedes escanear? Clave: <span class="mono">{{ enrollment()?.secret }}</span></p>
        }
        @case ('activate') {
          <p class="lead">Escribe el código que muestra ahora el teléfono <b>nuevo</b>. Al confirmarlo, el teléfono anterior deja de servir.</p>
          <input class="input code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" aria-label="Código nuevo" [value]="code()" (input)="code.set(digits($event))" />
        }
        @case ('done') {
          <p class="form-alert ok"><app-icon name="check" />Listo. Desde ahora, el código de seguridad es el de tu teléfono nuevo.</p>
        }
      }
      <ng-container dialog-actions>
        @switch (step()) {
          @case ('confirm') {
            <button type="button" class="btn" (click)="close()"><span>Cancelar</span></button>
            <button type="button" class="btn btn--primary" [disabled]="busy() || code().length !== 6" [attr.aria-busy]="busy()" (click)="confirmCurrent()"><span>Continuar</span></button>
          }
          @case ('scan') {
            <button type="button" class="btn" (click)="close()"><span>Cancelar</span></button>
            <button type="button" class="btn btn--primary" (click)="toActivate()"><span>Ya lo escaneé</span></button>
          }
          @case ('activate') {
            <button type="button" class="btn" [disabled]="busy()" (click)="step.set('scan')"><span>Atrás</span></button>
            <button type="button" class="btn btn--primary" [disabled]="busy() || code().length !== 6" [attr.aria-busy]="busy()" (click)="activate()"><span>Confirmar</span></button>
          }
          @case ('done') {
            <button type="button" class="btn btn--primary" (click)="close()"><span>Terminar</span></button>
          }
        }
      </ng-container>
    </app-dialog>
  `,
  styles: `
    .code { max-width: 180px; font-size: 22px; letter-spacing: 0.3em; text-align: center; }
    .qr { display: block; margin: 4px auto; border-radius: var(--radius-md); background: #fff; padding: 8px; }
    .center { text-align: center; }
    .mono { font-family: var(--font-mono); }
  `,
})
export class ChangePhoneDialog {
  private readonly secondFactor = inject(SecondFactor);
  private readonly sanitizer = inject(DomSanitizer);
  readonly closed = output<boolean>();

  protected readonly step = signal<Step>('confirm');
  protected readonly code = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly enrollment = signal<Enrollment | null>(null);
  protected readonly qr = signal<SafeUrl>('');
  protected readonly digits = digitsOf;

  protected title(): string {
    const n = { confirm: 1, scan: 2, activate: 3, done: 3 }[this.step()];
    return this.step() === 'done' ? 'Cambiar de teléfono' : `Cambiar de teléfono · paso ${n} de 3`;
  }

  /** Step 1: the current phone proves it is this person; then the new code is prepared. */
  protected async confirmCurrent(): Promise<void> {
    await this.work(async () => {
      if (!(await this.secondFactor.verify(this.code()))) return this.error.set('Ese código no coincide. Mira de nuevo tu app y escríbelo antes de que cambie.');
      const enrollment = await this.secondFactor.enroll();
      this.enrollment.set(enrollment);
      // Supabase gives the QR as an SVG data URL made by itself, never from user input.
      this.qr.set(this.sanitizer.bypassSecurityTrustUrl(enrollment.qrCode));
      this.code.set('');
      this.step.set('scan');
    });
  }

  protected toActivate(): void {
    this.error.set(null);
    this.code.set('');
    this.step.set('activate');
  }

  /** Step 3: the new phone's code; only now the old one is forgotten. */
  protected async activate(): Promise<void> {
    const enrollment = this.enrollment();
    if (!enrollment) return;
    await this.work(async () => {
      if (!(await this.secondFactor.replaceWith(enrollment.factorId, this.code()))) return this.error.set('Ese código no coincide. Usa el que muestra el teléfono nuevo.');
      this.enrollment.set(null);
      this.step.set('done');
    });
  }

  protected close(): void {
    const pending = this.enrollment();
    // Half way: the new code was never confirmed, so it is thrown away and the old phone stays.
    if (pending) void this.secondFactor.discard(pending.factorId).catch(() => undefined);
    this.closed.emit(this.step() === 'done');
  }

  private async work(run: () => Promise<unknown>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await run();
    } catch {
      this.error.set('No se pudo completar. Tu código anterior sigue funcionando; intenta de nuevo.');
    } finally {
      this.busy.set(false);
    }
  }
}
