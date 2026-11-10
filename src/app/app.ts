import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Theme } from './core/theme';
import { ConfirmHost } from './shared/ui/confirm';
import { ToastHost } from './shared/ui/toaster';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastHost, ConfirmHost],
  template: '<router-outlet /><app-toast-host /><app-confirm-host />',
})
export class App {
  // Light or dark from the first screen, following the system until the person chooses.
  protected readonly theme = inject(Theme);
}
