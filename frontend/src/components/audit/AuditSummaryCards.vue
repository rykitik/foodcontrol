<script setup lang="ts">
import { computed } from 'vue'

import AppIcon from '@/components/icons/AppIcon.vue'

const props = defineProps<{
  filteredCount: number
  loadedCount: number
  todayCount: number
  uniqueActorsCount: number
  attentionCount: number
}>()

const cards = computed(() => [
  { label: 'Показано записей', value: String(props.filteredCount), note: `Загружено: ${props.loadedCount}`, icon: 'reports' as const, tone: 'blue' },
  { label: 'Событий за сегодня', value: String(props.todayCount), note: 'По текущему набору', icon: 'clock' as const, tone: 'green' },
  { label: 'Участников', value: String(props.uniqueActorsCount), note: 'Пользователи и системные записи', icon: 'students' as const, tone: 'violet' },
  { label: 'Требуют внимания', value: String(props.attentionCount), note: 'Сбросы, отключения, неудачные входы', icon: 'alertTriangle' as const, tone: 'orange' },
])
</script>

<template>
  <section class="audit-summary">
    <article v-for="card in cards" :key="card.label" class="audit-summary__card" :class="`tone-${card.tone}`">
      <span class="audit-summary__icon" aria-hidden="true">
        <AppIcon :name="card.icon" />
      </span>
      <div>
        <small>{{ card.label }}</small>
        <strong>{{ card.value }}</strong>
        <span>{{ card.note }}</span>
      </div>
    </article>
  </section>
</template>

<style scoped>
.audit-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.audit-summary__card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 18px;
  border: 1px solid #dce5f1;
  border-radius: 14px;
  background: #fff;
}

.audit-summary__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 46px;
  width: 46px;
  height: 46px;
  border-radius: 12px;
}

.audit-summary__card > div {
  min-width: 0;
}

.audit-summary__card small,
.audit-summary__card strong,
.audit-summary__card span {
  display: block;
}

.audit-summary__card small,
.audit-summary__card span {
  color: #5c6a82;
}

.audit-summary__card strong {
  margin-top: 4px;
  color: #07172f;
  font-size: 28px;
  line-height: 1;
}

.audit-summary__card span {
  margin-top: 6px;
  font-size: 13px;
}

.tone-blue .audit-summary__icon {
  background: #eef5ff;
  color: #0866ff;
}

.tone-green .audit-summary__icon {
  background: #edf9f1;
  color: #0f9f57;
}

.tone-violet .audit-summary__icon {
  background: #f4efff;
  color: #7a42f4;
}

.tone-orange .audit-summary__icon {
  background: #fff4e9;
  color: #f97316;
}

@media (max-width: 1080px) {
  .audit-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .audit-summary {
    grid-template-columns: 1fr;
  }
}
</style>
