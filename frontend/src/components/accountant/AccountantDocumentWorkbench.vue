<script setup lang="ts">
import { computed } from 'vue'

import AccountantDocumentPreviewStage from '@/components/accountant/AccountantDocumentPreviewStage.vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import type { PrintableDocument } from '@/types'
import type { AccountantDocumentItem } from '@/utils/accountingDocumentCatalog'

const props = defineProps<{
  document: AccountantDocumentItem | null
  preview: PrintableDocument | null
  periodLabel: string
  categoryLabel: string
  buildingLabel: string
  loading?: boolean
  excelLoading?: boolean
  metadataStatus?: string
  metadataEditable?: boolean
  metadataOpen?: boolean
}>()

defineEmits<{
  refresh: []
  print: []
  excel: []
  toggleMetadata: []
}>()

const statusLabel = computed(() => {
  if (props.loading) {
    return 'Документ формируется'
  }
  if (props.preview) {
    return 'Документ готов к проверке'
  }
  return 'Выберите документ'
})

const metadataButtonLabel = computed(() =>
  props.metadataOpen ? 'Скрыть реквизиты' : 'Изменить реквизиты',
)
</script>

<template>
  <section class="accountant-workbench">
    <header class="accountant-workbench__header">
      <div class="accountant-workbench__title">
        <h2>{{ document?.title ?? 'Предпросмотр документа' }}</h2>
        <span>{{ statusLabel }}</span>
      </div>

      <span class="accountant-workbench__status">
        {{ preview ? 'Готово' : 'Ожидает выбора' }}
      </span>
    </header>

    <div class="accountant-workbench__meta">
      <span class="accountant-workbench__chip">
        <AppIcon name="calendar" />
        <span>Период: {{ periodLabel }}</span>
      </span>
      <span class="accountant-workbench__chip">
        <AppIcon name="category" />
        <span>Категория: {{ categoryLabel }}</span>
      </span>
      <span class="accountant-workbench__chip">
        <AppIcon name="building" />
        <span>Корпус: {{ buildingLabel }}</span>
      </span>
      <span v-if="metadataStatus" class="accountant-workbench__chip">
        <AppIcon name="document" />
        <span>Реквизиты: {{ metadataStatus }}</span>
      </span>
    </div>

    <div class="accountant-workbench__actions">
      <p-button label="Сформировать" :disabled="!document || loading" @click="$emit('refresh')">
        <template #icon>
          <AppIcon name="open" />
        </template>
      </p-button>
      <p-button
        label="Скачать Excel"
        severity="secondary"
        outlined
        :disabled="!document"
        :loading="excelLoading"
        @click="$emit('excel')"
      >
        <template #icon>
          <AppIcon name="excel" />
        </template>
      </p-button>
      <p-button label="Печать" severity="secondary" outlined :disabled="!preview || loading" @click="$emit('print')">
        <template #icon>
          <AppIcon name="print" />
        </template>
      </p-button>
      <p-button
        v-if="metadataEditable"
        :label="metadataButtonLabel"
        severity="secondary"
        outlined
        :disabled="!document"
        @click="$emit('toggleMetadata')"
      >
        <template #icon>
          <AppIcon name="edit" />
        </template>
      </p-button>
    </div>

    <AccountantDocumentPreviewStage
      :document-title="document?.title ?? 'Документ не выбран'"
      :preview="preview"
      :loading="loading"
      :metadata-status="metadataStatus"
      :frame-key="document?.key"
    />
  </section>
</template>

<style scoped>
.accountant-workbench {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  padding: 22px;
  border: 1px solid #dbe5f0;
  border-radius: 8px;
  background: #fff;
}

.accountant-workbench__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.accountant-workbench__title {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.accountant-workbench__title h2 {
  margin: 0;
  color: #0f172a;
  font-size: 22px;
  line-height: 28px;
}

.accountant-workbench__title span {
  color: #64748b;
  font-size: 14px;
  line-height: 20px;
}

.accountant-workbench__status {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 6px;
  background: #dcfce7;
  color: #15803d;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.accountant-workbench__meta,
.accountant-workbench__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.accountant-workbench__chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  max-width: 100%;
  padding: 0 12px;
  border: 1px solid #dbe5f0;
  border-radius: 6px;
  background: #f8fafc;
  color: #475569;
  font-size: 13px;
  line-height: 18px;
}

.accountant-workbench__chip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.accountant-workbench :deep(.accountant-preview-stage) {
  gap: 10px;
}

.accountant-workbench :deep(.accountant-preview-stage__toolbar) {
  grid-template-columns: 1fr;
  padding: 10px;
  border-radius: 8px;
  background: #f8fafc;
}

.accountant-workbench :deep(.accountant-preview-stage__copy) {
  display: none;
}

.accountant-workbench :deep(.accountant-preview-stage__toolbar-side) {
  justify-items: start;
  max-width: 100%;
}

.accountant-workbench :deep(.accountant-preview-stage__frame-shell) {
  padding: 8px;
  border-radius: 8px;
  background: #f1f5f9;
}

.accountant-workbench :deep(.accountant-preview-stage__frame-viewport) {
  border-radius: 6px;
  max-height: min(72vh, 760px);
}

.accountant-workbench :deep(.accountant-preview-stage__frame-canvas) {
  min-height: 620px;
}

.accountant-workbench :deep(.accountant-preview-stage__frame) {
  border-radius: 4px;
}

@media (max-width: 900px) {
  .accountant-workbench {
    padding: 16px;
  }

  .accountant-workbench__header {
    flex-direction: column;
  }

  .accountant-workbench__chip span {
    white-space: normal;
  }
}

@media (max-width: 640px) {
  .accountant-workbench__actions :deep(.p-button) {
    width: 100%;
  }
}
</style>
