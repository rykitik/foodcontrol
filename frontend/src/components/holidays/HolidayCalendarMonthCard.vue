<script setup lang="ts">
import type { HolidayCalendarCell } from '@/types'

import {
  getHolidayCellLabel,
  getHolidayCellState,
} from '@/utils/holidayCalendarPresentation'

defineProps<{
  calendarCells: (HolidayCalendarCell | null)[]
  selectedDate: string
  weekdayLabels: string[]
}>()

const emit = defineEmits<{
  selectDate: [dateValue: string]
}>()

const legendItems = [
  { label: 'Обычный день', className: 'ordinary' },
  { label: 'Авто: выходной', className: 'automatic' },
  { label: 'Ручная блокировка', className: 'manual' },
  { label: 'Выбранная дата', className: 'selected' },
]
</script>

<template>
  <p-card class="content-card holiday-month-card">
    <template #title>Календарь месяца</template>
    <template #content>
      <div class="calendar-board">
        <div class="calendar-weekdays">
          <span
            v-for="label in weekdayLabels"
            :key="label"
            :class="{ weekend: label === weekdayLabels[weekdayLabels.length - 1] }"
          >
            {{ label }}
          </span>
        </div>

        <div class="calendar-grid">
          <div
            v-for="(cell, index) in calendarCells"
            :key="cell?.isoDate ?? `blank-${index}`"
            class="calendar-cell"
            :class="{ blank: !cell }"
          >
            <button
              v-if="cell"
              type="button"
              class="calendar-day"
              :class="[
                `calendar-day--${getHolidayCellState(cell)}`,
                { 'calendar-day--selected': selectedDate === cell.isoDate },
              ]"
              :aria-pressed="selectedDate === cell.isoDate"
              @click="emit('selectDate', cell.isoDate)"
            >
              <div class="calendar-day-head">
                <span class="calendar-day-number">{{ cell.day }}</span>
                <span
                  class="calendar-day-dot"
                  :class="`calendar-day-dot--${getHolidayCellState(cell)}`"
                  aria-hidden="true"
                />
              </div>

              <span v-if="getHolidayCellLabel(cell)" class="calendar-day-label">
                {{ getHolidayCellLabel(cell) }}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div class="calendar-legend">
        <div v-for="item in legendItems" :key="item.label" class="calendar-legend-item">
          <span class="calendar-legend-chip" :class="`calendar-legend-chip--${item.className}`" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </div>
      </div>
    </template>
  </p-card>
</template>

<style scoped>
.holiday-month-card :deep(.p-card-content) {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.calendar-board {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.calendar-weekdays,
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}

.calendar-weekdays span {
  padding: 0 4px;
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
}

.calendar-weekdays span.weekend {
  color: #2563eb;
}

.calendar-cell {
  min-width: 0;
}

.calendar-day {
  width: 100%;
  min-height: 84px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 9px;
  border: 1px solid #dbe5f0;
  border-radius: 14px;
  background: #fff;
  text-align: left;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease;
}

.calendar-day:hover {
  border-color: #c8d6ea;
}

.calendar-day:focus-visible {
  outline: 3px solid rgba(59, 130, 246, 0.2);
  outline-offset: 2px;
}

.calendar-day--automatic {
  background: #eef4ff;
  border-color: #cdddfb;
}

.calendar-day--manual {
  background: #effcf3;
  border-color: #bde7c9;
}

.calendar-day--inactive {
  background: #f8fafc;
  border-color: #dbe5f0;
}

.calendar-day--selected {
  border-color: #60a5fa;
  box-shadow: inset 0 0 0 2px rgba(59, 130, 246, 0.36);
}

.calendar-day-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: flex-start;
}

.calendar-day-number {
  color: #0f172a;
  font-size: 15px;
  font-weight: 700;
  line-height: 20px;
}

.calendar-day-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  margin-top: 4px;
  border-radius: 999px;
  background: #d5dbe4;
}

.calendar-day-dot--automatic,
.calendar-legend-chip--automatic {
  background: #3b82f6;
}

.calendar-day-dot--manual,
.calendar-legend-chip--manual {
  background: #22c55e;
}

.calendar-day-dot--inactive {
  background: #94a3b8;
}

.calendar-day-label {
  margin-top: auto;
  color: #2563eb;
  font-size: 11px;
  font-weight: 600;
  line-height: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.calendar-day--manual .calendar-day-label {
  color: #15803d;
}

.calendar-day--inactive .calendar-day-label {
  color: #64748b;
}

.calendar-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  padding-top: 4px;
}

.calendar-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #475569;
  font-size: 13px;
  line-height: 18px;
}

.calendar-legend-chip {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  border-radius: 4px;
  border: 1px solid #dbe5f0;
  background: #fff;
}

.calendar-legend-chip--selected {
  border-width: 2px;
  border-color: #60a5fa;
  background: #eff6ff;
}

@media (max-width: 760px) {
  .calendar-weekdays,
  .calendar-grid {
    gap: 6px;
  }

  .calendar-day {
    min-height: 74px;
    padding: 8px;
  }

  .calendar-day-number {
    font-size: 14px;
  }

  .calendar-day-label,
  .calendar-legend-item {
    font-size: 11px;
    line-height: 14px;
  }
}
</style>
