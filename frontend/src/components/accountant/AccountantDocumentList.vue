<script setup lang="ts">
import { computed } from 'vue'

import AppIcon from '@/components/icons/AppIcon.vue'
import type { AccountantDocumentItem } from '@/utils/accountingDocumentCatalog'
import {
  getAccountantDocumentIcon,
  getAccountantDocumentSubtitle,
} from '@/utils/accountantReportPresentation'

const props = defineProps<{
  documents: AccountantDocumentItem[]
  selectedKey?: string | null
  loadingKey?: string | null
}>()

defineEmits<{
  select: [document: AccountantDocumentItem]
}>()

const hasDocuments = computed(() => props.documents.length > 0)
</script>

<template>
  <aside class="accountant-documents-panel">
    <header class="accountant-documents-panel__head">
      <h2>Документы</h2>
    </header>

    <div v-if="hasDocuments" class="accountant-document-list">
      <button
        v-for="document in documents"
        :key="document.key"
        type="button"
        :class="[
          'accountant-document-row',
          { 'accountant-document-row--active': selectedKey === document.key },
        ]"
        @click="$emit('select', document)"
      >
        <span class="accountant-document-row__icon" aria-hidden="true">
          <AppIcon :name="getAccountantDocumentIcon(document)" />
        </span>

        <span class="accountant-document-row__copy">
          <strong>{{ document.title }}</strong>
          <span>{{ getAccountantDocumentSubtitle(document) }}</span>
        </span>

        <span class="accountant-document-row__status">
          {{ loadingKey === document.key ? 'Готовим' : 'Готов' }}
        </span>
      </button>
    </div>

    <div v-else class="accountant-document-empty">
      Нет доступных документов для выбранных параметров.
    </div>
  </aside>
</template>

<style scoped>
.accountant-documents-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  padding: 18px;
  border: 1px solid #dbe5f0;
  border-radius: 8px;
  background: #fff;
}

.accountant-documents-panel__head h2 {
  margin: 0;
  color: #0f172a;
  font-size: 18px;
  line-height: 24px;
}

.accountant-document-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.accountant-document-row {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  width: 100%;
  min-height: 74px;
  padding: 14px;
  border: 1px solid #dbe5f0;
  border-radius: 8px;
  background: #fff;
  color: #0f172a;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease;
}

.accountant-document-row:hover {
  border-color: #93c5fd;
  background: #f8fbff;
}

.accountant-document-row--active {
  border-color: #3b82f6;
  background: #f8fbff;
  box-shadow: inset 3px 0 0 #3b82f6;
}

.accountant-document-row__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #dcfce7;
  color: #16a34a;
}

.accountant-document-row__copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.accountant-document-row__copy strong,
.accountant-document-row__copy span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.accountant-document-row__copy strong {
  color: #0f172a;
  font-size: 14px;
  line-height: 18px;
}

.accountant-document-row__copy span {
  color: #64748b;
  font-size: 13px;
  line-height: 18px;
}

.accountant-document-row__status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 6px;
  background: #dcfce7;
  color: #15803d;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.accountant-document-empty {
  padding: 16px;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  color: #64748b;
  font-size: 14px;
  line-height: 20px;
}

@media (max-width: 720px) {
  .accountant-document-row {
    grid-template-columns: 32px minmax(0, 1fr);
  }

  .accountant-document-row__status {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
