<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import AccountantDocumentList from '@/components/accountant/AccountantDocumentList.vue'
import AccountantDocumentMetadataEditor from '@/components/accountant/AccountantDocumentMetadataEditor.vue'
import AccountantDocumentWorkbench from '@/components/accountant/AccountantDocumentWorkbench.vue'
import AccountantGlobalMetadataEditor from '@/components/accountant/AccountantGlobalMetadataEditor.vue'
import AccountantReportSummary from '@/components/accountant/AccountantReportSummary.vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import { monthOptions } from '@/config/options'
import { useReportsWorkspace } from '@/composables/useReportsWorkspace'
import type { AccountantDocumentItem } from '@/utils/accountingDocumentCatalog'
import {
  buildAccountantSummaryRows,
  formatAccountingMoney,
  formatAccountingPeriodLabel,
  formatAccountingUpdatedAt,
} from '@/utils/accountantReportPresentation'

const reports = useReportsWorkspace({
  loadErrorMessage: 'Не удалось загрузить страницу бухгалтера',
})

const selectedBuildingId = ref('all')
const lastUpdatedAt = ref(new Date())

const buildingOptions = [{ label: 'Все корпуса', value: 'all' }]
const yearOptions = computed(() => {
  const currentYear = new Date().getFullYear()
  const startYear = Math.min(currentYear - 1, reports.year.value - 1)
  const endYear = Math.max(currentYear + 1, reports.year.value + 1)
  return Array.from({ length: endYear - startYear + 1 }, (_, index) => {
    const value = startYear + index
    return { label: String(value), value }
  })
})

const selectedDocument = computed(() => reports.selectedDocument.value)
const selectedDocumentLoadingKey = computed(() => {
  const loadingDocument = reports.documentCards.value.find((document) => reports.isDocumentLoading(document))
  return loadingDocument?.key ?? null
})
const formattedPeriodLabel = computed(() => formatAccountingPeriodLabel(reports.periodLabel.value))
const summaryRows = computed(() => buildAccountantSummaryRows(reports.report.value?.rows ?? []))
const categoryCount = computed(() => new Set(summaryRows.value.map((row) => row.category)).size)
const updatedAtLabel = computed(() => formatAccountingUpdatedAt(lastUpdatedAt.value))
const selectedBuildingLabel = computed(
  () => buildingOptions.find((option) => option.value === selectedBuildingId.value)?.label ?? 'Все корпуса',
)

async function refreshAll() {
  await reports.refreshWorkspace()
  lastUpdatedAt.value = new Date()
}

function selectDocument(document: AccountantDocumentItem) {
  void reports.handleDocumentPreview(document).then(() => {
    lastUpdatedAt.value = new Date()
  })
}

watch(
  () => [reports.report.value, reports.previewDocument.value],
  () => {
    lastUpdatedAt.value = new Date()
  },
)
</script>

<template>
  <section class="accountant-page">
    <header class="accountant-hero">
      <div class="accountant-hero__copy">
        <p class="accountant-eyebrow">Бухгалтер</p>
        <h1>Формы бухгалтерских документов</h1>
        <p>Печатные формы, итоговые ведомости и Excel-документы по выбранному периоду.</p>
      </div>

      <div class="accountant-hero__badges">
        <span>{{ reports.currentMonthLabel.value }}</span>
        <span>{{ selectedBuildingLabel }}</span>
      </div>
    </header>

    <section class="accountant-filter-panel" aria-label="Фильтры бухгалтерских документов">
      <div class="accountant-filter-panel__controls">
        <label class="field">
          <span>Месяц</span>
          <p-dropdown
            v-model="reports.month.value"
            :options="monthOptions"
            option-label="label"
            option-value="value"
          />
        </label>

        <label class="field">
          <span>Год</span>
          <p-dropdown
            v-model="reports.year.value"
            :options="yearOptions"
            option-label="label"
            option-value="value"
          />
        </label>

        <label class="field">
          <span>Категория</span>
          <p-dropdown
            v-model="reports.selectedCategoryId.value"
            :options="reports.categoryOptions.value"
            option-label="name"
            option-value="id"
          />
        </label>

        <label class="field">
          <span>Корпус</span>
          <p-dropdown
            v-model="selectedBuildingId"
            :options="buildingOptions"
            option-label="label"
            option-value="value"
          />
        </label>

        <p-button
          label="Текущий месяц"
          severity="secondary"
          outlined
          :disabled="reports.loading.value"
          @click="void reports.setCurrentMonth()"
        />

        <p-button
          label="Обновить"
          severity="secondary"
          outlined
          :loading="reports.loading.value"
          @click="void refreshAll()"
        >
          <template #icon>
            <AppIcon name="refresh" />
          </template>
        </p-button>
      </div>

      <div class="accountant-filter-panel__metrics">
        <article>
          <span>Документов</span>
          <strong>{{ reports.documentCards.value.length }}</strong>
        </article>
        <article>
          <span>Выдач за месяц</span>
          <strong>{{ reports.totalCount.value }}</strong>
        </article>
        <article>
          <span>Сумма</span>
          <strong>{{ formatAccountingMoney(reports.totalAmount.value) }}</strong>
        </article>
      </div>
    </section>

    <p v-if="reports.successMessage.value" class="success-banner">{{ reports.successMessage.value }}</p>
    <p v-if="reports.errorMessage.value" class="error-banner">{{ reports.errorMessage.value }}</p>
    <p v-if="reports.templateWarning.value" class="warning-banner">{{ reports.templateWarning.value }}</p>

    <div class="accountant-workspace">
      <AccountantDocumentList
        :documents="reports.documentCards.value"
        :selected-key="selectedDocument?.key"
        :loading-key="selectedDocumentLoadingKey"
        @select="selectDocument"
      />

      <main class="accountant-workspace__main">
        <AccountantDocumentWorkbench
          :document="selectedDocument"
          :preview="reports.previewDocument.value"
          :period-label="formattedPeriodLabel"
          :category-label="reports.selectedCategoryLabel.value"
          :building-label="selectedBuildingLabel"
          :loading="reports.previewLoading.value"
          :excel-loading="reports.selectedDocumentExcelLoading.value"
          :metadata-status="reports.metadataStatus.value || undefined"
          :metadata-editable="reports.hasEditableMetadata.value"
          :metadata-open="reports.metadataEditorOpen.value"
          @refresh="void refreshAll()"
          @print="reports.handleSelectedDocumentPrint"
          @excel="void reports.handleSelectedDocumentExcel()"
          @toggle-metadata="reports.handleMetadataToggle"
        />

        <AccountantGlobalMetadataEditor
          v-if="reports.metadataEditorOpen.value && reports.globalMetadataSupport.value.length"
          :values="reports.selectedDocumentGlobalMetadata.value"
          :support="reports.globalMetadataSupport.value"
          :has-custom-values="reports.selectedDocumentHasGlobalMetadata.value"
          @save="reports.handleGlobalMetadataSave"
          @reset="reports.handleGlobalMetadataReset"
        />

        <AccountantDocumentMetadataEditor
          v-if="reports.metadataEditorOpen.value && reports.documentMetadataSupport.value.length"
          :document-title="selectedDocument?.title"
          :values="reports.selectedDocumentMetadata.value"
          :support="reports.documentMetadataSupport.value"
          :has-custom-values="reports.selectedDocumentHasCustomMetadata.value"
          @save="reports.handleMetadataSave"
          @reset="reports.handleMetadataReset"
        />
      </main>

      <AccountantReportSummary
        :row-count="reports.rowCount.value"
        :total-count="reports.totalCount.value"
        :total-amount="reports.totalAmount.value"
        :category-count="categoryCount"
        :rows="summaryRows"
        :updated-at="updatedAtLabel"
        :ready="Boolean(reports.previewDocument.value)"
      />
    </div>
  </section>
