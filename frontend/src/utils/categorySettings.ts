import type { Category } from '@/types'

export type CategoryDraft = {
  name: string
  code: string
  breakfast: boolean
  lunch: boolean
  breakfast_price: number
  lunch_price: number
  description: string
}

type CategoryMealDefinition = Pick<CategoryDraft, 'breakfast' | 'lunch' | 'breakfast_price' | 'lunch_price'>

const rubleFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function resolveCategoryPrice(category: Category, mealType: 'breakfast' | 'lunch') {
  const directValue = mealType === 'breakfast' ? category.breakfast_price : category.lunch_price
  if (typeof directValue === 'number') {
    return directValue
  }
  return category.meal_prices?.[mealType] ?? (mealType === 'breakfast' ? 95 : 165)
}

export function createCategoryDraft(category: Category): CategoryDraft {
  return {
    name: category.name,
    code: category.code,
    breakfast: category.breakfast,
    lunch: category.lunch,
    breakfast_price: resolveCategoryPrice(category, 'breakfast'),
    lunch_price: resolveCategoryPrice(category, 'lunch'),
    description: category.description ?? '',
  }
}

export function formatCategoryPrice(value: number) {
  return `${rubleFormatter.format(value)} ₽`
}

export function buildCategoryMealSummaryParts(category: CategoryMealDefinition) {
  const labels: string[] = []

  if (category.breakfast) {
    labels.push(`Завтрак ${formatCategoryPrice(category.breakfast_price)}`)
  }

  if (category.lunch) {
    labels.push(`Обед ${formatCategoryPrice(category.lunch_price)}`)
  }

  return labels
}

export function buildCategoryMealLabel(draft: CategoryDraft) {
  const labels = buildCategoryMealSummaryParts(draft)

  if (!labels.length) {
    return 'Без питания'
  }

  return labels.join(' + ')
}
