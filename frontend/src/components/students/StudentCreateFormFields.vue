<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import AppIcon from '@/components/icons/AppIcon.vue'
import { buildingOptions } from '@/config/options'
import type { Category, StudentCreateRequest } from '@/types'
import { filterStudentGroupSuggestions } from '@/utils/studentGroups'

const props = withDefaults(
  defineProps<{
    categories: Category[]
    loading?: boolean
    resetKey?: number
    autofocus?: boolean
    submitLabel?: string
    cancelLabel?: string
    buildingId?: number | null
    buildingLabel?: string | null
    lockBuilding?: boolean
    showCancel?: boolean
    compact?: boolean
    groupSuggestions?: string[]
  }>(),
  {
    loading: false,
    resetKey: 0,
    autofocus: false,
    submitLabel: 'Добавить студента',
    cancelLabel: 'Отмена',
    buildingId: null,
    buildingLabel: null,
    lockBuilding: false,
    showCancel: false,
    compact: false,
    groupSuggestions: () => [],
  },
)

const emit = defineEmits<{
  submit: [payload: StudentCreateRequest]
  cancel: []
}>()

const form = reactive({
  full_name: '',
  group_name: '',
  building_id: props.buildingId ?? 1,
  category_id: 0,
})
const filteredGroupSuggestions = ref<string[]>([])

const buildingSummary = computed(() => {
  if (props.buildingLabel) {
    return props.buildingLabel
  }
  const option = buildingOptions.find((item) => item.value === form.building_id)
  return option?.label ?? (form.building_id ? `Корпус ${form.building_id}` : 'Корпус не назначен')
})

const canSubmit = computed(
  () =>
    Boolean(form.full_name.trim() && form.group_name.trim() && form.building_id && form.category_id) &&
    props.categories.length > 0,
)

function syncFormDefaults() {
  if (props.lockBuilding && props.buildingId != null) {
    form.building_id = props.buildingId
  } else if (!form.building_id) {
    form.building_id = props.buildingId ?? 1
  }

  if (!props.categories.some((category) => category.id === form.category_id)) {
    form.category_id = props.categories[0]?.id ?? 0
  }
}

function resetForm() {
  form.full_name = ''
  form.group_name = ''
  form.building_id = props.buildingId ?? 1
  form.category_id = props.categories[0]?.id ?? 0
}

function submitForm() {
  if (!canSubmit.value || props.loading) {
    return
  }

  emit('submit', {
    full_name: form.full_name.trim(),
    group_name: form.group_name.trim(),
    building_id: Number(form.building_id),
    category_id: Number(form.category_id),
  })
}

function completeGroupSearch(event: { query?: string }) {
  filteredGroupSuggestions.value = filterStudentGroupSuggestions(props.groupSuggestions, event.query ?? form.group_name)
}

watch(
  () => props.categories,
  () => {
    syncFormDefaults()
  },
  { immediate: true },
)

watch(
  () => props.buildingId,
  () => {
    syncFormDefaults()
  },
  { immediate: true },
)

watch(
  () => props.resetKey,
  () => {
    resetForm()
  },
)
</script>

