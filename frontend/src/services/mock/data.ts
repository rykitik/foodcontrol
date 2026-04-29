import type {
  AuditLogEntry,
  Category,
  HolidayEntry,
  MealRecord,
  MealSelectionResponse,
  Student,
  Ticket,
  User,
} from '@/types'

export type MockUser = User & { password: string }

export interface MockDatabase {
  users: MockUser[]
  categories: Category[]
  students: Student[]
  tickets: Ticket[]
  holidays: HolidayEntry[]
  mealRecords: MealRecord[]
  logs: AuditLogEntry[]
  processedSelections: Record<string, MealSelectionResponse>
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const currentDate = new Date()
const currentYear = currentDate.getFullYear()
const currentMonth = currentDate.getMonth() + 1
const todayIso = toIsoDate(currentDate)

const categorySeed: Category[] = [
  { id: 1, name: 'ОВЗ', code: 'ovz', is_active: true, breakfast: true, lunch: true, description: 'Завтрак + обед', color: '#1d4ed8', meal_types: ['breakfast', 'lunch'], meal_prices: { breakfast: 95, lunch: 165 } },
  { id: 2, name: 'Сироты', code: 'orphan', is_active: true, breakfast: false, lunch: true, description: 'Только обед', color: '#0f766e', meal_types: ['lunch'], meal_prices: { lunch: 175 } },
  { id: 3, name: 'Многодетные', code: 'large_family', is_active: true, breakfast: false, lunch: true, description: 'Только обед', color: '#b45309', meal_types: ['lunch'], meal_prices: { lunch: 150 } },
  { id: 4, name: 'Инвалиды', code: 'disabled', is_active: true, breakfast: false, lunch: true, description: 'Только обед', color: '#7c3aed', meal_types: ['lunch'], meal_prices: { lunch: 165 } },
  { id: 5, name: 'Малообеспеченные', code: 'low_income', is_active: true, breakfast: false, lunch: true, description: 'Только обед', color: '#dc2626', meal_types: ['lunch'], meal_prices: { lunch: 150 } },
  { id: 6, name: 'СВО', code: 'svo', is_active: true, breakfast: false, lunch: true, description: 'Дети участников СВО', color: '#475569', meal_types: ['lunch'], meal_prices: { breakfast: 95, lunch: 150 }, breakfast_price: 95, lunch_price: 150 },
]

const studentSeed: Student[] = [
  { id: 'st-1', full_name: 'Иванов Иван Иванович', student_card: '100001', group_name: 'ИСП-201', building_id: 1, category_id: 2, category: categorySeed[1]!, is_active: true, active_ticket_id: 'tk-1' },
  { id: 'st-2', full_name: 'Петров Петр Петрович', student_card: '100002', group_name: 'ПКС-301', building_id: 1, category_id: 1, category: categorySeed[0]!, is_active: true },
  { id: 'st-3', full_name: 'Сидорова Мария Сергеевна', student_card: '100003', group_name: 'ОП-202', building_id: 2, category_id: 3, category: categorySeed[2]!, is_active: true },
  { id: 'st-4', full_name: 'Кузнецова Алина Денисовна', student_card: '100004', group_name: 'ЭК-101', building_id: 1, category_id: 4, category: categorySeed[3]!, is_active: true },
  { id: 'st-5', full_name: 'Смирнов Артем Игоревич', student_card: '100005', group_name: 'ТОР-401', building_id: 2, category_id: 5, category: categorySeed[4]!, is_active: true },
]

const userSeed: MockUser[] = [
  { id: 'u-social-1', username: 'social1', password: 'password123', full_name: 'Анна Соколова', role: 'social', building_id: 1, building_name: 'Корпус 1, Ленина, д.9', is_active: true },
  { id: 'u-head-1', username: 'headsocial', password: 'password123', full_name: 'Марина Лебедева', role: 'head_social', building_id: null, building_name: null, is_active: true },
  { id: 'u-cashier-1', username: 'cashier1', password: 'password123', full_name: 'Ольга Иванова', role: 'cashier', building_id: 1, building_name: 'Корпус 1, Ленина, д.9', is_active: true },
  { id: 'u-accountant-1', username: 'accountant', password: 'password123', full_name: 'Елена Петрова', role: 'accountant', building_id: null, building_name: null, is_active: true },
  { id: 'u-admin-1', username: 'admin', password: 'password123', full_name: 'Администратор', role: 'admin', building_id: null, building_name: null, is_active: true },
]

const ticketSeed: Ticket[] = [
  {
    id: 'tk-1',
    student_id: 'st-1',
    student_name: 'Иванов Иван Иванович',
    category_id: 2,
    category_name: 'Сироты',
    month: currentMonth,
    year: currentYear,
    start_date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`,
    end_date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-28`,
    status: 'active',
    qr_code: 'tk-1',
    created_by: 'u-social-1',
    created_by_name: 'Анна Соколова',
    created_at: currentDate.toISOString(),
  },
]

const mealRecordSeed: MealRecord[] = [
  {
    id: 'mr-1',
    ticket_id: 'tk-1',
    student_id: 'st-1',
    student_name: 'Иванов Иван Иванович',
    meal_type: 'lunch',
    issue_date: todayIso,
    issue_time: '08:20',
    issued_by: 'u-cashier-1',
    issued_by_name: 'Ольга Иванова',
    building_id: 1,
    category_name: 'Сироты',
    price: 95,
  },
]

const logSeed: AuditLogEntry[] = [
  {
    id: 1,
    user_id: 'u-social-1',
    user_name: 'Анна Соколова',
    action: 'login',
    entity_type: 'user',
    entity_id: 'u-social-1',
    details: {},
    ip_address: '127.0.0.1',
    user_agent: 'Mock Browser',
    created_at: currentDate.toISOString(),
  },
]

const holidaySeed: HolidayEntry[] = [
  { id: 1, holiday_date: '2026-01-01', title: 'Новогодние каникулы', is_active: true },
  { id: 2, holiday_date: '2026-01-02', title: 'Новогодние каникулы', is_active: true },
  { id: 3, holiday_date: '2026-01-03', title: 'Новогодние каникулы', is_active: true },
  { id: 4, holiday_date: '2026-01-04', title: 'Новогодние каникулы', is_active: true },
  { id: 5, holiday_date: '2026-01-05', title: 'Новогодние каникулы', is_active: true },
  { id: 6, holiday_date: '2026-01-06', title: 'Новогодние каникулы', is_active: true },
  { id: 7, holiday_date: '2026-01-07', title: 'Рождество', is_active: true },
  { id: 8, holiday_date: '2026-01-08', title: 'Новогодние каникулы', is_active: true },
  { id: 9, holiday_date: '2026-02-23', title: 'День защитника Отечества', is_active: true },
  { id: 10, holiday_date: '2026-03-08', title: 'Международный женский день', is_active: true },
  { id: 11, holiday_date: '2026-05-01', title: 'Праздник Весны и Труда', is_active: true },
  { id: 12, holiday_date: '2026-05-09', title: 'День Победы', is_active: true },
  { id: 13, holiday_date: '2026-06-12', title: 'День России', is_active: true },
  { id: 14, holiday_date: '2026-11-04', title: 'День народного единства', is_active: true },
]

export const demoUsers = userSeed.map((user) => ({
  username: user.username,
  password: user.password,
  role: user.role,
  full_name: user.full_name,
}))

export function defaultMockDatabase(): MockDatabase {
  return clone({
    users: userSeed,
    categories: categorySeed,
    students: studentSeed,
    tickets: ticketSeed,
    holidays: holidaySeed,
    mealRecords: mealRecordSeed,
    logs: logSeed,
    processedSelections: {},
  })
}
