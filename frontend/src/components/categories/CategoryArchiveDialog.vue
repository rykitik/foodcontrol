<script setup lang="ts">
import { computed } from 'vue'

import type { Category } from '@/types'

const props = defineProps<{
  visible: boolean
  category: Category | null
  categories: Category[]
  replacementCategoryId: number | null
  loading?: boolean
}>()

const emit = defineEmits<{
  cancel: []
  confirm: []
  'update:replacementCategoryId': [value: number | null]
}>()

const replacementOptions = computed(() =>
  props.categories.filter((category) => category.id !== props.category?.id),
)

const replacementId = computed({
  get: () => props.replacementCategoryId,
  set: (value) => emit('update:replacementCategoryId', value),
})

const selectedReplacement = computed(
  () => replacementOptions.value.find((category) => category.id === replacementId.value) ?? null,
)

const canConfirm = computed(() => Boolean(props.category && replacementId.value && !props.loading))
</script>

<template>
  <Teleport to="body">
    <div v-if="visible && category" class="archive-dialog-backdrop" @click.self="$emit('cancel')">
      <section
        class="archive-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-archive-title"
      >
        <header class="archive-dialog__head">
          <div>
            <p class="archive-dialog__eyebrow">Удаление категории</p>
            <h2 id="category-archive-title">Удалить «{{ category.name }}»?</h2>
          </div>
          <button class="archive-dialog__close" type="button" :disabled="loading" @click="$emit('cancel')">
            <span aria-hidden="true">×</span>
            <span class="sr-only">Закрыть</span>
          </button>
        </header>

        <div class="archive-dialog__body">
          <p>
            Категория будет скрыта из справочника. Студентов этой категории нужно перевести в другую активную
            категорию, потому что студент не может оставаться без категории питания.
          </p>

          <label class="archive-dialog__field">
            <span>Перевести студентов в категорию</span>
            <p-dropdown
              v-model="replacementId"
              :options="replacementOptions"
              option-label="name"
              option-value="id"
              append-to="body"
              placeholder="Выберите категорию"
              :disabled="loading || replacementOptions.length === 0"
            />
          </label>

          <div class="archive-dialog__summary">
            <strong>Что произойдет после подтверждения</strong>
            <ul>
              <li>Категория «{{ category.name }}» больше не будет показываться в списках выбора.</li>
              <li>
                Студенты и активные талоны будут переведены
                <template v-if="selectedReplacement">в «{{ selectedReplacement.name }}».</template>
                <template v-else>в выбранную категорию.</template>
              </li>
              <li>История уже выданного питания и отчетные данные не удаляются.</li>
            </ul>
          </div>
        </div>

        <footer class="archive-dialog__actions">
          <p-button label="Отмена" severity="secondary" outlined :disabled="loading" @click="$emit('cancel')" />
          <p-button
            label="Удалить категорию"
            severity="danger"
            :loading="loading"
            :disabled="!canConfirm"
            @click="$emit('confirm')"
          />
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.archive-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgb(15 23 42 / 0.42);
}

.archive-dialog {
  width: min(560px, 100%);
  border: 1px solid #dbe3ee;
  border-radius: 22px;
  background: #fff;
  box-shadow: 0 24px 80px rgb(15 23 42 / 0.22);
}

.archive-dialog__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 24px 16px;
  border-bottom: 1px solid #e9eff7;
}

.archive-dialog__eyebrow {
  margin: 0 0 4px;
  color: #b91c1c;
  font-size: 12px;
  font-weight: 700;
  line-height: 16px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.archive-dialog h2 {
  margin: 0;
  color: #0f172a;
  font-size: 22px;
  line-height: 28px;
}

.archive-dialog__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid #dbe3ee;
  border-radius: 999px;
  background: #fff;
  color: #475569;
  cursor: pointer;
}

.archive-dialog__close:disabled {
  cursor: default;
  opacity: 0.6;
}

.archive-dialog__body {
  display: grid;
  gap: 16px;
  padding: 20px 24px;
}

.archive-dialog__body p {
  margin: 0;
  color: #475569;
  font-size: 14px;
  line-height: 20px;
}

.archive-dialog__field {
  display: grid;
  gap: 8px;
}

.archive-dialog__field span {
  color: #334155;
  font-size: 13px;
  font-weight: 700;
  line-height: 18px;
}

.archive-dialog__summary {
  display: grid;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid #fee2e2;
  border-radius: 16px;
  background: #fef2f2;
}

.archive-dialog__summary strong {
  color: #991b1b;
  font-size: 13px;
  line-height: 18px;
}

.archive-dialog__summary ul {
  display: grid;
  gap: 6px;
  margin: 0;
  padding-left: 18px;
  color: #475569;
  font-size: 13px;
  line-height: 18px;
}

.archive-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px 22px;
  border-top: 1px solid #e9eff7;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

:deep(.p-dropdown) {
  width: 100%;
  border-radius: 12px;
  border-color: #dbe3ee;
  box-shadow: none;
}

@media (max-width: 560px) {
  .archive-dialog-backdrop {
    align-items: flex-end;
    padding: 12px;
  }

  .archive-dialog__actions {
    flex-direction: column-reverse;
  }

  .archive-dialog__actions :deep(.p-button) {
    width: 100%;
  }
}
</style>
