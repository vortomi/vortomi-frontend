import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmHost } from './shared/ui/confirm';
import { ToastHost } from './shared/ui/toaster';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastHost, ConfirmHost],
  template: '<router-outlet /><app-toast-host /><app-confirm-host />',
})
export class App {}
