import type { AuditLogEntry, Student, User } from '@/types'

import { demoUsers, type MockDatabase, type MockUser } from './data'
import { readMockDb, writeMockDb } from './store'

export { demoUsers }

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function mutateDb<T>(mutator: (nextDb: MockDatabase) => T): T {
  const nextDb = clone(readMockDb())
  const result = mutator(nextDb)
  writeMockDb(nextDb)
  return result
}

export function uid(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatTime(date = new Date()): string {
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date)
}

export function buildBuildingName(buildingId?: number | null): string | null {
  if (!buildingId) {
    return null
  }

  const labels: Record<number, string> = {
    1: 'Корпус 1, Ленина, д.9',
    2: 'Корпус 2, Яковлева, д.17',
    3: 'Корпус 3, Яковлева, д.20/1',
    4: 'Корпус 4, Пр. Мира, д.40',
    5: 'Корпус 5, пр. Тракторостроителей, д.99',
  }

  return labels[buildingId] ?? `Корпус ${buildingId}`
}

export function normalizeQuery(value?: string): string {
  return (value ?? '').trim().toLowerCase()
}

export function normalizeUsername(value?: string | null): string {
  return (value ?? '').trim().toLowerCase()
}

export function sanitizeUser(user: MockUser): User {
  const { password, ...safeUser } = user
  return safeUser
}

function getTokenUserId(token?: string | null): string | null {
  if (!token) {
    return null
  }
  const parts = token.split('.')
  return parts.length >= 2 ? (parts[1] ?? null) : null
}

export function requireUser(token?: string | null, db = readMockDb()): MockUser {
  const userId = getTokenUserId(token)
  const user = db.users.find((item) => item.id === userId)
  if (!user) {
    throw new Error('Пользователь не найден')
  }
  if (!user.is_active) {
    throw new Error('Пользователь отключен')
  }
  return user
}

export function requirePrivilegedUser(token?: string | null, db = readMockDb()): MockUser {
  const user = requireUser(token, db)
  if (!['head_social', 'admin'].includes(user.role)) {
    throw new Error('Недостаточно прав')
  }
  return user
}

export function ensureBuildingAccess(user: Pick<User, 'role' | 'building_id'>, buildingId?: number | null): void {
  if (buildingId == null) {
    return
  }

  if ((user.role === 'social' || user.role === 'cashier') && user.building_id !== buildingId) {
    throw new Error('Р”РѕСЃС‚СѓРї Рє РєРѕСЂРїСѓСЃСѓ Р·Р°РїСЂРµС‰РµРЅ')
  }
}

export function matchesVisibleToSocialBuilding(
  student: Pick<Student, 'building_id' | 'meal_building_id'>,
  buildingId?: number | null,
): boolean {
  return buildingId != null && (student.building_id === buildingId || student.meal_building_id === buildingId)
}

export function matchesAssignedToMealBuilding(
  student: Pick<Student, 'building_id' | 'meal_building_id'>,
  buildingId?: number | null,
): boolean {
  return (
    buildingId != null &&
    (student.meal_building_id === buildingId || (student.meal_building_id == null && student.building_id === buildingId))
  )
}

export function hasStudentAccess(
  user: Pick<User, 'role' | 'building_id'>,
  student: Pick<Student, 'building_id' | 'meal_building_id' | 'allow_all_meal_buildings'>,
): boolean {
  if (user.role === 'social') {
    return matchesVisibleToSocialBuilding(student, user.building_id)
  }

  if (user.role === 'cashier') {
    return matchesAssignedToMealBuilding(student, user.building_id)
  }

  return true
}

export function hasStudentManagementAccess(
  user: Pick<User, 'role' | 'building_id'>,
  student: Pick<Student, 'building_id' | 'meal_building_id' | 'allow_all_meal_buildings'>,
): boolean {
  if (user.role === 'social') {
    return user.building_id === student.building_id
  }

  return hasStudentAccess(user, student)
}

export function ensureStudentManagementAccess(
  user: Pick<User, 'role' | 'building_id'>,
  student: Pick<Student, 'building_id' | 'meal_building_id' | 'allow_all_meal_buildings'>,
): void {
  if (!hasStudentManagementAccess(user, student)) {
    throw new Error('Р”РѕСЃС‚СѓРї Рє СЃС‚СѓРґРµРЅС‚Сѓ Р·Р°РїСЂРµС‰РµРЅ')
  }
}

export function appendLog(nextDb: MockDatabase, entry: Omit<AuditLogEntry, 'id' | 'created_at'>): AuditLogEntry {
  const log: AuditLogEntry = {
    id: (nextDb.logs[0]?.id ?? 0) + 1,
    created_at: new Date().toISOString(),
    ...entry,
  }
  nextDb.logs.unshift(log)
  return log
}

export function buildCsvBlob(rows: string[][]): Blob {
  const content = rows
    .map((row) => row.map((cell) => `"${String(cell ?? '').split('"').join('""')}"`).join(';'))
    .join('\n')
  return new Blob([`\uFEFF${content}`], { type: 'application/vnd.ms-excel;charset=utf-8;' })
}
