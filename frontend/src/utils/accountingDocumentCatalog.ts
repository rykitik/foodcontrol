import { mealTypeLabels } from '@/config/options'
import type { Category, MealType } from '@/types'
import {
  ACCOUNTING_ALL_CATEGORIES_ID,
  getAccountingDocumentCategories,
  getAccountingMealSheetTemplates,
  hasAccountingCostCalculationTemplate,
  hasAccountingCostStatementTemplate,
  hasAccountingMealSheetTemplate,
} from '@/utils/accountingTemplateSupport'

interface AccountantDocumentItemBase {
  key: string
  categoryId: number
  categoryCode: string
  categoryName: string
  title: string
  description: string
  badgeLabel: string
}

export interface AccountantMealSheetDocumentItem extends AccountantDocumentItemBase {
  kind: 'meal_sheet'
  mealType: MealType
}

export interface AccountantCostStatementDocumentItem extends AccountantDocumentItemBase {
  kind: 'cost_statement'
}

export interface AccountantCostCalculationDocumentItem extends AccountantDocumentItemBase {
  kind: 'cost_calculation'
}

export type AccountantDocumentItem =
  | AccountantMealSheetDocumentItem
  | AccountantCostStatementDocumentItem
  | AccountantCostCalculationDocumentItem

export function buildAccountantDocumentCards(
  categories: Category[],
  selectedCategoryId: number | null,
): AccountantDocumentItem[] {
  const groupedByAll = selectedCategoryId === ACCOUNTING_ALL_CATEGORIES_ID
  if (groupedByAll) {
    const cards: AccountantDocumentItem[] = []

    if (categories.some((category) => hasAccountingMealSheetTemplate(category, 'breakfast'))) {
      cards.push({
        key: 'meal-all-breakfast',
        kind: 'meal_sheet',
        categoryId: ACCOUNTING_ALL_CATEGORIES_ID,
        categoryCode: 'all',
        categoryName: 'Все категории',
        title: `Табель учета питания (${mealTypeLabels.breakfast})`,
        description:
          'Помесячный шаблон табеля по всем поддержанным категориям. В ячейках дней ставятся X по фактической выдаче завтрака.',
        badgeLabel: mealTypeLabels.breakfast,
        mealType: 'breakfast',
      })
    }

    if (categories.some((category) => hasAccountingMealSheetTemplate(category, 'lunch'))) {
      cards.push({
        key: 'meal-all-lunch',
        kind: 'meal_sheet',
        categoryId: ACCOUNTING_ALL_CATEGORIES_ID,
        categoryCode: 'all',
        categoryName: 'Все категории',
        title: `Табель учета питания (${mealTypeLabels.lunch})`,
        description:
          'Помесячный шаблон табеля по всем поддержанным категориям. В ячейках дней ставятся X по фактической выдаче обеда.',
        badgeLabel: mealTypeLabels.lunch,
        mealType: 'lunch',
      })
    }

    if (categories.some((category) => hasAccountingCostStatementTemplate(category))) {
      cards.push({
        key: 'cost-all',
        kind: 'cost_statement',
        categoryId: ACCOUNTING_ALL_CATEGORIES_ID,
        categoryCode: 'all',
        categoryName: 'Все категории',
        title: 'Ведомость стоимости',
        description: 'Помесячная ведомость стоимости предоставленного питания по всем поддержанным категориям.',
        badgeLabel: 'Суммы',
      })
    }

    if (categories.some((category) => hasAccountingCostCalculationTemplate(category))) {
      cards.push({
        key: 'cost-calculation-all',
        kind: 'cost_calculation',
        categoryId: ACCOUNTING_ALL_CATEGORIES_ID,
        categoryCode: 'all',
        categoryName: 'Все категории',
        title: 'Расчет стоимости предоставленного питания',
        description:
          'Помесячный расчет стоимости предоставленного питания по всем выбранным категориям на основе данных системы.',
        badgeLabel: 'Расчет',
      })
    }

    return cards
  }

  return getAccountingDocumentCategories(categories, selectedCategoryId).flatMap((category) => {
    const mealSheetCards: AccountantMealSheetDocumentItem[] = getAccountingMealSheetTemplates(category).map((mealType) => ({
      key: `meal-${category.id}-${mealType}`,
      kind: 'meal_sheet',
      categoryId: category.id,
      categoryCode: category.code,
      categoryName: category.name,
      title: groupedByAll
        ? `Табель учета питания: ${category.name} (${mealTypeLabels[mealType]})`
        : `Табель учета питания (${mealTypeLabels[mealType]})`,
      description: groupedByAll
        ? `Помесячный шаблон табеля по дням для категории «${category.name}». В ячейках дней ставятся X по фактической выдаче ${mealTypeLabels[mealType].toLowerCase()}.`
        : `Помесячный шаблон табеля учета по дням. В ячейках дней ставятся X по фактической выдаче ${mealTypeLabels[mealType].toLowerCase()}.`,
      badgeLabel: mealTypeLabels[mealType],
      mealType,
    }))

    const costStatementCards: AccountantCostStatementDocumentItem[] = hasAccountingCostStatementTemplate(category)
      ? [
          {
            key: `cost-${category.id}`,
            kind: 'cost_statement',
            categoryId: category.id,
            categoryCode: category.code,
            categoryName: category.name,
            title: groupedByAll ? `Ведомость стоимости: ${category.name}` : 'Ведомость стоимости',
            description: groupedByAll
              ? `Помесячная ведомость стоимости предоставленного питания по студентам категории «${category.name}».`
              : 'Помесячная ведомость стоимости предоставленного питания по студентам выбранной категории.',
            badgeLabel: 'Суммы',
          },
        ]
      : []

    const costCalculationCards: AccountantCostCalculationDocumentItem[] = hasAccountingCostCalculationTemplate(category)
      ? [
          {
            key: `cost-calculation-${category.id}`,
            kind: 'cost_calculation',
            categoryId: category.id,
            categoryCode: category.code,
            categoryName: category.name,
            title: groupedByAll
              ? `Расчет стоимости питания: ${category.name}`
              : 'Расчет стоимости предоставленного питания',
            description: groupedByAll
              ? `Расчет стоимости предоставленного питания по студентам категории «${category.name}» по данным системы.`
              : 'Расчет стоимости предоставленного питания по студентам выбранной категории по данным системы.',
            badgeLabel: 'Расчет',
          },
        ]
      : []

    return [...mealSheetCards, ...costStatementCards, ...costCalculationCards]
  })
}

