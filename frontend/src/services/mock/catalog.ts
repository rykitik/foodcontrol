import type { Category, CategoryCreateRequest, CategoryDeleteRequest, CategoryUpdateRequest } from '@/types'

import { readMockDb } from './store'
import { clone, mutateDb, requireUser } from './helpers'

export function getCategories(): Category[] {
  return clone(readMockDb().categories.filter((category) => category.is_active !== false))
}

const CYRILLIC_TRANSLIT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'c',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
}

function buildCategoryCode(name: string, categories: Category[]): string {
  const slug =
    Array.from(name.toLowerCase(), (char) => CYRILLIC_TRANSLIT[char] ?? char)
      .join('')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 20) || 'category'
  let code = slug
  let counter = 2

  while (categories.some((category) => category.code === code)) {
    const suffix = `_${counter}`
    code = `${slug.slice(0, 20 - suffix.length).replace(/_+$/g, '')}${suffix}`
    counter += 1
  }

  return code
}

function refreshMealFields(category: Category) {
  category.meal_types = [
    ...(category.breakfast ? (['breakfast'] as const) : []),
    ...(category.lunch ? (['lunch'] as const) : []),
  ]
  category.meal_prices = {
    breakfast: category.breakfast_price ?? category.meal_prices?.breakfast ?? 95,
    lunch: category.lunch_price ?? category.meal_prices?.lunch ?? 165,
  }
}

function validateCategoryName(name: string, categories: Category[], excludeId?: number): string {
  const normalized = name.trim()
  if (!normalized) {
    throw new Error('Название категории не может быть пустым')
  }
  if (categories.some((category) => category.id !== excludeId && category.name.toLowerCase() === normalized.toLowerCase())) {
    throw new Error('Категория с таким названием уже существует')
  }
  return normalized
}

function validateCategoryCode(code: string, categories: Category[], excludeId?: number): string {
  const normalized = code.trim().toLowerCase()
  if (!/^[a-z0-9_]{2,20}$/.test(normalized)) {
    throw new Error('Код категории должен содержать 2-20 символов: a-z, 0-9 или _')
  }
  if (categories.some((category) => category.id !== excludeId && category.code.toLowerCase() === normalized)) {
    throw new Error('Категория с таким кодом уже существует')
  }
  return normalized
}

export function createCategory(request: CategoryCreateRequest, token?: string | null): Category {
  return mutateDb((nextDb) => {
    requireUser(token, nextDb)
    const name = validateCategoryName(request.name, nextDb.categories)
    const code = request.code
      ? validateCategoryCode(request.code, nextDb.categories)
      : buildCategoryCode(name, nextDb.categories)
    const category: Category = {
      id: Math.max(0, ...nextDb.categories.map((item) => item.id)) + 1,
      name,
      code,
      is_active: true,
      breakfast: Boolean(request.breakfast),
      lunch: Boolean(request.lunch),
      breakfast_price: request.breakfast_price ?? 0,
      lunch_price: request.lunch_price ?? 0,
      description: request.description ?? '',
      color: request.color,
      meal_types: [],
      meal_prices: {},
    }

    refreshMealFields(category)
    nextDb.categories.push(category)
    return clone(category)
  })
}

export function updateCategory(categoryId: number, request: CategoryUpdateRequest, token?: string | null): Category {
  return mutateDb((nextDb) => {
    requireUser(token, nextDb)
    const category = nextDb.categories.find((item) => item.id === categoryId)
    if (!category) {
      throw new Error('Категория не найдена')
    }

    if (request.name !== undefined) {
      category.name = validateCategoryName(request.name, nextDb.categories, categoryId)
    }
    if (request.code !== undefined) {
      category.code = validateCategoryCode(request.code, nextDb.categories, categoryId)
    }
    if (request.breakfast !== undefined) {
      category.breakfast = request.breakfast
    }
    if (request.lunch !== undefined) {
      category.lunch = request.lunch
    }
    if (request.breakfast_price !== undefined) {
      category.breakfast_price = request.breakfast_price
    }
    if (request.lunch_price !== undefined) {
      category.lunch_price = request.lunch_price
    }
    if (request.description !== undefined) {
      category.description = request.description
    }
    if (request.color !== undefined) {
      category.color = request.color
    }

    refreshMealFields(category)
    return clone(category)
  })
}

export function deleteCategory(
  categoryId: number,
  request: CategoryDeleteRequest,
  token?: string | null,
): { id: number; replacement_category_id?: number | null; transferred_students: number } {
  return mutateDb((nextDb) => {
    requireUser(token, nextDb)
    const category = nextDb.categories.find((item) => item.id === categoryId && item.is_active !== false)
    if (!category) {
      throw new Error('Категория не найдена')
    }
    if (nextDb.categories.filter((item) => item.is_active !== false).length <= 1) {
      throw new Error('Нельзя удалить последнюю активную категорию')
    }

    const assignedStudents = nextDb.students.filter((student) => student.category_id === categoryId)
    const replacementId = request.replacement_category_id ?? null
    let replacement: Category | undefined

    if (assignedStudents.length > 0 || replacementId != null) {
      replacement = nextDb.categories.find((item) => item.id === replacementId && item.is_active !== false)
      if (!replacement || replacement.id === categoryId) {
        throw new Error('Нужно выбрать другую активную категорию для перевода студентов')
      }

      assignedStudents.forEach((student) => {
        student.category_id = replacement!.id
        student.category = clone(replacement!)
      })
      nextDb.tickets
        .filter((ticket) => ticket.category_id === categoryId && ticket.status === 'active')
        .forEach((ticket) => {
          ticket.category_id = replacement!.id
          ticket.category_name = replacement!.name
        })
    }

    category.is_active = false
    return {
      id: category.id,
      replacement_category_id: replacement?.id ?? null,
      transferred_students: assignedStudents.length,
    }
  })
}
