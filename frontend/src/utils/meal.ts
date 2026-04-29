import type { Category } from '@/types'
import { mealTypeLabels } from '@/config/options'

export function formatMealSummary(category?: Category | null): string {
  if (!category) {
    return 'Категория не выбрана'
  }

  const parts: string[] = []
  if (category.meal_prices?.breakfast) {
    parts.push(`завтрак ${category.meal_prices.breakfast} ₽`)
  }
  if (category.meal_prices?.lunch) {
    parts.push(`обед ${category.meal_prices.lunch} ₽`)
  }

  return parts.length ? parts.join(' · ') : 'Питание не настроено'
}

export function formatMealScheme(category?: Category | null): string {
  if (!category?.meal_types?.length) {
    return 'Схема не настроена'
  }

  return category.meal_types.map((mealType) => mealTypeLabels[mealType]).join(' + ')
}

export function getMealCards(category?: Category | null) {
  if (!category) {
    return []
  }

  return [
    category.meal_prices?.breakfast
      ? { key: 'breakfast', label: mealTypeLabels.breakfast, amount: category.meal_prices.breakfast }
      : null,
    category.meal_prices?.lunch
      ? { key: 'lunch', label: mealTypeLabels.lunch, amount: category.meal_prices.lunch }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string; amount: number }>
}
