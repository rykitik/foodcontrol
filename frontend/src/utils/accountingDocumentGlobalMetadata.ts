import type {
  AccountingDocumentMetadataFieldDefinition,
  AccountingDocumentMetadataValues,
} from '@/types/accountingDocumentMetadata'

const GLOBAL_ACCOUNTING_METADATA_KEYS = new Set([
  'institution',
  'division',
  'targetArticle',
  'expenseType',
  'measurementUnit',
  'fundingSource',
  'okpoCode',
  'kspCode',
  'fkrCode',
  'kcsrCode',
  'kvrCode',
  'okeiCode',
])

export function isGlobalAccountingMetadataKey(key: string): boolean {
  return GLOBAL_ACCOUNTING_METADATA_KEYS.has(key)
}

export function filterGlobalAccountingMetadataFields(
  fields: AccountingDocumentMetadataFieldDefinition[],
): AccountingDocumentMetadataFieldDefinition[] {
  return fields.filter((field) => isGlobalAccountingMetadataKey(field.key))
}

export function filterDocumentAccountingMetadataFields(
  fields: AccountingDocumentMetadataFieldDefinition[],
): AccountingDocumentMetadataFieldDefinition[] {
  return fields.filter((field) => !isGlobalAccountingMetadataKey(field.key))
}

export function resolveAccountingMetadataValuesForFields(
  fields: AccountingDocumentMetadataFieldDefinition[],
): AccountingDocumentMetadataValues | null {
  if (fields.length === 0) {
    return null
  }

  return Object.fromEntries(fields.map((field) => [field.key, field.value ?? '']))
}