export function describeAccountantSelectionDocuments(
  categories: Category[],
  selectedCategoryId: number | null,
): string {
  if (selectedCategoryId === ACCOUNTING_ALL_CATEGORIES_ID) {
    const documents: string[] = []
    const mealTypes: string[] = []
    if (categories.some((category) => hasAccountingMealSheetTemplate(category, 'breakfast'))) {
      mealTypes.push(mealTypeLabels.breakfast)
    }
    if (categories.some((category) => hasAccountingMealSheetTemplate(category, 'lunch'))) {
      mealTypes.push(mealTypeLabels.lunch)
    }
    if (mealTypes.length > 0) {
      documents.push(`табели: ${mealTypes.join(', ')}`)
    }
    if (categories.some((category) => hasAccountingCostStatementTemplate(category))) {
      documents.push('ведомость стоимости')
    }
    if (categories.some((category) => hasAccountingCostCalculationTemplate(category))) {
      documents.push('расчет стоимости питания')
    }
    return documents.length > 0 ? documents.join('; ') : 'Нет эталонных шаблонов'
  }

  const selectedCategory = categories.find((category) => category.id === selectedCategoryId)
  if (!selectedCategory) {
    return 'Нет эталонных шаблонов'
  }

  const mealSheets = getAccountingMealSheetTemplates(selectedCategory).map((mealType) => mealTypeLabels[mealType])
  const documents: string[] = []

  if (mealSheets.length > 0) {
    documents.push(`табели: ${mealSheets.join(', ')}`)
  }
  if (hasAccountingCostStatementTemplate(selectedCategory)) {
    documents.push('ведомость стоимости')
  }
  if (hasAccountingCostCalculationTemplate(selectedCategory)) {
    documents.push('расчет стоимости питания')
  }

  return documents.length > 0 ? documents.join('; ') : 'Нет эталонных шаблонов бухгалтерских документов'
}

export function buildAccountantTemplateWarning(
  categories: Category[],
  selectedCategoryId: number | null,
): string {
  if (selectedCategoryId === ACCOUNTING_ALL_CATEGORIES_ID) {
    return ''
  }

  const selectedCategory = categories.find((category) => category.id === selectedCategoryId)
  if (!selectedCategory) {
    return ''
  }

  return buildAccountantDocumentCards(categories, selectedCategoryId).length > 0
    ? ''
    : 'Для выбранной категории сейчас недоступны бухгалтерские документы.'
}

export function buildAccountantDocumentPreviewKey(document: AccountantDocumentItem): string {
  if (document.kind === 'meal_sheet') {
    return `preview-meal-${document.categoryId}-${document.mealType}`
  }
  if (document.kind === 'cost_statement') {
    return `preview-cost-statement-${document.categoryId}`
  }
  return `preview-cost-calculation-${document.categoryId}`
}

export function buildAccountantDocumentExcelKey(document: AccountantDocumentItem): string {
  if (document.kind === 'meal_sheet') {
    return `excel-meal-${document.categoryId}-${document.mealType}`
  }
  if (document.kind === 'cost_statement') {
    return `excel-cost-statement-${document.categoryId}`
  }
  return `excel-cost-calculation-${document.categoryId}`
}
