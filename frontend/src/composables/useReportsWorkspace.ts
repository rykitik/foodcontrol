import { computed, onMounted, ref, watch } from 'vue'

import {
  getAccountingDocumentGlobalMetadata,
  getCategories,
  getMealReport,
  resetAccountingDocumentGlobalMetadata,
  saveAccountingDocumentGlobalMetadata,
} from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import type { Category, MealReport, PrintableDocument } from '@/types'
import type {
  AccountingDocumentMetadataFieldDefinition,
  AccountingDocumentMetadataValues,
} from '@/types/accountingDocumentMetadata'
import {
  downloadAccountingDocument,
  loadAccountingDocument,
  printAccountingDocument,
  resetAccountingDocumentMetadata,
  saveAccountingDocumentMetadata,
} from '@/utils/accountingDocumentActions'
import {
  detectAccountingDocumentMetadataSupport,
} from '@/utils/accountingDocumentMetadata'
import {
  filterDocumentAccountingMetadataFields,
  filterGlobalAccountingMetadataFields,
  resolveAccountingMetadataValuesForFields,
} from '@/utils/accountingDocumentGlobalMetadata'
import {
  type AccountantDocumentItem,
  buildAccountantDocumentCards,
  buildAccountantDocumentExcelKey,
  buildAccountantDocumentPreviewKey,
  buildAccountantTemplateWarning,
  describeAccountantSelectionDocuments,
} from '@/utils/accountingDocumentCatalog'
import {
  ACCOUNTING_ALL_CATEGORIES_ID,
  ACCOUNTING_ALL_CATEGORIES_OPTION,
} from '@/utils/accountingTemplateSupport'
import { formatMonthLabel, getMonthPeriod } from '@/utils/socialPedagogMonth'

const DEFAULT_LOAD_ERROR = 'Не удалось загрузить раздел отчетов'
const DEFAULT_SUMMARY_ERROR = 'Не удалось загрузить сводку по выдаче'
const DEFAULT_DOCUMENT_ERROR = 'Не удалось сформировать документ'
const DEFAULT_AUTH_ERROR = 'Не удалось получить токен авторизации'
const METADATA_SAVE_SUCCESS =
  'Общие реквизиты формы сохранены. Они применяются в предпросмотре, печати и Excel.'
const METADATA_RESET_SUCCESS =
  'Общие реквизиты формы сброшены. Снова используются системные значения.'

const GLOBAL_METADATA_SAVE_SUCCESS =
  'Реквизиты организации сохранены для всех бухгалтеров. Предпросмотр и Excel используют один набор данных.'
const GLOBAL_METADATA_RESET_SUCCESS =
  'Реквизиты организации сброшены. Документы снова используют системные значения.'

export type ReportsWorkspaceOptions = {
  loadErrorMessage?: string
}

