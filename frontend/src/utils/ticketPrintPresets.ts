import type { TicketPrintPreset } from '@/types'

export const DEFAULT_TICKET_PRINT_PRESET: TicketPrintPreset = 'large'

export const ticketPrintPresetOptions: Array<{ label: string; value: TicketPrintPreset }> = [
  { label: 'Стандартные, 2 колонки', value: 'large' },
  { label: 'Компактные, 2 колонки', value: 'compact' },
]
