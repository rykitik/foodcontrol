import type { MealType } from './index'
import type { AccountingDocumentMetadataValues } from './accountingDocumentMetadata'

export type AccountingDocumentKind = 'meal_sheet' | 'combined_meal_sheet' | 'cost_statement' | 'cost_calculation'

export interface AccountingMealSheetRequest {
  month: number
  year: number
  category_id: number
  meal_type: MealType
}

export interface AccountingCombinedMealSheetRequest {
  month: number
  year: number
  category_id: number
}

export interface AccountingCostStatementRequest {
  month: number
  year: number
  category_id: number
}

export interface AccountingCostCalculationRequest {
  month: number
  year: number
  category_id: number
}

export interface AccountingDocumentMetadataSaveRequest {
  document_kind: AccountingDocumentKind
  month: number
  year: number
  category_id: number
  meal_type?: MealType
  values: AccountingDocumentMetadataValues
}

export interface AccountingDocumentMetadataResetRequest {
  document_kind: AccountingDocumentKind
  month: number
  year: number
  category_id: number
  meal_type?: MealType
}

export type AccountingDocumentGlobalMetadataValues = AccountingDocumentMetadataValues

export interface AccountingDocumentGlobalMetadataResponse {
  values: AccountingDocumentGlobalMetadataValues
}

export interface AccountingDocumentGlobalMetadataSaveRequest {
  values: AccountingDocumentGlobalMetadataValues
}

export interface AccountingDocumentGlobalMetadataResetRequest {
  keys?: string[]
}
