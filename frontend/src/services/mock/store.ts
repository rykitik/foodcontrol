import type { MockDatabase } from './data'
import { defaultMockDatabase } from './data'

const STORAGE_KEY = 'foodcontrol-mock-db-v2'

function resolveCollection<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback
}

function loadMockDb(): MockDatabase {
  const defaults = defaultMockDatabase()

  if (typeof localStorage === 'undefined') {
    return defaults
  }

  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return defaults
  }

  try {
    const parsed = JSON.parse(raw) as Partial<MockDatabase>
    return {
      ...defaults,
      ...parsed,
      users: resolveCollection(parsed.users, defaults.users),
      categories: resolveCollection(parsed.categories, defaults.categories),
      students: resolveCollection(parsed.students, defaults.students),
      tickets: resolveCollection(parsed.tickets, defaults.tickets),
      holidays: resolveCollection(parsed.holidays, defaults.holidays),
      mealRecords: resolveCollection(parsed.mealRecords, defaults.mealRecords),
      logs: resolveCollection(parsed.logs, defaults.logs),
      processedSelections:
        parsed.processedSelections && typeof parsed.processedSelections === 'object'
          ? parsed.processedSelections
          : {},
    }
  } catch {
    return defaults
  }
}

let mockDb = loadMockDb()

export function readMockDb(): MockDatabase {
  return mockDb
}

export function writeMockDb(nextDb: MockDatabase): MockDatabase {
  mockDb = nextDb
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDb))
  }
  return mockDb
}
