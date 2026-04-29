export interface HolidayEntry {
  id: number
  holiday_date: string
  title?: string | null
  is_active: boolean
  created_by?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface HolidayCreateRequest {
  holiday_date: string
  title?: string
  is_active?: boolean
}

export interface HolidayUpdateRequest {
  holiday_date?: string
  title?: string
  is_active?: boolean
}

export interface HolidayRangeCreateRequest {
  start_date: string
  end_date: string
  title?: string
  is_active?: boolean
}

export interface HolidayRangeCreateResponse {
  created_count: number
  skipped_count: number
  created: HolidayEntry[]
  skipped_dates: string[]
}

export interface HolidayCalendarCell {
  isoDate: string
  day: number
  isWeekend: boolean
  holiday: HolidayEntry | null
}

export interface HolidaySelectedDateMeta {
  weekend: boolean
  holiday: HolidayEntry | null
}

export type HolidayReasonType = 'vacation' | 'sanitary' | 'public' | 'non_study' | 'other'

export interface HolidayEditForm {
  holiday_date: string
  reason_type: HolidayReasonType
  comment: string
  is_active: boolean
}

export interface HolidayRangeForm {
  start_date: string
  end_date: string
  reason_type: HolidayReasonType
  comment: string
  is_active: boolean
}
