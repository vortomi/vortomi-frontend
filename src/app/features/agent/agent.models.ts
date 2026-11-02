import type { AgentSchedule, AgentTone, HandoffReason } from '../../shared/api/models';
import type { OptionCard } from '../../shared/ui/option-cards';

export const TONE_OPTIONS: (OptionCard & { value: AgentTone })[] = [
  { value: 'friendly', label: 'Cercano', icon: 'chat', hint: 'Cálido, como un buen vendedor' },
  { value: 'formal', label: 'Formal', icon: 'building', hint: 'Trata de usted' },
  { value: 'brief', label: 'Breve', icon: 'bolt', hint: 'Una o dos frases' },
];

export const SCHEDULE_OPTIONS: (OptionCard & { value: AgentSchedule })[] = [
  { value: 'always', label: 'Siempre', icon: 'clock', hint: 'Las 24 horas' },
  { value: 'after_hours', label: 'Solo fuera de horario', icon: 'lock', hint: 'Cuando la empresa está cerrada' },
];

/** Why the agent passed a conversation to a person, as the inbox says it. */
export const HANDOFF_LABEL: Record<HandoffReason, string> = {
  purchase: 'Quiere comprar',
  order_placed: 'Pedido listo',
  customer_asked: 'Pidió una persona',
  agent_unsure: 'El agente no supo responder',
  agent_error: 'El agente no pudo responder',
  limit_reached: 'Se llegó al tope del mes',
};
