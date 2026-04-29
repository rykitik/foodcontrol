<script setup lang="ts">
import { computed } from 'vue'

import AppIcon from '@/components/icons/AppIcon.vue'
import type { AppIconName } from '@/components/icons/appIconRegistry'
import AccountantDocumentPreviewStage from '@/components/accountant/AccountantDocumentPreviewStage.vue'
import type { PrintableDocument } from '@/types'
import type { AccountantDocumentItem } from '@/utils/accountingDocumentCatalog'

const props = defineProps<{
  document: AccountantDocumentItem | null
  preview: PrintableDocument | null
  periodLabel: string
  categoryLabel: string
  selectionSummary: string
  warning?: string
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

const previewStateLabel = computed(() => {
  if (props.loading) {
    return 'Предпросмотр обновляется'
  }
  if (props.preview) {
    return 'Документ готов к проверке'
  }
  return 'Выберите форму для просмотра'
})

const metadataButtonLabel = computed(() => {
  if (!props.metadataEditable) {
    return ''
  }

  return props.metadataOpen ? 'Скрыть реквизиты' : 'Изменить реквизиты'
})

const infoChips = computed(() =>
  [
    {
      label: 'Период',
      value: props.periodLabel,
      icon: 'calendar' as AppIconName,
    },
    {
      label: 'Категория',
      value: props.categoryLabel,
      icon: 'category' as AppIconName,
    },
    {
      label: 'Формы',
      value: props.selectionSummary,
      icon: 'document' as AppIconName,
    },
    props.metadataStatus
      ? {
          label: 'Реквизиты',
          value: props.metadataStatus,
          icon: 'documentPrint' as AppIconName,
          accent: true,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item)),
)
</script>

<template>
  <article class="summary-card accountant-preview-card" data-testid="accountant-preview-card">
    <header class="accountant-preview-card__header">
      <div class="accountant-preview-card__copy">
        <span class="accountant-preview-card__eyebrow">Рабочее превью</span>
        <strong>{{ document?.title ?? 'Предпросмотр документа' }}</strong>
        <p class="accountant-preview-card__lead">{{ previewStateLabel }}</p>
      </div>

      <div class="accountant-preview-card__actions">
        <p-button
          label="Обновить"
          severity="secondary"
          outlined
          :disabled="!document || loading"
          @click="$emit('refresh')"
        >
          <template #icon>
            <AppIcon name="refresh" />
          </template>
        </p-button>
        <p-button label="Печать" :disabled="!preview || loading" @click="$emit('print')">
          <template #icon>
            <AppIcon name="print" />
          </template>
        </p-button>
        <p-button
          label="Excel"
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
        <p-button
          v-if="metadataEditable"
          :label="metadataButtonLabel"
          severity="contrast"
          outlined
          :disabled="!document"
          @click="$emit('toggleMetadata')"
        >
          <template #icon>
            <AppIcon :name="metadataOpen ? 'chevronUp' : 'edit'" />
          </template>
        </p-button>
      </div>
    </header>

    <div class="accountant-preview-card__chips">
      <span
        v-for="item in infoChips"
        :key="item.label"
        :class="[
          'accountant-preview-card__chip',
          { 'accountant-preview-card__chip--accent': item.accent },
        ]"
      >
        <AppIcon :name="item.icon" />
        <span>{{ item.label }}: {{ item.value }}</span>
      </span>
    </div>

    <div v-if="warning" class="accountant-preview-card__warning">
      <AppIcon name="alertTriangle" />
      <span>{{ warning }}</span>
    </div>

    <section class="accountant-preview-card__stage" data-testid="accountant-preview-stage-shell">
      <AccountantDocumentPreviewStage
        :document-title="document?.title ?? 'Документ не выбран'"
        :preview="preview"
        :loading="loading"
        :metadata-status="metadataStatus"
        :frame-key="document?.key"
      />
    </section>
  </article>
</template>

<style scoped>
.accountant-preview-card {
  display: grid;
  gap: 14px;
  padding: 18px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background:
    radial-gradient(circle at top right, rgba(14, 116, 144, 0.08), transparent 30%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.98));
}

.accountant-preview-card__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.accountant-preview-card__copy {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.accountant-preview-card__eyebrow {
  color: #0f766e;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.accountant-preview-card__copy strong {
  color: var(--text);
  font-size: clamp(1.08rem, 1.7vw, 1.45rem);
  line-height: 1.2;
}

.accountant-preview-card__lead {
  margin: 0;
  color: var(--muted);
  line-height: 1.45;
}

.accountant-preview-card__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.accountant-preview-card__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.accountant-preview-card__chip {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  min-height: 36px;
  max-width: 100%;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: rgba(255, 255, 255, 0.86);
  color: var(--muted);
  font-size: 0.92rem;
}

.accountant-preview-card__chip :deep(.app-icon) {
  color: #0f766e;
}

.accountant-preview-card__chip--accent {
  background: rgba(37, 99, 235, 0.1);
  color: #1d4ed8;
  border-color: rgba(37, 99, 235, 0.2);
}

.accountant-preview-card__chip--accent :deep(.app-icon) {
  color: #1d4ed8;
}

.accountant-preview-card__warning {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid rgba(220, 38, 38, 0.14);
  background: rgba(254, 242, 242, 0.92);
  color: var(--danger);
}

.accountant-preview-card__stage {
  display: grid;
  min-width: 0;
}

@media (max-width: 960px) {
  .accountant-preview-card__header {
    flex-direction: column;
  }

  .accountant-preview-card__actions {
    justify-content: flex-start;
  }
}

@media (max-width: 720px) {
  .accountant-preview-card {
    padding: 14px;
  }

  .accountant-preview-card__actions {
    width: 100%;
  }

  .accountant-preview-card__actions :deep(.p-button) {
    width: 100%;
  }
}
</style>
