<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import AccountantDocumentCard from '@/components/accountant/AccountantDocumentCard.vue'
import AccountantDocumentMetadataEditor from '@/components/accountant/AccountantDocumentMetadataEditor.vue'
import AccountantDocumentPreview from '@/components/accountant/AccountantDocumentPreview.vue'
import { monthOptions } from '@/config/options'
import { useReportsWorkspace } from '@/composables/useReportsWorkspace'

const props = withDefaults(
  defineProps<{
    eyebrow?: string
    title: string
    subtitle: string
    backPath?: string | null
    backLabel?: string | null
    loadErrorMessage?: string
  }>(),
  {
    eyebrow: '',
    backPath: null,
    backLabel: null,
    loadErrorMessage: 'Не удалось загрузить раздел отчетов',
  },
)

const router = useRouter()
const reports = useReportsWorkspace({
  loadErrorMessage: props.loadErrorMessage,
})

const showBackButton = computed(() => Boolean(props.backPath && props.backLabel))

function handleBack() {
  if (!props.backPath) {
    return
  }

  void router.push(props.backPath)
}
</script>

<template>
  <section class="page-stack reports-page">
    <header class="reports-heading">
      <div class="reports-heading-copy">
        <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
        <h1>{{ title }}</h1>
        <p class="reports-context">{{ subtitle }}</p>
      </div>

      <div class="reports-heading-side">
        <p-tag :value="reports.currentMonthLabel" severity="contrast" />
        <p-tag :value="reports.selectedCategoryLabel" severity="success" />
        <p-button
          v-if="showBackButton"
          :label="backLabel ?? ''"
          severity="secondary"
          outlined
          @click="handleBack"
        />
      </div>
    </header>

    <div class="section-toolbar reports-toolbar">
      <div class="toolbar-actions">
        <label class="field compact-field">
          <span>Месяц</span>
          <p-dropdown
            v-model="reports.month.value"
            :options="monthOptions"
            option-label="label"
            option-value="value"
          />
        </label>
        <label class="field compact-field">
          <span>Год</span>
          <p-input-number
            v-model="reports.year.value"
            :min="2020"
            :max="2100"
            :allow-empty="false"
            :use-grouping="false"
            show-buttons
          />
        </label>
        <label class="field category-field">
          <span>Категория</span>
          <p-dropdown
            v-model="reports.selectedCategoryId.value"
            :options="reports.categoryOptions.value"
            option-label="name"
            option-value="id"
            placeholder="Выберите категорию"
          />
        </label>
        <p-button
          label="Текущий месяц"
          severity="secondary"
          outlined
          :disabled="reports.loading.value"
          @click="void reports.setCurrentMonth()"
        />
      </div>
    </div>

    <p v-if="reports.successMessage.value" class="success-banner">{{ reports.successMessage.value }}</p>
    <p v-if="reports.errorMessage.value" class="error-banner">{{ reports.errorMessage.value }}</p>

    <div class="metric-grid reports-metrics">
      <p-card class="metric-card">
        <template #content>
          <p class="metric-label">Строк в сводке</p>
          <p class="metric-value">{{ reports.rowCount.value }}</p>
        </template>
      </p-card>
      <p-card class="metric-card">
        <template #content>
          <p class="metric-label">Выдач за месяц</p>
          <p class="metric-value">{{ reports.totalCount.value }}</p>
        </template>
      </p-card>
      <p-card class="metric-card">
        <template #content>
          <p class="metric-label">Сумма за месяц</p>
          <p class="metric-value">{{ reports.totalAmount.value.toFixed(2) }} ₽</p>
        </template>
      </p-card>
    </div>

    <AccountantDocumentPreview
      :document="reports.selectedDocument.value"
      :preview="reports.previewDocument.value"
      :period-label="reports.periodLabel.value"
      :category-label="reports.selectedCategoryLabel.value"
      :selection-summary="reports.currentSelectionDocuments.value"
      :warning="reports.templateWarning.value || undefined"
      :loading="reports.previewLoading.value"
      :excel-loading="reports.selectedDocumentExcelLoading.value"
      :metadata-status="reports.metadataStatus.value || undefined"
      :metadata-editable="reports.hasEditableMetadata.value"
      :metadata-open="reports.metadataEditorOpen.value"
      @refresh="void reports.openDocumentPreview()"
      @print="reports.handleSelectedDocumentPrint"
      @excel="void reports.handleSelectedDocumentExcel()"
      @toggle-metadata="reports.handleMetadataToggle"
    />

    <AccountantDocumentMetadataEditor
      v-if="reports.metadataEditorOpen.value && reports.hasEditableMetadata.value"
      :document-title="reports.selectedDocument.value?.title"
      :values="reports.selectedDocumentMetadata.value"
      :support="reports.metadataSupport.value"
      :has-custom-values="reports.selectedDocumentHasCustomMetadata.value"
      @save="reports.handleMetadataSave"
      @reset="reports.handleMetadataReset"
    />

    <div class="reports-secondary-layout">
      <p-card class="content-card reports-documents-card">
        <template #title>Формы</template>
        <template #content>
          <div v-if="reports.hasAvailableDocuments.value" class="reports-doc-grid">
            <AccountantDocumentCard
              v-for="document in reports.documentCards.value"
              :key="document.key"
              :document-key="document.key"
              :title="document.title"
              :description="document.description"
              :badge-label="document.badgeLabel"
              :active="reports.selectedDocument.value?.key === document.key"
              :loading="reports.isDocumentLoading(document)"
              @preview="void reports.handleDocumentPreview(document)"
              @excel="void reports.handleDocumentExcel(document)"
            />
          </div>
          <div v-else class="muted-block">
            {{ reports.templateWarning.value || 'Для выбранного отбора нет доступных эталонных форм.' }}
          </div>
        </template>
      </p-card>

      <p-card class="content-card reports-summary-card">
        <template #title>Сводка по выдаче</template>
        <template #content>
          <div v-if="reports.report.value?.rows?.length" class="report-list">
            <div
              v-for="row in reports.report.value.rows"
              :key="`${row.category}-${row.meal_type}`"
              class="report-item"
            >
              <div>
                <strong>{{ row.category }}</strong>
                <p>{{ row.meal_type === 'breakfast' ? 'Завтрак' : 'Обед' }}</p>
              </div>
              <div class="report-amounts">
                <span>{{ row.count }} шт.</span>
                <strong>{{ row.amount.toFixed(2) }} ₽</strong>
              </div>
            </div>
          </div>
          <div v-else class="muted-block">По выбранным параметрам данных нет.</div>
        </template>
      </p-card>
    </div>
  </section>
</template>

<style scoped>
.reports-page {
  gap: 16px;
}

.reports-heading {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.reports-heading-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.reports-heading-copy h1 {
  margin: 0;
}

.reports-context {
  margin: 0;
  color: #64748b;
  font-size: 14px;
  line-height: 20px;
  max-width: 760px;
}

.reports-heading-side {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: flex-end;
}

.reports-toolbar {
  align-items: flex-end;
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
  width: 100%;
}

.compact-field {
  min-width: 150px;
}

.category-field {
  min-width: 280px;
}

.reports-metrics {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.reports-secondary-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.65fr);
  gap: 18px;
  align-items: start;
}

.reports-documents-card,
.reports-summary-card {
  height: 100%;
}

.reports-doc-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

@media (max-width: 1320px) {
  .reports-doc-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1180px) {
  .reports-secondary-layout,
  .reports-metrics {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 780px) {
  .reports-heading,
  .reports-heading-side,
  .toolbar-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .reports-doc-grid {
    grid-template-columns: 1fr;
  }

  .category-field,
  .compact-field {
    min-width: 0;
  }
}
</style>