</template>

<style scoped>
.accountant-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.accountant-hero {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
}

.accountant-hero__copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.accountant-eyebrow,
.accountant-hero h1,
.accountant-hero p {
  margin: 0;
}

.accountant-eyebrow {
  color: #2563eb;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.accountant-hero h1 {
  color: #0f172a;
  font-size: 28px;
  line-height: 36px;
}

.accountant-hero p {
  color: #64748b;
  font-size: 14px;
  line-height: 20px;
}

.accountant-hero__badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.accountant-hero__badges span {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 14px;
  border-radius: 6px;
  background: #0f172a;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
}

.accountant-hero__badges span:last-child {
  background: #dcfce7;
  color: #15803d;
}

.accountant-filter-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px;
  align-items: end;
  padding: 16px 18px;
  border: 1px solid #dbe5f0;
  border-radius: 8px;
  background: #fff;
}

.accountant-filter-panel__controls {
  display: grid;
  grid-template-columns:
    minmax(130px, 170px)
    minmax(120px, 150px)
    minmax(180px, 220px)
    minmax(170px, 220px)
    auto
    auto;
  gap: 12px;
  align-items: end;
  min-width: 0;
}

.accountant-filter-panel__controls .field {
  min-width: 0;
}

.accountant-filter-panel__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(120px, 1fr));
  gap: 12px;
}

.accountant-filter-panel__metrics article {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  min-height: 70px;
  padding: 12px 14px;
  border: 1px solid #dbe5f0;
  border-radius: 8px;
  background: #fff;
}

.accountant-filter-panel__metrics span {
  color: #64748b;
  font-size: 13px;
  line-height: 18px;
}

.accountant-filter-panel__metrics strong {
  color: #0f172a;
  font-size: 24px;
  line-height: 30px;
}

.accountant-workspace {
  display: grid;
  grid-template-columns: minmax(260px, 320px) minmax(0, 1fr) minmax(280px, 360px);
  gap: 16px;
  align-items: start;
  min-width: 0;
}

.accountant-workspace__main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.success-banner,
.error-banner,
.warning-banner {
  margin: 0;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid transparent;
  font-size: 14px;
  line-height: 20px;
}

.warning-banner {
  border-color: #fde68a;
  background: #fffbeb;
  color: #92400e;
}

@media (max-width: 1440px) {
  .accountant-filter-panel {
    grid-template-columns: 1fr;
  }

  .accountant-filter-panel__metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1220px) {
  .accountant-workspace {
    grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
  }

  .accountant-workspace > :last-child {
    grid-column: 1 / -1;
  }
}

@media (max-width: 980px) {
  .accountant-filter-panel__controls {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .accountant-workspace {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 680px) {
  .accountant-hero,
  .accountant-hero__badges {
    flex-direction: column;
    align-items: stretch;
  }

  .accountant-hero h1 {
    font-size: 24px;
    line-height: 30px;
  }

  .accountant-filter-panel__controls,
  .accountant-filter-panel__metrics {
    grid-template-columns: 1fr;
  }

  .accountant-filter-panel__controls :deep(.p-button) {
    width: 100%;
  }
}
</style>
