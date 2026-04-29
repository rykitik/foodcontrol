<script setup lang="ts">
import { computed, ref } from 'vue'

import type { ImportSummary } from '@/types'

const props = defineProps<{
  loading?: boolean
  busy?: boolean
  summary?: ImportSummary | null
}>()

const emit = defineEmits<{
  downloadTemplate: []
  previewImport: [file: File]
  runImport: [file: File]
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const isDragOver = ref(false)

const templateColumns = ['ФИО', 'Группа', 'Корпус', 'Категория']

const importSteps = [
  {
    title: 'Скачать шаблон',
  },
  {
    title: 'Заполнить данные',
  },
  {
    title: 'Проверить и загрузить',
  },
]

const fileName = computed(() => selectedFile.value?.name ?? 'Файл не выбран')
const shortErrors = computed(() => props.summary?.errors.slice(0, 4) ?? [])
const summaryMetrics = computed(() => {
  if (!props.summary) {
    return []
  }

  return [
    { label: 'Строк', value: props.summary.total_rows },
    { label: 'Создано', value: props.summary.created },
    { label: 'Обновлено', value: props.summary.updated },
    { label: 'Пропущено', value: props.summary.skipped },
  ]
})

function setSelectedFile(file: File | null) {
  selectedFile.value = file
  if (!fileInputRef.value) {
    return
  }

  if (!file) {
    fileInputRef.value.value = ''
  }
}

function openFileDialog() {
  fileInputRef.value?.click()
}

function handleFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  setSelectedFile(file)
}

function clearSelectedFile() {
  setSelectedFile(null)
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  if (props.busy) {
    return
  }
  isDragOver.value = true
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault()
  isDragOver.value = false
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  isDragOver.value = false
  if (props.busy) {
    return
  }

  const file = event.dataTransfer?.files?.[0] ?? null
  setSelectedFile(file)
}

function previewImport() {
  if (!selectedFile.value || props.busy) {
    return
  }

  emit('previewImport', selectedFile.value)
}

function runImport() {
  if (!selectedFile.value || props.busy) {
    return
  }

  emit('runImport', selectedFile.value)
}
</script>

<template>
  <div class="card-stack">
    <div class="card-head">
      <div>
        <span>Импорт студентов</span>
        <strong>Массовая загрузка</strong>
      </div>
      <p-tag value="XLSX шаблон" severity="info" />
    </div>

    <div class="import-shell">
      <div class="import-layout">
        <section class="import-guidance">
          <div class="import-topline">
            <div class="import-badge import-badge-soft">Поддерживаются XLSX, XLS, CSV</div>
          </div>

          <div class="import-section">
            <span class="import-section-label">Порядок работы</span>
            <div class="steps-list">
              <article v-for="(step, index) in importSteps" :key="step.title" class="step-item">
                <span>{{ index + 1 }}</span>
                <div>
                  <strong>{{ step.title }}</strong>
                </div>
              </article>
            </div>
          </div>

          <div class="import-section">
            <span class="import-section-label">Колонки шаблона</span>
            <div class="columns-list">
              <span v-for="column in templateColumns" :key="column" class="column-chip">{{ column }}</span>
            </div>
          </div>
        </section>

        <section class="import-stage">
          <div class="import-stage-card">
            <span class="import-section-label">Файл импорта</span>

            <input ref="fileInputRef" class="file-input" type="file" accept=".xlsx,.xls,.csv" @change="handleFileChange" />

            <button
              type="button"
              class="dropzone"
              :class="{ active: isDragOver, disabled: busy }"
              :disabled="busy"
              @click="openFileDialog"
              @dragover="handleDragOver"
              @dragleave="handleDragLeave"
              @drop="handleDrop"
            >
              <strong>{{ selectedFile ? 'Файл готов к проверке' : 'Перетащите файл сюда или выберите вручную' }}</strong>
              <span>{{ fileName }}</span>
            </button>
          </div>

          <div class="actions-card">
            <span class="import-section-label">Действия</span>
            <div class="actions-grid">
              <p-button label="Скачать шаблон" severity="secondary" outlined @click="$emit('downloadTemplate')" />
              <p-button label="Очистить" severity="secondary" text :disabled="!selectedFile || busy" @click="clearSelectedFile" />
              <p-button label="Проверить файл" :loading="busy" :disabled="!selectedFile || loading" @click="previewImport" />
              <p-button label="Импортировать" text :loading="busy" :disabled="!selectedFile || loading" @click="runImport" />
            </div>
          </div>
        </section>
      </div>

      <div v-if="summaryMetrics.length || shortErrors.length" class="import-results">
        <div v-if="summaryMetrics.length" class="summary-grid">
          <article v-for="metric in summaryMetrics" :key="metric.label" class="summary-tile">
            <span>{{ metric.label }}</span>
            <strong>{{ metric.value }}</strong>
          </article>
        </div>

        <div v-if="shortErrors.length" class="errors-box">
          <strong>Нужно исправить</strong>
          <div v-for="item in shortErrors" :key="`${item.row}-${item.field}-${item.message}`" class="error-row">
            <span>Строка {{ item.row }}</span>
            <p>{{ item.message }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.card-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.card-head span {
  display: block;
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.card-head strong {
  display: block;
  margin-top: 4px;
  color: var(--text);
  font-size: 1.08rem;
}

.import-shell,
.import-guidance,
.import-stage-card,
.actions-card,
.summary-tile,
.errors-box {
  border-radius: var(--radius-xl);
}

.import-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(248, 250, 252, 0.88)),
    radial-gradient(circle at top right, rgba(14, 165, 233, 0.14), transparent 38%);
}

