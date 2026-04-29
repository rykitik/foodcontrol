export interface CashierSummaryOverview {
  count: number
  breakfast_count: number
  lunch_count: number
  amount: number
}

export interface CashierSummaryDayRow {
  issue_date: string
  count: number
  breakfast_count: number
  lunch_count: number
  amount: number
}

export interface CashierSummaryLineItem {
  meal_type: 'breakfast' | 'lunch'
  meal_type_label: string
  price: number
  count: number
  amount: number
}

export interface CashierSummaryBuildingRow {
  building_id: number
  building_name: string
  line_items: CashierSummaryLineItem[]
  total_count: number
  total_amount: number
}

export interface CashierSummaryBuildingsTable {
  rows: CashierSummaryBuildingRow[]
  totals: {
    line_items: CashierSummaryLineItem[]
    total_count: number
    total_amount: number
  }
}

export interface CashierDailySummary {
  days: number
  period_start: string
  period_end: string
  filter: {
    mode: 'days' | 'month'
    days: number | null
    month: number | null
    year: number | null
  }
  scope: {
    history_building_id: number | null
    history_building_name: string | null
    history_scope_label: string
  }
  overview: {
    history_scope: CashierSummaryOverview
    all_buildings: CashierSummaryOverview
  }
  daily_rows: CashierSummaryDayRow[]
  buildings_table: CashierSummaryBuildingsTable
}
