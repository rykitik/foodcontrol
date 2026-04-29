<script setup lang="ts">
import { computed, reactive, watch } from 'vue'

import AppIcon from '@/components/icons/AppIcon.vue'
import type {
  AccountingDocumentMetadataFieldDefinition,
  AccountingDocumentMetadataValues,
} from '@/types/accountingDocumentMetadata'

const props = defineProps<{
  documentTitle?: string
  values: AccountingDocumentMetadataValues | null
  support: AccountingDocumentMetadataFieldDefinition[]
  hasCustomValues?: boolean
}>()

const emit = defineEmits<{
  save: [values: AccountingDocumentMetadataValues]
  reset: []
}>()

const form = reactive<Record<string, string>>({})

const groupedFields = computed(() => {
  const groups = new Map<string, AccountingDocumentMetadataFieldDefinition[]>()

  for (const field of props.support) {
    const existingGroup = groups.get(field.section)
    if (existingGroup) {
      existingGroup.push(field)
      continue
    }
    groups.set(field.section, [field])
  }

  return Array.from(groups.entries()).map(([section, fields]) => ({
    section,
    fields,
  }))
})

watch(
  () => [props.values, props.support] as const,
  ([nextValues, nextSupport]) => {
    for (const key of Object.keys(form)) {
      delete form[key]
    }

    for (const field of nextSupport) {
      form[field.key] = nextValues?.[field.key] ?? ''
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
</script>

<template>
  <p-card class="content-card accountant-metadata-card">
    <template #title>Общие реквизиты формы</template>
    <template #subtitle>
      {{ documentTitle ? `Документ: ${documentTitle}` : 'Выберите форму, чтобы настроить общие реквизиты.' }}
    </template>
    <template #content>
      <div v-if="values" class="accountant-metadata-card__body">
        <div class="accountant-metadata-card__intro">
          <p>
            Здесь редактируется общая версия реквизитов выбранной формы и периода. После сохранения эти значения
            применяются в предпросмотре, печати и Excel у всех бухгалтеров.
          </p>
          <p-tag
            :value="hasCustomValues ? 'Используется общая сохранённая версия' : 'Пока используются системные значения'"
            :severity="hasCustomValues ? 'success' : 'secondary'"
          />
        </div>

        <div v-if="groupedFields.length" class="accountant-metadata-card__sections">
          <section
            v-for="group in groupedFields"
            :key="group.section"
            class="summary-card accountant-metadata-card__section"
          >
            <div class="accountant-metadata-card__section-head">
              <strong>{{ group.section }}</strong>
              <span>{{ group.fields.length }} полей</span>
            </div>

            <div class="form-grid accountant-metadata-card__grid">
              <label v-for="field in group.fields" :key="field.key" class="field">
                <span>{{ field.label }}</span>
                <p-input-text v-model="form[field.key]" :placeholder="field.placeholder" />
              </label>
            </div>
          </section>
        </div>

        <div v-else class="muted-block accountant-metadata-card__empty">
          Для текущей формы нет настраиваемых реквизитов.
        </div>

        <div class="button-row accountant-metadata-card__actions">
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
            label="Сбросить"
            severity="secondary"
            outlined
            :disabled="!hasCustomValues"
            @click="$emit('reset')"
          >
            <template #icon>
              <AppIcon name="refresh" />
            </template>
          </p-button>
        </div>
      </div>

      <div v-else class="muted-block accountant-metadata-card__empty">
        Выберите документ в списке форм. После этого здесь появятся общие реквизиты, которые можно сохранить для всех бухгалтеров.
      </div>
    </template>
  </p-card>
</template>

<style scoped>
.accountant-metadata-card__body {
  display: grid;
  gap: 16px;
}

.accountant-metadata-card__intro {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
}

.accountant-metadata-card__intro p {
  margin: 0;
  max-width: 780px;
  color: var(--muted);
  line-height: 1.5;
}

.accountant-metadata-card__sections {
  display: grid;
  gap: 14px;
}

.accountant-metadata-card__section {
  display: grid;
  gap: 14px;
}

.accountant-metadata-card__section-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: baseline;
}

.accountant-metadata-card__section-head span {
  color: var(--muted);
  font-size: 0.9rem;
}

.accountant-metadata-card__grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.accountant-metadata-card__actions {
  justify-content: flex-start;
}

.accountant-metadata-card__empty {
  margin-top: 4px;
}

@media (max-width: 960px) {
  .accountant-metadata-card__intro,
  .accountant-metadata-card__actions,
  .accountant-metadata-card__section-head {
    flex-direction: column;
    align-items: stretch;
  }

  .accountant-metadata-card__grid {
    grid-template-columns: 1fr;
  }
}
</style>
