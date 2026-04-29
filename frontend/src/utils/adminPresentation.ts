import { roleLabels } from '@/config/navigation'
import type { UserRole } from '@/types'

const moscowDateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Moscow',
})

const moscowDateFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'Europe/Moscow',
})

export type AdminRoleTone = 'blue' | 'violet' | 'orange' | 'green' | 'slate'

export const adminRoleTone: Record<UserRole, AdminRoleTone> = {
  admin: 'blue',
  head_social: 'violet',
  accountant: 'orange',
  cashier: 'green',
  social: 'slate',
}

export function getAdminRoleLabel(role: UserRole): string {
  return roleLabels[role]
}

export function formatAdminDateTime(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }

  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) {
    return value
  }

  return moscowDateTimeFormatter.format(new Date(timestamp))
}

export function toMoscowDateKey(value: string | Date): string {
  const target = typeof value === 'string' ? new Date(value) : value
  return moscowDateFormatter.format(target)
}

const auditActionLabels: Record<string, string> = {
  login: 'Вход в систему',
  login_failed: 'Неудачная попытка входа',
  logout: 'Выход из системы',
  create_user: 'Создание пользователя',
  update_user: 'Обновление пользователя',
  toggle_user: 'Изменение статуса пользователя',
  create_student: 'Создание студента',
  update_student: 'Обновление студента',
  toggle_student: 'Изменение статуса студента',
  import_students: 'Импорт студентов',
  issue_ticket: 'Выдача талона',
  cancel_ticket: 'Отмена талона',
  reissue_ticket: 'Перевыпуск талона',
  record_meal: 'Фиксация питания',
  build_meal_sheet_document: 'Подготовка ведомости выдачи',
  generate_accounting_document: 'Подготовка учетного документа',
  export_accounting_document_xlsx: 'Экспорт учетного документа в Excel',
  save_accounting_document_metadata: 'Сохранение реквизитов документа',
  reset_accounting_document_metadata: 'Сброс реквизитов документа',
  save_accounting_document_global_metadata: 'Сохранение общих реквизитов',
  reset_accounting_document_global_metadata: 'Сброс общих реквизитов',
}

const auditEntityLabels: Record<string, string> = {
  user: 'Пользователь',
  student: 'Студент',
  category: 'Категория',
  ticket: 'Талон',
  meal: 'Питание',
  import: 'Импорт',
  holiday: 'Календарь',
  report: 'Отчет',
  accounting_document: 'Учетный документ',
  system: 'Система',
}

const auditDetailKeyLabels: Record<string, string> = {
  username: 'Логин',
  reason: 'Причина',
  full_name: 'ФИО',
  category: 'Категория',
  category_id: 'Категория',
  category_code: 'Код категории',
  building_id: 'Корпус',
  group_name: 'Группа',
  ticket_id: 'Талон',
  student_id: 'Студент',
  count: 'Количество',
  month: 'Месяц',
  year: 'Год',
  meal_type: 'Прием пищи',
  document_kind: 'Документ',
  field_count: 'Полей',
  keys: 'Ключи',
  status: 'Статус',
}

function prettifyToken(value: string): string {
  if (!value) {
    return '—'
  }

  const normalized = value.replace(/[_-]+/g, ' ').trim()
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function formatAuditDetailValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value.slice(0, 3).map((item) => formatAuditDetailValue(item)).join(', ')
  }

  return 'Сложные данные'
}

export function formatAuditActionLabel(value: string): string {
  return auditActionLabels[value] ?? prettifyToken(value)
}

export function formatAuditEntityLabel(value: string | null | undefined): string {
  if (!value) {
    return 'Система'
  }

  return auditEntityLabels[value] ?? prettifyToken(value)
}

export function formatAuditDetailsSummary(details: Record<string, unknown> | null | undefined): string {
  const entries = Object.entries(details ?? {}).filter(([, value]) => value !== null && value !== undefined && value !== '')
  if (!entries.length) {
    return 'Без дополнительных данных'
  }

  return entries
    .slice(0, 2)
    .map(([key, value]) => `${auditDetailKeyLabels[key] ?? prettifyToken(key)}: ${formatAuditDetailValue(value)}`)
    .join(' · ')
}

export function formatAuditDetailsList(details: Record<string, unknown> | null | undefined): Array<{ label: string; value: string }> {
  return Object.entries(details ?? {})
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => ({
      label: auditDetailKeyLabels[key] ?? prettifyToken(key),
      value: formatAuditDetailValue(value),
    }))
}

export function isAuditAttentionAction(action: string): boolean {
  return [
    'login_failed',
    'toggle_user',
    'toggle_student',
    'delete_holiday',
    'archive_category',
    'reset_accounting_document_metadata',
    'reset_accounting_document_global_metadata',
  ].includes(action)
}
