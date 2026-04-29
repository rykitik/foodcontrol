export type AccountingDocumentMetadataFieldMode = 'value_cell' | 'prefixed_text_cell'

export interface AccountingDocumentMetadataFieldDefinition {
  key: string
  label: string
  section: string
  cell: string
  mode: AccountingDocumentMetadataFieldMode
  value: string
  isCustom?: boolean
  placeholder?: string
  prefix?: string
  suffix?: string
}

export type AccountingDocumentMetadataValues = Partial<Record<string, string>>

export type AccountingDocumentMetadataFieldSupport = AccountingDocumentMetadataFieldDefinition[]
