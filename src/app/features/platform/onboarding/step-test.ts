import { Component, computed, inject } from '@angular/core';
import { Icon } from '../../../shared/ui/icon';
import { OnboardingState } from './onboarding.state';

/** Step 3 (mockup web-11): the customer writes first and we follow the message to its company. */
@Component({
  selector: 'app-step-test',
  imports: [Icon],
  template: `
    <div class="step-body">
      <div class="col">
        <section class="card sec">
          <h2>Prueba de ida y vuelta</h2>
          <p class="d">
            Alguien escribe desde un teléfono de prueba al número recién conectado. La consola sigue ese mensaje hasta ver en qué
            bandeja cae y contesta desde el número.
          </p>
          @if (state.error(); as message) {
            <div class="form-alert" role="alert"><app-icon name="alert" />{{ message }}</div>
          }
          @if (state.testStatus() === 'idle') {
            <div class="start">
              @if (state.real) {
                <p>Pulsa el botón y después pide al cliente que escriba <b>«Hola, prueba de conexión»</b> al {{ number() }}. La consola espera hasta 5 minutos a que llegue.</p>
                <button type="button" class="btn btn--primary" (click)="state.runTest()"><app-icon name="send" />Empezar a esperar el mensaje</button>
              } @else {
                <p>Pide al cliente que escriba <b>«Hola, prueba de conexión»</b> al {{ number() }} y pulsa el botón.</p>
                <button type="button" class="btn btn--primary" (click)="state.runTest()"><app-icon name="send" />Iniciar prueba</button>
              }
            </div>
          } @else {
            <h3 class="trace-title">Recorrido del mensaje</h3>
            <ol class="trace">
              @for (event of state.testEvents(); track event.title) {
                <li [class.key]="event.key">
                  <span class="ic"><app-icon [name]="event.icon" [stroke]="2.2" /></span>
                  <span><b>{{ event.title }}</b><small>{{ event.detail }}</small></span>
                </li>
              }
              @if (state.testStatus() === 'running') {
                <li class="waiting"><span class="ic"><app-icon name="clock" /></span><span><small>Esperando…</small></span></li>
              }
            </ol>
          }
        </section>
      </div>
      <div class="col">
        @if (state.testStatus() === 'passed') {
          <section class="card sec passed">
            <span class="big"><app-icon name="check" [stroke]="3" /></span>
            <span><b>Prueba superada</b><small>El mensaje llegó a esta empresa y a ninguna otra</small></span>
          </section>
        }
        <section class="card sec">
          <h2>Qué se comprueba</h2>
          <p class="d">Si algo falla, la empresa queda en «Esperando canal» y no se activa.</p>
          <ul class="checklist">
            <li>Sus mensajes nos llegan</li>
            <li>Caen en la empresa correcta</li>
            <li>Podemos responder desde su número</li>
            <li>Los estados (entregado, leído) se registran</li>
          </ul>
        </section>
        <div class="form-alert info">
          <app-icon name="dollar" />
          <span>La prueba empieza con un mensaje <b>del cliente</b> a propósito: así la respuesta entra en las 1.000 gratis del mes que Meta da a cada número. Si la empezáramos nosotros haría falta una plantilla, que se cobra desde el primer envío y necesita método de pago.</span>
        </div>
      </div>
    </div>
    <footer class="step-foot">
      <span class="count">Paso 3 de 4</span>
      <button type="button" class="btn" (click)="state.goTo(1)" [disabled]="state.testStatus() === 'running'">Atrás</button>
      @if (state.testStatus() === 'passed') {
        <button type="button" class="btn" (click)="state.runTest()">Repetir prueba</button>
      }
      <button type="button" class="btn btn--primary" [disabled]="state.testStatus() !== 'passed'" (click)="state.goTo(3)">
        Siguiente: activar<app-icon name="arrow" />
      </button>
    </footer>
  `,
  styleUrl: './steps.scss',
  styles: `
    .start { display: flex; flex-direction: column; gap: 12px; align-items: flex-start; font-size: 13.5px; }
    .trace-title { font-size: 11px; letter-spacing: .5px; text-transform: uppercase; color: var(--color-text-faint); margin-bottom: 10px; }
    .trace { list-style: none; display: flex; flex-direction: column; }
    .trace li { display: flex; gap: 12px; position: relative; padding-bottom: 13px; }
    .trace li::before { content: ''; position: absolute; left: 13px; top: 28px; bottom: 0; width: 2px; background: #d7efe4; }
    .trace li:last-child::before { display: none; }
    .ic { width: 28px; height: 28px; border-radius: 50%; background: #e3f6ea; color: #166534; display: flex; align-items: center;
      justify-content: center; flex-shrink: 0; --icon-size: 15px; }
    .key .ic { background: var(--color-primary); color: #fff; }
    .key b { color: #26338f; }
    .waiting .ic { background: #eef0f3; color: var(--color-text-faint); }
    .trace b, .passed b { display: block; font-size: 13px; }
    .trace small, .passed small { font-size: 12.3px; color: var(--color-text-muted); }
    .passed { display: flex; align-items: center; gap: 12px; }
    .big { width: 42px; height: 42px; border-radius: 50%; background: var(--color-success); color: #fff; display: flex;
      align-items: center; justify-content: center; --icon-size: 22px; }
    .passed b { font-size: 16px; }
    .checklist { padding-left: 18px; font-size: 13px; line-height: 1.8; }
  `,
})
export class StepTest {
  protected readonly state = inject(OnboardingState);
  protected readonly number = computed(() => this.state.channel()?.number.displayNumber ?? 'número');
}
