import type { Category, MealType } from '@/types'

export const ACCOUNTING_ALL_CATEGORIES_ID = 0

export const ACCOUNTING_ALL_CATEGORIES_OPTION: Category = {
  id: ACCOUNTING_ALL_CATEGORIES_ID,
  name: 'Все',
  code: 'all',
  breakfast: true,
  lunch: true,
  meal_types: ['breakfast', 'lunch'],
  meal_prices: {},
}

export function hasAccountingCostStatementTemplate(category?: Category | null): boolean {
  return isAccountingCategory(category)
}

export function hasAccountingCostCalculationTemplate(category?: Category | null): boolean {
  return isAccountingCategory(category)
}

export function hasAccountingMealSheetTemplate(
  category: Category | undefined | null,
  mealType: MealType,
): boolean {
  return getAccountingMealSheetTemplates(category).includes(mealType)
}

export function getAccountingMealSheetTemplates(category: Category | undefined | null): MealType[] {
  return resolveCategoryMealTypes(category)
}

export function hasAnyAccountingTemplate(category?: Category | null): boolean {
  return (
    hasAccountingCostStatementTemplate(category) ||
    hasAccountingCostCalculationTemplate(category) ||
    getAccountingMealSheetTemplates(category).length > 0
  )
}

export function getAccountingDocumentCategories(
  categories: Category[],
  selectedCategoryId: number | null,
): Category[] {
  if (selectedCategoryId === ACCOUNTING_ALL_CATEGORIES_ID) {
    return categories.filter((category) => hasAnyAccountingTemplate(category))
  }

  const selectedCategory = categories.find((category) => category.id === selectedCategoryId)
  return selectedCategory && hasAnyAccountingTemplate(selectedCategory) ? [selectedCategory] : []
}

function isAccountingCategory(category?: Category | null): category is Category {
  return Boolean(category && category.id !== ACCOUNTING_ALL_CATEGORIES_ID)
}

function resolveCategoryMealTypes(category?: Category | null): MealType[] {
  if (!isAccountingCategory(category)) {
    return []
  }

  if (category.meal_types.length > 0) {
    return [...category.meal_types]
  }

  const mealTypes: MealType[] = []
  if (category.breakfast) {
    mealTypes.push('breakfast')
  }
  if (category.lunch) {
    mealTypes.push('lunch')
  }
  return mealTypes
}
