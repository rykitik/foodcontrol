import type { Ticket } from '@/types'

export type StudentTicketTone = 'active' | 'warning' | 'neutral' | 'muted'

export interface StudentTicketStatePresentation {
  title: string
  tone: StudentTicketTone
}

export interface StudentTicketActionPresentation {
  title: string
  description: string
  tone: 'action' | 'warning' | 'neutral'
}

export function getStudentTicketListNote(ticket: Ticket): string {
  if (ticket.status === 'expired') {
    return 'Период завершён'
  }

  if (ticket.status === 'cancelled') {
    return 'Архив'
  }

  if (ticket.is_locked) {
    return 'Есть выдачи'
  }

  if (ticket.status === 'active') {
    return 'Без выдач'
  }

  return 'Завершён'
}

export function canCancelStudentTicket(ticket: Ticket | null | undefined, canManageTickets: boolean): boolean {
  return Boolean(canManageTickets && ticket?.status === 'active' && !ticket?.is_locked)
}

export function getStudentTicketState(ticket: Ticket): StudentTicketStatePresentation {
  if (ticket.status === 'cancelled') {
    return {
      title: 'Талон отменён',
      tone: 'muted',
    }
  }

  if (ticket.status === 'expired') {
    return {
      title: 'Срок действия завершён',
      tone: 'neutral',
    }
  }

  if (ticket.status === 'active' && ticket.is_locked) {
    return {
      title: 'По талону уже есть выдачи',
      tone: 'warning',
    }
  }

  if (ticket.status === 'active') {
    return {
      title: 'Талон действует',
      tone: 'active',
    }
  }

  return {
    title: 'Талон завершён',
    tone: 'neutral',
  }
}

export function getStudentTicketAction(
  ticket: Ticket,
  canManageTickets: boolean,
): StudentTicketActionPresentation | null {
  if (canCancelStudentTicket(ticket, canManageTickets)) {
    return {
      title: 'Можно отменить',
      description: 'Пока выдач нет, отмена доступна.',
      tone: 'action',
    }
  }

  if (canManageTickets && ticket.status === 'active' && ticket.is_locked) {
    return {
      title: 'Отмена недоступна',
      description: 'По талону уже есть выдачи. Чтобы прекратить питание, измените дату окончания талона.',
      tone: 'warning',
    }
  }

  return null
}