.import-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 0.82fr);
  gap: 16px;
  align-items: start;
}

.import-guidance,
.import-stage-card,
.actions-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.74);
}

.import-stage {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.import-topline {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.import-badge {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.12);
  color: #0369a1;
  font-size: 0.84rem;
  font-weight: 700;
}

.import-badge-soft {
  background: rgba(15, 23, 42, 0.06);
  color: var(--muted);
}

.import-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.import-section-label {
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.steps-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.step-item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 12px;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(255, 255, 255, 0.82);
}

.step-item span {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  flex: 0 0 28px;
  height: 28px;
  border-radius: 999px;
  background: #0f172a;
  color: white;
  font-size: 0.84rem;
  font-weight: 700;
}

.step-item strong,
.summary-tile strong {
  color: var(--text);
}

.step-item strong {
  display: block;
  font-size: 0.94rem;
  line-height: 1.35;
}

.summary-tile span,
.error-row p {
  margin: 0;
}

.summary-tile span {
  color: var(--muted);
}

.columns-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.column-chip {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(29, 78, 216, 0.08);
  color: #1d4ed8;
  font-size: 0.86rem;
  font-weight: 700;
}

.file-input {
  display: none;
}

.dropzone {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
  padding: 20px;
  border-radius: 20px;
  border: 1px dashed rgba(14, 165, 233, 0.4);
  background: rgba(240, 249, 255, 0.76);
  color: inherit;
  text-align: left;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease;
  cursor: pointer;
}

.dropzone strong {
  font-size: 1rem;
  color: var(--text);
}

.dropzone span {
  color: var(--muted);
}

.dropzone.active {
  transform: translateY(-1px);
  border-color: rgba(2, 132, 199, 0.8);
  background: rgba(224, 242, 254, 0.92);
}

.dropzone.disabled {
  cursor: progress;
  opacity: 0.7;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.actions-grid :deep(.p-button) {
  width: 100%;
  justify-content: center;
}

.import-results {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 4px;
  border-top: 1px solid rgba(148, 163, 184, 0.14);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.summary-tile {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.78);
}

.summary-tile strong {
  font-size: 1.2rem;
}

.errors-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid rgba(239, 68, 68, 0.16);
  background: rgba(254, 242, 242, 0.84);
}

.errors-box strong,
.error-row span {
  color: #991b1b;
}

.error-row {
  display: flex;
  gap: 12px;
  align-items: baseline;
}

.error-row span {
  min-width: 72px;
  font-size: 0.84rem;
  font-weight: 700;
}

.error-row p {
  color: #7f1d1d;
}

@media (max-width: 980px) {
  .import-layout,
  .summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .actions-grid {
    grid-template-columns: 1fr;
  }

  .error-row {
    flex-direction: column;
    gap: 4px;
  }
}
</style>
