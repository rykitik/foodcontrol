import type { CashierLookupResult, MealSelectionResponse, User, UserRole } from '@/types'

export function createUser(role: UserRole, overrides: Partial<User> = {}): User {
  return {
    id: overrides.id ?? `${role}-user-id`,
    username: overrides.username ?? `${role}-user`,
    full_name: overrides.full_name ?? `${role} user`,
    role,
    building_id: overrides.building_id ?? 1,
    building_name: overrides.building_name ?? 'Building 1',
    is_active: overrides.is_active ?? true,
    ...overrides,
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

export function createCashierLookupResult(overrides: Partial<CashierLookupResult> = {}): CashierLookupResult {
  return {
    query: overrides.query ?? 'QR-001',
    student: overrides.student ?? {
      id: 'student-1',
      full_name: 'Test Student',
      student_card: '100001',
      group_name: 'A-01',
      building_id: 1,
      category: {
        id: 1,
        name: 'Default',
        code: 'DEFAULT',
        breakfast: true,
        lunch: true,
        meal_types: ['breakfast', 'lunch'],
      },
      category_id: 1,
      is_active: true,
    },
    ticket: overrides.ticket ?? {
      id: 'ticket-1',
      status: 'active',
      qr_code: 'QR-001',
      start_date: '2026-04-01',
      end_date: '2026-04-30',
    },
    allowed_meals: overrides.allowed_meals ?? ['breakfast', 'lunch'],
    recent_meals: overrides.recent_meals ?? [],
    remaining_meals: overrides.remaining_meals ?? ['breakfast'],
    today_statuses: overrides.today_statuses ?? [],
    ...overrides,
  }
}

export function createMealSelectionResponse(
  overrides: Partial<MealSelectionResponse> = {},
): MealSelectionResponse {
  return {
    records: overrides.records ?? [],
    issued_meals: overrides.issued_meals ?? ['breakfast'],
    already_issued_meals: overrides.already_issued_meals ?? [],
    rejected_meals: overrides.rejected_meals ?? [],
    total_amount: overrides.total_amount ?? 120,
    request_id: overrides.request_id ?? 'request-1',
    ...overrides,
  }
}
