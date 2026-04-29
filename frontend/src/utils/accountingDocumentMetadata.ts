import type { PrintableDocument } from '@/types'
import type {
  AccountingDocumentMetadataFieldDefinition,
  AccountingDocumentMetadataFieldSupport,
  AccountingDocumentMetadataValues,
} from '@/types/accountingDocumentMetadata'

function getDocumentMetadataFields(
  document: PrintableDocument | null | undefined,
): AccountingDocumentMetadataFieldDefinition[] {
  return document?.editable_metadata ?? []
}

export function resolveAccountingDocumentMetadata(
  document?: PrintableDocument | null,
): AccountingDocumentMetadataValues | null {
  const fields = getDocumentMetadataFields(document)
  if (fields.length === 0) {
    return null
  }

  return Object.fromEntries(fields.map((field) => [field.key, field.value ?? ''])) as AccountingDocumentMetadataValues
}

export function hasCustomAccountingDocumentMetadata(document?: PrintableDocument | null): boolean {
  return getDocumentMetadataFields(document).some((field) => field.isCustom)
}

export function detectAccountingDocumentMetadataSupport(
  document: PrintableDocument | null | undefined,
): AccountingDocumentMetadataFieldSupport {
  return getDocumentMetadataFields(document)
}
