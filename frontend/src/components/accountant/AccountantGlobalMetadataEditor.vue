<script setup lang="ts">
import { computed, reactive, watch } from 'vue'

import AppIcon from '@/components/icons/AppIcon.vue'
import type {
  AccountingDocumentMetadataFieldDefinition,
  AccountingDocumentMetadataValues,
} from '@/types/accountingDocumentMetadata'

const props = defineProps<{
  values: AccountingDocumentMetadataValues | null
  support: AccountingDocumentMetadataFieldDefinition[]
  hasCustomValues?: boolean
}>()

const emit = defineEmits<{
  save: [values: AccountingDocumentMetadataValues]
  reset: [keys: string[]]
}>()

const form = reactive<Record<string, string>>({})

const groupedFields = computed(() => {
  const groups = new Map<string, AccountingDocumentMetadataFieldDefinition[]>()

  for (const field of props.support) {
    const section = field.section === 'Заголовок' ? 'Организация' : field.section
    const group = groups.get(section)
    if (group) {
      group.push(field)
      continue
    }
    groups.set(section, [field])
  }

  return Array.from(groups.entries()).map(([section, fields]) => ({
    section,
    fields,
  }))
})

const supportedKeys = computed(() => props.support.map((field) => field.key))

watch(
  () => [props.values, props.support] as const,
  ([nextValues, nextSupport]) => {
    for (const key of Object.keys(form)) {
      delete form[key]
    }

    for (const field of nextSupport) {
      form[field.key] = nextValues?.[field.key] ?? field.value ?? ''
    }
  },
  { immediate: true },
)

function handleSave() {
  const nextValues: AccountingDocumentMetadataValues = {}

  for (const field of props.support) {
    nextValues[field.key] = (form[field.key] ?? '').trim()
  }

  emit('save', nextValues)
}

function handleReset() {
  emit('reset', supportedKeys.value)
}
</script>

<template>
  <section class="accountant-global-metadata">
    <header class="accountant-global-metadata__head">
      <div>
        <p>Общие настройки</p>
        <h2>Реквизиты организации</h2>
        <span>Сохраняются один раз и применяются у всех бухгалтеров в предпросмотре, печати и Excel.</span>
      </div>
      <p-tag
        :value="hasCustomValues ? 'Настроено' : 'Системные значения'"
        :severity="hasCustomValues ? 'success' : 'secondary'"
      />
    </header>

    <div v-if="groupedFields.length" class="accountant-global-metadata__sections">
      <section
        v-for="group in groupedFields"
        :key="group.section"
        class="accountant-global-metadata__section"
      >
        <div class="accountant-global-metadata__section-head">
          <strong>{{ group.section }}</strong>
          <span>{{ group.fields.length }} полей</span>
        </div>

        <div class="accountant-global-metadata__grid">
          <label v-for="field in group.fields" :key="field.key" class="field">
            <span>{{ field.label }}</span>
            <p-input-text v-model="form[field.key]" :placeholder="field.placeholder" />
          </label>
        </div>
      </section>
    </div>

    <div v-else class="accountant-global-metadata__empty">
      В выбранном документе нет общих реквизитов организации.
    </div>

    <div class="accountant-global-metadata__actions">
      <p-button
        label="Сохранить для всех"
        :disabled="groupedFields.length === 0"
        @click="handleSave"
      >
        <template #icon>
          <AppIcon name="check" />
        </template>
      </p-button>
      <p-button
        label="Сбросить эти поля"
        severity="secondary"
        outlined
        :disabled="!hasCustomValues"
        @click="handleReset"
      >
        <template #icon>
          <AppIcon name="refresh" />
        </template>
      </p-button>
    </div>
  </section>
</template>

<style scoped>
.accountant-global-metadata {
  display: grid;
  gap: 16px;
  padding: 18px;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  background: #eff6ff;
}

.accountant-global-metadata__head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.accountant-global-metadata__head p,
.accountant-global-metadata__head h2 {
  margin: 0;
}

.accountant-global-metadata__head p {
  color: #2563eb;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.accountant-global-metadata__head h2 {
  margin-top: 4px;
  color: #0f172a;
  font-size: 20px;
  line-height: 26px;
}

.accountant-global-metadata__head span {
  display: block;
  margin-top: 6px;
  color: #475569;
  font-size: 14px;
  line-height: 20px;
}

.accountant-global-metadata__sections {
  display: grid;
  gap: 12px;
}

.accountant-global-metadata__section {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #fff;
}

.accountant-global-metadata__section-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: baseline;
}

.accountant-global-metadata__section-head strong {
  color: #0f172a;
}

.accountant-global-metadata__section-head span {
  color: #64748b;
  font-size: 13px;
}

.accountant-global-metadata__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.accountant-global-metadata__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.accountant-global-metadata__empty {
  padding: 14px;
  border: 1px dashed #bfdbfe;
  border-radius: 8px;
  background: #fff;
  color: #64748b;
}

@media (max-width: 760px) {
  .accountant-global-metadata__head,
  .accountant-global-metadata__section-head {
    flex-direction: column;
  }

  .accountant-global-metadata__grid {
    grid-template-columns: 1fr;
  }

  .accountant-global-metadata__actions :deep(.p-button) {
    width: 100%;
  }
}
</style>
