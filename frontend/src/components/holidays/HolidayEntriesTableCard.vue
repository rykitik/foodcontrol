<script setup lang="ts">
import AppIcon from '@/components/icons/AppIcon.vue'
import type { HolidayBlockedRow } from '@/utils/holidayCalendarPresentation'

defineProps<{
  rows: HolidayBlockedRow[]
  monthLabel: string
  canEdit: boolean
}>()

const emit = defineEmits<{
  openDate: [dateValue: string]
  remove: [holidayId: number]
  export: []
}>()
</script>

<template>
  <section class="holiday-table-card">
    <header class="holiday-table-head">
      <div>
        <h2>Даты без выдачи питания в {{ monthLabel }}</h2>
      </div>

      <p-button severity="secondary" outlined @click="emit('export')">
        <template #icon>
          <AppIcon name="excel" />
        </template>
        <span>Экспорт в CSV</span>
      </p-button>
    </header>

    <div v-if="rows.length" class="holiday-table-wrap">
      <table class="holiday-table">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Тип причины</th>
            <th>Способ блокировки</th>
            <th>Комментарий</th>
            <th>Действие</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.key" :class="{ inactive: !row.isActive }">
            <td>
              <button type="button" class="holiday-date-link" @click="emit('openDate', row.isoDate)">
                {{ row.dateLabel }} ({{ row.weekdayShort }})
              </button>
            </td>
            <td>{{ row.reasonLabel }}</td>
            <td>
              <p-tag :value="row.sourceLabel" :severity="row.sourceTone" />
            </td>
            <td>{{ row.comment || '—' }}</td>
            <td>
              <p-button
                v-if="canEdit && row.canDelete && row.entryId"
                severity="danger"
                text
                size="small"
                @click="emit('remove', row.entryId)"
              >
                <template #icon>
                  <AppIcon name="cancel" />
                </template>
              </p-button>
              <span v-else>—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="muted-block">В выбранном месяце нет дат без выдачи питания.</div>
  </section>
</template>

<style scoped>
.holiday-table-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px;
  border: 1px solid #dbe5f0;
  border-radius: 18px;
  background: #fff;
}

.holiday-table-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.holiday-table-head h2 {
  margin: 0;
  color: #0f172a;
  font-size: 20px;
  line-height: 28px;
}

.holiday-table-wrap {
  overflow-x: auto;
  border: 1px solid #edf2f7;
  border-radius: 16px;
}

.holiday-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
}

.holiday-table th,
.holiday-table td {
  padding: 12px 10px;
  border-top: 1px solid #edf2f7;
  text-align: left;
  vertical-align: middle;
}

.holiday-table thead th {
  border-top: 0;
  background: #fbfdff;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
}

.holiday-table tbody td {
  color: #334155;
  font-size: 14px;
  line-height: 20px;
}

.holiday-table tbody tr.inactive td {
  color: #94a3b8;
}

.holiday-table tbody tr:hover td {
  background: #fcfdff;
}

.holiday-date-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: #0f172a;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.holiday-date-link:hover {
  color: #2563eb;
}

@media (max-width: 760px) {
  .holiday-table-card {
    padding: 16px;
  }

  .holiday-table-head {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
