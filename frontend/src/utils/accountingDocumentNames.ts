import type { MealType } from '@/types'

export function buildAccountingMealSheetFilename(categoryCode: string, mealType: MealType, month: number, year: number) {
  return `табель_${categoryCode}_${mealType}_${year}_${String(month).padStart(2, '0')}.xlsx`
}

export function buildAccountingCombinedMealSheetFilename(categoryCode: string, month: number, year: number) {
  return `табель_общий_${categoryCode}_${year}_${String(month).padStart(2, '0')}.xlsx`
}

export function buildAccountingCostStatementFilename(categoryCode: string, month: number, year: number) {
  return `ведомость_${categoryCode}_${year}_${String(month).padStart(2, '0')}.xlsx`
}

export function buildAccountingCostCalculationFilename(categoryCode: string, month: number, year: number) {
  return `расчет_стоимости_${categoryCode}_${year}_${String(month).padStart(2, '0')}.xlsx`
}
