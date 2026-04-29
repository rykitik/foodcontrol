export function formatLocalDateToIso(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function buildLocalMonthPeriod(year: number, month: number) {
  return {
    startDate: `${year}-${String(month).padStart(2, '0')}-01`,
    endDate: `${year}-${String(month).padStart(2, '0')}-${String(getLastDayOfMonth(year, month)).padStart(2, '0')}`,
  }
}
