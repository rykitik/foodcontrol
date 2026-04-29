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
  provision_cashier_terminal: 'Подключение терминала кассира',
  issue_cashier_offline_grant: 'Выдача офлайн-доступа кассиру',
  create_user: 'Создание пользователя',
  update_user: 'Обновление пользователя',
  toggle_user: 'Изменение статуса пользователя',
  create_student: 'Создание студента',
  update_student: 'Обновление студента',
  toggle_student: 'Изменение статуса студента',
  import_students: 'Импорт студентов',
  create_category: 'Создание категории',
  update_category: 'Обновление категории',
  archive_category: 'Удаление категории',
  create_holiday: 'Добавление даты в календарь',
  create_holiday_bulk: 'Массовое добавление дат в календарь',
  update_holiday: 'Обновление даты календаря',
  delete_holiday: 'Удаление даты из календаря',
  create_ticket: 'Создание талона',
  create_ticket_bulk_item: 'Создание талона в пакетной выдаче',
  create_ticket_bulk: 'Пакетная выдача талонов',
  clone_ticket_from_previous_item: 'Создание талона из прошлого месяца',
  clone_ticket_from_previous: 'Перенос талонов из прошлого месяца',
  issue_ticket: 'Выдача талона',
  cancel_ticket: 'Отмена талона',
  reissue_ticket: 'Перевыпуск талона',
  update_ticket: 'Обновление талона',
  update_ticket_end_date: 'Изменение срока действия талона',
  print_ticket: 'Печать талона',
  print_ticket_sheet: 'Печать листа талонов',
  print_ticket_receipt_sheet: 'Печать ведомости получения талонов',
  export_ticket_journal_xlsx: 'Экспорт журнала талонов в Excel',
  record_meal: 'Фиксация питания',
  record_meal_batch: 'Групповая фиксация питания',
  confirm_meal_selection: 'Подтверждение выбранного питания',
  offline_sync_meals: 'Синхронизация офлайн-операций',
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
  ticket_batch: 'Пакет талонов',
  ticket_export: 'Экспорт талонов',
  meal: 'Питание',
  meal_record: 'Операция питания',
  import: 'Импорт',
  holiday: 'Календарь',
  holiday_batch: 'Пакет календаря',
  report: 'Отчет',
  accounting_document: 'Учетный документ',
  cashier_terminal: 'Терминал кассира',
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
  previous_ticket_id: 'Предыдущий талон',
  student_id: 'Студент',
  student_ids: 'Студенты',
  count: 'Количество',
  rows: 'Записей',
  month: 'Месяц',
  year: 'Год',
  source_month: 'Исходный месяц',
  source_year: 'Исходный год',
  target_month: 'Целевой месяц',
  target_year: 'Целевой год',
  meal_type: 'Прием пищи',
  document_kind: 'Документ',
  print_size: 'Формат печати',
  field_count: 'Полей',
  keys: 'Ключи',
  status: 'Статус',
  previous_status: 'Предыдущий статус',
  holiday_date: 'Дата',
  start_date: 'Начало периода',
  end_date: 'Конец периода',
  previous_end_date: 'Прежняя дата окончания',
  period_start: 'Период от',
  period_end: 'Период до',
  expires_at: 'Действует до',
  grant_id: 'Идентификатор доступа',
  grant_jti: 'Ключ доступа',
  request_id: 'Запрос',
  total_amount: 'Сумма',
  created_count: 'Создано талонов',
  created_student_count: 'Студентов с талонами',
  created: 'Создано',
  updated: 'Обновлено',
  skipped_count: 'Пропущено студентов',
  period_segments_count: 'Сегментов периода',
  skipped: 'Пропущено',
}

const auditValueLabelsByKey: Record<string, Record<string, string>> = {
  reason: {
    invalid_credentials: 'Неверный логин или пароль',
    user_disabled: 'Пользователь отключен',
  },
  meal_type: {
    breakfast: 'Завтрак',
    lunch: 'Обед',
  },
  document_kind: {
    meal_sheet: 'Ведомость питания',
    cost_statement: 'Свод затрат',
    cost_calculation: 'Калькуляция стоимости',
  },
  print_size: {
    large: 'Крупный',
    compact: 'Компактный',
  },
  status: {
    active: 'Активен',
    used: 'Использован',
    expired: 'Истек',
    cancelled: 'Отменен',
  },
  previous_status: {
    active: 'Активен',
    used: 'Использован',
    expired: 'Истек',
    cancelled: 'Отменен',
  },
}

function prettifyToken(value: string): string {
  if (!value) {
    return '—'
  }

  const normalized = value.replace(/[_-]+/g, ' ').trim()
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function formatAuditDetailValue(value: unknown, key?: string): string {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    if (typeof value === 'string' && key) {
      const translated = auditValueLabelsByKey[key]?.[value]
      if (translated) {
        return translated
      }
    }
    return String(value)
  }

  if (Array.isArray(value)) {
    return value.slice(0, 3).map((item) => formatAuditDetailValue(item, key)).join(', ')
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
    .map(([key, value]) => `${auditDetailKeyLabels[key] ?? prettifyToken(key)}: ${formatAuditDetailValue(value, key)}`)
    .join(' · ')
}

export function formatAuditDetailsList(details: Record<string, unknown> | null | undefined): Array<{ label: string; value: string }> {
  return Object.entries(details ?? {})
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => ({
      label: auditDetailKeyLabels[key] ?? prettifyToken(key),
      value: formatAuditDetailValue(value, key),
    }))
}

export function isAuditAttentionAction(action: string): boolean {
  return [
    'login_failed',
    'toggle_user',
    'toggle_student',
    'delete_holiday',
    'archive_category',
    'cancel_ticket',
    'reset_accounting_document_metadata',
    'reset_accounting_document_global_metadata',
  ].includes(action)
}