<template>
  <form class="student-create-form" :class="{ 'student-create-form--compact': compact }" @submit.prevent="submitForm">
    <label class="field">
      <span class="field-label">ФИО <em>*</em></span>
      <p-input-text
        v-model="form.full_name"
        placeholder="Введите фамилию, имя и отчество"
        :autofocus="autofocus"
      />
    </label>

    <label class="field">
      <span class="field-label">Группа <em>*</em></span>
      <p-auto-complete
        v-model="form.group_name"
        :suggestions="filteredGroupSuggestions"
        :delay="80"
        :min-length="0"
        complete-on-focus
        append-to="body"
        panel-class="student-create-autocomplete-panel"
        placeholder="Введите группу, например ИСП-201"
        @complete="completeGroupSearch"
      />
    </label>

    <div class="student-create-grid">
      <div v-if="lockBuilding" class="field">
        <span class="field-label">Корпус <em>*</em></span>
        <div class="student-create-static-field">
          <span class="student-create-static-field__icon" aria-hidden="true">
            <AppIcon name="building" :size="18" />
          </span>
          <div class="student-create-static-field__copy">
            <strong>{{ buildingSummary }}</strong>
            <p>Определяется вашей учетной записью</p>
          </div>
          <span class="student-create-static-field__lock" aria-hidden="true">
            <AppIcon name="lock" :size="18" />
          </span>
        </div>
      </div>

      <label v-else class="field">
        <span class="field-label">Корпус <em>*</em></span>
        <p-dropdown
          v-model="form.building_id"
          :options="buildingOptions"
          option-label="label"
          option-value="value"
          append-to="body"
          panel-class="student-create-dropdown-panel"
          placeholder="Выберите корпус"
        />
      </label>

      <label class="field">
        <span class="field-label">Категория <em>*</em></span>
        <p-dropdown
          v-model="form.category_id"
          :options="categories"
          option-label="name"
          option-value="id"
          append-to="body"
          panel-class="student-create-dropdown-panel"
          placeholder="Выберите категорию"
        />
      </label>
    </div>

    <div v-if="!categories.length" class="muted-block">Сначала добавьте хотя бы одну категорию питания.</div>

    <div class="student-create-actions" :class="{ 'student-create-actions--with-cancel': showCancel }">
      <p-button
        v-if="showCancel"
        type="button"
        :label="cancelLabel"
        severity="secondary"
        outlined
        @click="emit('cancel')"
      />
      <p-button :label="submitLabel" type="submit" :loading="loading" :disabled="!canSubmit" />
    </div>
  </form>
</template>

<style scoped>
.student-create-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.student-create-form--compact {
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.field-label em {
  color: #ef4444;
  font-style: normal;
}

.field :deep(.p-inputtext),
.field :deep(.p-autocomplete),
.field :deep(.p-dropdown) {
  width: 100%;
}

.field :deep(.p-inputtext),
.field :deep(.p-dropdown) {
  min-height: 48px;
  border-radius: 12px;
  border-color: #d6dde8;
  box-shadow: none;
}

.field :deep(.p-autocomplete-input) {
  width: 100%;
  min-height: 48px;
  border-radius: 12px;
  border-color: #d6dde8;
  box-shadow: none;
}

.field :deep(.p-dropdown-label) {
  padding: 13px 14px;
  color: #0f172a;
}

.student-create-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 18px;
}

.student-create-static-field {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  padding: 11px 14px;
  border-radius: 12px;
  border: 1px solid #d6dde8;
  background: #f8fafc;
  color: #64748b;
}

.student-create-static-field__icon,
.student-create-static-field__lock {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  color: #64748b;
}

.student-create-static-field__copy {
  min-width: 0;
}

.student-create-static-field__copy strong {
  display: block;
  color: #334155;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.student-create-static-field__copy p {
  margin: 2px 0 0;
  color: #94a3b8;
  font-size: 12px;
  line-height: 16px;
}

.student-create-actions {
  display: flex;
  justify-content: flex-end;
}

.student-create-actions--with-cancel {
  justify-content: space-between;
  gap: 12px;
}

.student-create-actions :deep(.p-button) {
  min-height: 44px;
  padding-inline: 20px;
  border-radius: 12px;
}

@media (max-width: 720px) {
  .student-create-grid {
    grid-template-columns: 1fr;
  }

  .student-create-actions,
  .student-create-actions--with-cancel {
    flex-direction: column-reverse;
  }

  .student-create-actions :deep(.p-button) {
    width: 100%;
  }
}

:global(.student-create-dropdown-panel) {
  z-index: 1305 !important;
}

:global(.student-create-autocomplete-panel) {
  z-index: 1305 !important;
}
</style>
