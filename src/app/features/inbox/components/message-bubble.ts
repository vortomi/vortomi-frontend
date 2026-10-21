import { Component, computed, input } from '@angular/core';
import type { Message, MessageStatus } from '../../../shared/api/models';
import { formatTime } from '../../../shared/format/date-time';
import { Icon, type IconName } from '../../../shared/ui/icon';

/** WhatsApp's ticks, with the word next to them so nobody has to guess what each one means. */
const STATUS_MARK: Record<MessageStatus, { icon: IconName; label: string }> = {
  pending: { icon: 'clock', label: 'Enviando' },
  sent: { icon: 'check', label: 'Enviado' },
  delivered: { icon: 'checks', label: 'Recibido' },
  read: { icon: 'checks', label: 'Leído' },
  failed: { icon: 'alert', label: 'No se entregó' },
};

@Component({
  selector: 'app-message-bubble',
  imports: [Icon],
  template: `
    @let msg = message();
    @if (msg.direction === 'outbound' && author()) {
      <span class="author">{{ author() }}</span>
    }
    @if (msg.type === 'product') {
      <span class="product"><app-icon name="tag" /><span>{{ msg.body }}</span></span>
    } @else if (msg.type === 'image') {
      <span class="media"><app-icon name="image" />Foto</span>
    } @else {
      <p>{{ msg.body }}</p>
    }
    <small>
      {{ time() }}
      @if (status(); as s) {
        <span class="status" [class]="msg.status"><app-icon [name]="s.icon" [stroke]="2.2" />{{ s.label }}</span>
      }
    </small>
  `,
  host: {
    '[class]': 'message().direction',
    '[class.template]': "message().type === 'template'",
    '[class.product-msg]': "message().type === 'product'",
  },
  styleUrl: './message-bubble.scss',
})
export class MessageBubble {
  readonly message = input.required<Message>();
  /** Agent name, or the template label for template messages. */
  readonly author = input<string>('');
  readonly timezone = input.required<string>();

  protected readonly time = computed(() => formatTime(this.message().createdAt, this.timezone()));
  protected readonly status = computed(() => {
    const status = this.message().status;
    return status ? STATUS_MARK[status] : undefined;
  });
}