export function useReportsWorkspace(options: ReportsWorkspaceOptions = {}) {
  const auth = useAuthStore()

  const today = new Date()
  const month = ref(today.getMonth() + 1)
  const year = ref(today.getFullYear())
  const categories = ref<Category[]>([])
  const selectedCategoryId = ref<number>(ACCOUNTING_ALL_CATEGORIES_ID)
  const report = ref<MealReport | null>(null)
  const rawPreviewDocument = ref<PrintableDocument | null>(null)
  const globalMetadataValues = ref<AccountingDocumentMetadataValues>({})
  const selectedDocumentKey = ref<string | null>(null)
  const metadataEditorOpen = ref(false)
  const loading = ref(false)
  const actionKey = ref<string | null>(null)
  const successMessage = ref('')
  const errorMessage = ref('')
  const initialized = ref(false)

  let summaryRequestId = 0
  let documentActionId = 0

  const period = computed(() => getMonthPeriod(year.value, month.value))
  const currentMonthLabel = computed(() => formatMonthLabel(year.value, month.value))
  const periodLabel = computed(() => `${period.value.startDate} - ${period.value.endDate}`)
  const categoryOptions = computed(() => [ACCOUNTING_ALL_CATEGORIES_OPTION, ...categories.value])
  const selectedCategoryIsAll = computed(
    () => selectedCategoryId.value === ACCOUNTING_ALL_CATEGORIES_ID,
  )
  const selectedCategoryOption = computed(
    () => categoryOptions.value.find((category) => category.id === selectedCategoryId.value) ?? null,
  )
  const selectedCategoryLabel = computed(
    () => selectedCategoryOption.value?.name ?? 'Не выбрана',
  )
  const documentCards = computed<AccountantDocumentItem[]>(() =>
    buildAccountantDocumentCards(categories.value, selectedCategoryId.value),
  )
  const selectedDocument = computed<AccountantDocumentItem | null>(
    () => documentCards.value.find((document) => document.key === selectedDocumentKey.value) ?? null,
  )
  const metadataSupport = computed<AccountingDocumentMetadataFieldDefinition[]>(() =>
    detectAccountingDocumentMetadataSupport(rawPreviewDocument.value),
  )
  const globalMetadataSupport = computed<AccountingDocumentMetadataFieldDefinition[]>(() =>
    filterGlobalAccountingMetadataFields(metadataSupport.value),
  )
  const documentMetadataSupport = computed<AccountingDocumentMetadataFieldDefinition[]>(() =>
    filterDocumentAccountingMetadataFields(metadataSupport.value),
  )
  const hasEditableMetadata = computed(() => metadataSupport.value.length > 0)
  const selectedDocumentMetadata = computed(() =>
    resolveAccountingMetadataValuesForFields(documentMetadataSupport.value),
  )
  const selectedDocumentGlobalMetadata = computed(() =>
    resolveAccountingMetadataValuesForFields(globalMetadataSupport.value),
  )
  const selectedDocumentHasCustomMetadata = computed(() =>
    documentMetadataSupport.value.some((field) => field.isCustom),
  )
  const selectedDocumentHasGlobalMetadata = computed(() =>
    globalMetadataSupport.value.some((field) => field.isCustom),
  )
  const previewDocument = computed(() => rawPreviewDocument.value)
  const hasAvailableDocuments = computed(() => documentCards.value.length > 0)
  const totalAmount = computed(() => report.value?.totals.amount ?? 0)
  const totalCount = computed(() => report.value?.totals.count ?? 0)
  const rowCount = computed(() => report.value?.rows.length ?? 0)
  const currentSelectionDocuments = computed(() =>
    describeAccountantSelectionDocuments(categories.value, selectedCategoryId.value),
  )
  const templateWarning = computed(() =>
    buildAccountantTemplateWarning(categories.value, selectedCategoryId.value),
  )
  const previewLoading = computed(() =>
    selectedDocument.value
      ? isActionLoading(buildAccountantDocumentPreviewKey(selectedDocument.value))
      : false,
  )
  const selectedDocumentExcelLoading = computed(() =>
    selectedDocument.value
      ? isActionLoading(buildAccountantDocumentExcelKey(selectedDocument.value))
      : false,
  )
  const metadataStatus = computed(() => {
    if (!hasEditableMetadata.value) {
      return ''
    }

    if (selectedDocumentHasGlobalMetadata.value) {
      return 'Применяются общие реквизиты организации'
    }

    return selectedDocumentHasCustomMetadata.value
      ? 'Общие реквизиты сохранены для текущей формы'
      : 'Используются системные реквизиты'
  })

  function resetAlerts() {
    successMessage.value = ''
    errorMessage.value = ''
  }

  function isActionLoading(key: string) {
    return actionKey.value === key
  }

  function isDocumentLoading(document: AccountantDocumentItem) {
    return (
      isActionLoading(buildAccountantDocumentPreviewKey(document)) ||
      isActionLoading(buildAccountantDocumentExcelKey(document))
    )
  }

  function requireAuthToken(): string {
    if (!auth.token) {
      throw new Error(DEFAULT_AUTH_ERROR)
    }
    return auth.token
  }

  async function loadCategories() {
    categories.value = await getCategories()
    if (!categoryOptions.value.some((category) => category.id === selectedCategoryId.value)) {
      selectedCategoryId.value = ACCOUNTING_ALL_CATEGORIES_ID
    }
  }

  async function loadSummary() {
    const requestId = ++summaryRequestId
    loading.value = true
    try {
      const nextReport = await getMealReport(
        period.value.startDate,
        period.value.endDate,
        selectedCategoryIsAll.value ? undefined : { category_id: selectedCategoryId.value },
      )
      if (requestId !== summaryRequestId) {
        return
      }
      report.value = nextReport
    } catch (error) {
      if (requestId === summaryRequestId) {
        errorMessage.value =
          error instanceof Error ? error.message : DEFAULT_SUMMARY_ERROR
      }
    } finally {
      if (requestId === summaryRequestId) {
        loading.value = false
      }
    }
  }

  async function loadGlobalMetadata() {
    globalMetadataValues.value = (await getAccountingDocumentGlobalMetadata(requireAuthToken())).values
  }

  function invalidateDocumentActions() {
    documentActionId += 1
    actionKey.value = null
  }

  async function withDocumentAction(key: string, action: (actionId: number) => Promise<void>) {
    const actionId = ++documentActionId
    actionKey.value = key
    resetAlerts()
    try {
      await action(actionId)
    } catch (error) {
      if (actionId === documentActionId) {
        errorMessage.value =
          error instanceof Error ? error.message : DEFAULT_DOCUMENT_ERROR
      }
    } finally {
      if (actionId === documentActionId) {
        actionKey.value = null
      }
    }
  }

  function syncSelectedDocument(nextDocument?: AccountantDocumentItem | null) {
    if (nextDocument) {
      selectedDocumentKey.value = nextDocument.key
      return nextDocument
    }

    if (documentCards.value.length === 0) {
      invalidateDocumentActions()
      selectedDocumentKey.value = null
      rawPreviewDocument.value = null
      return null
    }

    if (selectedDocument.value) {
      return selectedDocument.value
    }

    selectedDocumentKey.value = documentCards.value[0]!.key
    return documentCards.value[0]!
  }

  async function openDocumentPreview(nextDocument?: AccountantDocumentItem | null) {
    const target = syncSelectedDocument(nextDocument)
    if (!target) {
      return
    }

    await withDocumentAction(buildAccountantDocumentPreviewKey(target), async (actionId) => {
      const nextPreview = await loadAccountingDocument(target, {
        month: month.value,
        year: year.value,
        token: requireAuthToken(),
      })
      if (actionId !== documentActionId) {
        return
      }
      rawPreviewDocument.value = nextPreview
    })
  }

  async function handleDocumentPreview(document: AccountantDocumentItem) {
    await openDocumentPreview(document)
  }

  function handleSelectedDocumentPrint() {
    if (!selectedDocument.value || !previewDocument.value) {
      return
    }

    resetAlerts()
    try {
      successMessage.value = printAccountingDocument(selectedDocument.value, previewDocument.value)
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : 'Не удалось открыть печатную форму'
    }
  }

  async function handleDocumentExcel(document: AccountantDocumentItem) {
    await withDocumentAction(buildAccountantDocumentExcelKey(document), async (actionId) => {
      const message = await downloadAccountingDocument(document, {
        month: month.value,
        year: year.value,
        token: requireAuthToken(),
      })
      if (actionId !== documentActionId) {
        return
      }
      successMessage.value = message
    })
  }

  async function handleSelectedDocumentExcel() {
    if (!selectedDocument.value) {
      return
    }
    await handleDocumentExcel(selectedDocument.value)
  }

  function handleMetadataToggle() {
    if (!hasEditableMetadata.value) {
      return
    }

    metadataEditorOpen.value = !metadataEditorOpen.value
  }

  async function handleMetadataSave(values: AccountingDocumentMetadataValues) {
    if (!selectedDocument.value) {
      return
    }

    await withDocumentAction(
      buildAccountantDocumentPreviewKey(selectedDocument.value),
      async (actionId) => {
        const nextDocument = await saveAccountingDocumentMetadata(
          selectedDocument.value!,
          {
            month: month.value,
            year: year.value,
            token: requireAuthToken(),
          },
          values,
        )
        if (actionId !== documentActionId) {
          return
        }
        rawPreviewDocument.value = nextDocument
        successMessage.value = METADATA_SAVE_SUCCESS
      },
    )
  }

  async function handleMetadataReset() {
    if (!selectedDocument.value) {
      return
    }

    await withDocumentAction(
      buildAccountantDocumentPreviewKey(selectedDocument.value),
      async (actionId) => {
        const nextDocument = await resetAccountingDocumentMetadata(selectedDocument.value!, {
          month: month.value,
          year: year.value,
          token: requireAuthToken(),
        })
        if (actionId !== documentActionId) {
          return
        }
        rawPreviewDocument.value = nextDocument
        successMessage.value = METADATA_RESET_SUCCESS
      },
    )
  }

  async function handleGlobalMetadataSave(values: AccountingDocumentMetadataValues) {
    if (!selectedDocument.value) {
      return
    }

    await withDocumentAction(
      buildAccountantDocumentPreviewKey(selectedDocument.value),
      async (actionId) => {
        const saved = await saveAccountingDocumentGlobalMetadata(
          { values },
          requireAuthToken(),
        )
        if (actionId !== documentActionId) {
          return
        }

        globalMetadataValues.value = saved.values
        const nextDocument = await loadAccountingDocument(selectedDocument.value!, {
          month: month.value,
          year: year.value,
          token: requireAuthToken(),
        })
        if (actionId !== documentActionId) {
          return
        }

        rawPreviewDocument.value = nextDocument
        successMessage.value = GLOBAL_METADATA_SAVE_SUCCESS
      },
    )
  }

  async function handleGlobalMetadataReset(keys?: string[]) {
    if (!selectedDocument.value) {
      return
    }

    await withDocumentAction(
      buildAccountantDocumentPreviewKey(selectedDocument.value),
      async (actionId) => {
        const saved = await resetAccountingDocumentGlobalMetadata(
          { keys },
          requireAuthToken(),
        )
        if (actionId !== documentActionId) {
          return
        }

        globalMetadataValues.value = saved.values
        const nextDocument = await loadAccountingDocument(selectedDocument.value!, {
          month: month.value,
          year: year.value,
          token: requireAuthToken(),
        })
        if (actionId !== documentActionId) {
          return
        }

        rawPreviewDocument.value = nextDocument
        successMessage.value = GLOBAL_METADATA_RESET_SUCCESS
      },
    )
  }

  async function setCurrentMonth() {
    const current = new Date()
    const nextMonth = current.getMonth() + 1
    const nextYear = current.getFullYear()
    const changed = month.value !== nextMonth || year.value !== nextYear
    month.value = nextMonth
    year.value = nextYear

    if (!changed) {
      await loadSummary()
      await openDocumentPreview()
    }
  }

  async function refreshWorkspace() {
    await loadSummary()
    await openDocumentPreview()
  }

  watch([month, year, selectedCategoryId], () => {
    if (!initialized.value) {
      return
    }
    void loadSummary()
    void openDocumentPreview()
  })

  watch(selectedDocumentKey, () => {
    metadataEditorOpen.value = false
  })

  watch(hasEditableMetadata, (nextValue) => {
    if (!nextValue) {
      metadataEditorOpen.value = false
    }
  })

  onMounted(async () => {
    loading.value = true
    try {
      await loadCategories()
      await loadGlobalMetadata()
      await loadSummary()
      syncSelectedDocument()
      await openDocumentPreview()
      initialized.value = true
    } catch (error) {
      errorMessage.value =
        error instanceof Error
          ? error.message
          : options.loadErrorMessage ?? DEFAULT_LOAD_ERROR
    } finally {
      loading.value = false
    }
  })

  return {
    month,
    year,
    categories,
    selectedCategoryId,
    report,
    previewDocument,
    globalMetadataValues,
    selectedDocument,
    metadataEditorOpen,
    loading,
    successMessage,
    errorMessage,
    currentMonthLabel,
    periodLabel,
    categoryOptions,
    selectedCategoryLabel,
    documentCards,
    metadataSupport,
    globalMetadataSupport,
    documentMetadataSupport,
    hasEditableMetadata,
    selectedDocumentMetadata,
    selectedDocumentGlobalMetadata,
    selectedDocumentHasCustomMetadata,
    selectedDocumentHasGlobalMetadata,
    hasAvailableDocuments,
    totalAmount,
    totalCount,
    rowCount,
    currentSelectionDocuments,
    templateWarning,
    previewLoading,
    selectedDocumentExcelLoading,
    metadataStatus,
    isDocumentLoading,
    handleDocumentPreview,
    handleSelectedDocumentPrint,
    handleDocumentExcel,
    handleSelectedDocumentExcel,
    handleMetadataToggle,
    handleMetadataSave,
    handleMetadataReset,
    handleGlobalMetadataSave,
    handleGlobalMetadataReset,
    openDocumentPreview,
    refreshWorkspace,
    setCurrentMonth,
  }
}
