<script setup lang="ts">
import AppIcon from '@/components/icons/AppIcon.vue'

defineProps<{
  monthLabel: string
  manualBlockedCount: number
  automaticBlockedCount: number
  totalBlockedCount: number
}>()

function formatDayCount(value: number): string {
  const absolute = Math.abs(value) % 100
  const lastDigit = absolute % 10

  if (absolute > 10 && absolute < 20) {
    return `${value} дней`
  }

  if (lastDigit === 1) {
    return `${value} день`
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${value} дня`
  }

  return `${value} дней`
}
</script>

<template>
  <section class="holiday-summary-grid" aria-label="Сводка по календарю">
    <article class="holiday-summary-card">
      <span class="holiday-summary-icon holiday-summary-icon--month">
        <AppIcon name="calendar" />
      </span>
      <div class="holiday-summary-copy">
        <span>Текущий месяц</span>
        <strong>{{ monthLabel }}</strong>
      </div>
    </article>

    <article class="holiday-summary-card">
      <span class="holiday-summary-icon holiday-summary-icon--manual">
        <AppIcon name="handBlock" />
      </span>
      <div class="holiday-summary-copy">
        <span>Ручных блокировок</span>
        <strong>{{ formatDayCount(manualBlockedCount) }}</strong>
      </div>
    </article>

    <article class="holiday-summary-card">
      <span class="holiday-summary-icon holiday-summary-icon--automatic">
        <AppIcon name="calendar" />
      </span>
      <div class="holiday-summary-copy">
        <span>Авто: выходные и праздники</span>
        <strong>{{ formatDayCount(automaticBlockedCount) }}</strong>
      </div>
    </article>

    <article class="holiday-summary-card">
      <span class="holiday-summary-icon holiday-summary-icon--total">
        <AppIcon name="calendarCheck" />
      </span>
      <div class="holiday-summary-copy">
        <span>Всего заблокировано</span>
        <strong>{{ formatDayCount(totalBlockedCount) }}</strong>
      </div>
    </article>
  </section>
</template>

<style scoped>
.holiday-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.holiday-summary-card {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 82px;
  padding: 18px 20px;
  border: 1px solid #dbe5f0;
  border-radius: 18px;
  background: #fff;
}

.holiday-summary-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 16px;
  flex: 0 0 auto;
  border: 1px solid transparent;
}

.holiday-summary-icon--month,
.holiday-summary-icon--automatic {
  background: #eef4ff;
  border-color: #d8e6ff;
  color: #2563eb;
}

.holiday-summary-icon--manual {
  background: #fff3ec;
  border-color: #ffe1d1;
  color: #f97316;
}

.holiday-summary-icon--total {
  background: #eefbf2;
  border-color: #d7f2de;
  color: #16a34a;
}

.holiday-summary-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.holiday-summary-copy span {
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
}

.holiday-summary-copy strong {
  color: #0f172a;
  font-size: 16px;
  line-height: 24px;
}

@media (max-width: 1120px) {
  .holiday-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .holiday-summary-grid {
    grid-template-columns: 1fr;
  }

  .holiday-summary-card {
    min-height: 0;
    padding: 16px;
  }
}
</style>
