<script setup lang="ts">
import AppIcon from '@/components/icons/AppIcon.vue'

defineProps<{
  count: number
  busy?: boolean
}>()

const emit = defineEmits<{
  clear: []
  issue: []
}>()

function studentLabel(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100

  if (mod10 === 1 && mod100 !== 11) {
    return 'студент'
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return 'студента'
  }

  return 'студентов'
}
</script>

<template>
  <section class="bulk-bar" aria-label="Массовая выдача талонов">
    <div class="bulk-copy">
      <div class="bulk-icon" aria-hidden="true">
        <AppIcon name="check" />
      </div>
      <div>
        <strong>Выбрано: {{ count }} {{ studentLabel(count) }}</strong>
        <span>Режим массовой выдачи активен</span>
      </div>
    </div>

    <div class="bulk-actions">
      <button type="button" class="bulk-clear" :disabled="busy" @click="emit('clear')">Очистить выбор</button>
      <button type="button" class="bulk-issue" :disabled="busy" @click="emit('issue')">
        <AppIcon name="issue" />
        <span>{{ busy ? 'Выдаем...' : 'Выдать талоны на период' }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.bulk-bar {
  position: sticky;
  top: 12px;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 52px;
  padding: 8px 16px;
  border: 1px solid #cbe7d2;
  border-radius: 14px;
  background: #f4fbf6;
}

.bulk-copy {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.bulk-copy strong,
.bulk-copy span {
  display: block;
  margin: 0;
}

.bulk-copy strong {
  color: #0f172a;
  font-size: 14px;
  line-height: 20px;
}

.bulk-copy span {
  color: #64748b;
  font-size: 12px;
  line-height: 16px;
}

.bulk-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: #16a34a;
  color: #fff;
  flex: 0 0 auto;
}

.bulk-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.bulk-clear,
.bulk-issue {
  min-height: 38px;
  border-radius: 10px;
  font: inherit;
  font-weight: 600;
}

.bulk-clear {
  border: 0;
  background: transparent;
  color: #2563eb;
}

.bulk-issue {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  border: 1px solid #16a34a;
  background: #16a34a;
  color: #fff;
}

.bulk-issue :deep(.app-icon) {
  width: 20px;
  height: 20px;
}

.bulk-clear:disabled,
.bulk-issue:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

@media (max-width: 720px) {
  .bulk-bar {
    align-items: flex-start;
    flex-direction: column;
  }

  .bulk-actions {
    width: 100%;
  }

  .bulk-clear,
  .bulk-issue {
    flex: 1 1 0;
    justify-content: center;
  }
}
</style>
