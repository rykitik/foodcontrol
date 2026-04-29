<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'

import PageLoadingBlock from '@/components/common/PageLoadingBlock.vue'
import HolidayCalendarMonthCard from '@/components/holidays/HolidayCalendarMonthCard.vue'
import HolidayCalendarSummaryCards from '@/components/holidays/HolidayCalendarSummaryCards.vue'
import HolidayCalendarToolbar from '@/components/holidays/HolidayCalendarToolbar.vue'
import HolidayEntriesTableCard from '@/components/holidays/HolidayEntriesTableCard.vue'
import HolidayRangeCreateCard from '@/components/holidays/HolidayRangeCreateCard.vue'
import HolidaySelectedDateCard from '@/components/holidays/HolidaySelectedDateCard.vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import SocialWorkspaceLayout from '@/components/social/SocialWorkspaceLayout.vue'
import { roleHome } from '@/config/navigation'
import { monthOptions } from '@/config/options'
import { useHolidayCalendar } from '@/composables/useHolidayCalendar'
import { useAuthStore } from '@/stores/auth'
import {
  buildHolidayBlockedRows,
  buildHolidayMonthSummary,
  downloadHolidayRowsCsv,
} from '@/utils/holidayCalendarPresentation'

const auth = useAuthStore()

const {
  allHolidays,
  calendarCells,
  canEdit,
  currentMonth,
  currentYear,
  errorMessage,
  holidayForm,
  includeInactive,
  initialize,
  initialized,
  loading,
  rangeForm,
  removeHoliday,
  saveHoliday,
  saveHolidayRange,
  selectDate,
  selectedDate,
  selectedDateMeta,
  shiftMonth,
  successMessage,
  weekdayLabels,
} = useHolidayCalendar()

const currentMonthLabel = computed(() => {
  const monthLabel = monthOptions.find((item) => item.value === currentMonth.value)?.label ?? ''
  return `${monthLabel} ${currentYear.value}`
})

const blockedRows = computed(() => buildHolidayBlockedRows(calendarCells.value))
const monthSummary = computed(() => buildHolidayMonthSummary(blockedRows.value))
const homePath = computed(() => roleHome[auth.effectiveRole ?? auth.userRole ?? 'social'])
const yearOptions = computed(() => {
  const startYear = Math.max(2024, currentYear.value - 2)
  return Array.from({ length: 7 }, (_, index) => {
    const value = startYear + index
    return {
      label: String(value),
      value,
    }
  })
})

function exportCsv() {
  downloadHolidayRowsCsv(blockedRows.value, currentMonthLabel.value)
}

onMounted(async () => {
  await initialize()
})
</script>

<template>
  <SocialWorkspaceLayout active-nav="holidays" :show-supervisor-bar="false">
    <section class="holiday-page">
      <header class="holiday-head">
        <div class="holiday-head-copy">
          <nav class="holiday-breadcrumbs" aria-label="Навигационная цепочка">
            <RouterLink :to="homePath">Рабочий стол</RouterLink>
            <AppIcon name="chevronRight" aria-hidden="true" />
            <span>Календарь</span>
          </nav>
          <h1>Календарь</h1>
          <p class="holiday-copy">
            Воскресенья и государственные праздники блокируются автоматически. Остальные дни можно
            отмечать вручную.
          </p>
        </div>

        <RouterLink :to="homePath" class="holiday-back-link">
          <AppIcon name="chevronLeft" aria-hidden="true" />
          <span>Назад на рабочий стол</span>
        </RouterLink>
      </header>

      <PageLoadingBlock
        v-if="loading && !initialized"
        title="Загрузка календаря"
        description="Получаем праздничные и неучебные даты для выбранного месяца."
      />

      <template v-else>
        <p v-if="successMessage" class="success-banner">{{ successMessage }}</p>
        <p v-if="errorMessage" class="error-banner">{{ errorMessage }}</p>

        <HolidayCalendarSummaryCards
          :month-label="currentMonthLabel"
          :manual-blocked-count="monthSummary.manualBlockedCount"
          :automatic-blocked-count="monthSummary.automaticBlockedCount"
          :total-blocked-count="monthSummary.totalBlockedCount"
        />

        <HolidayCalendarToolbar
          v-model:month="currentMonth"
          v-model:year="currentYear"
          v-model:include-inactive="includeInactive"
          :month-options="monthOptions"
          :year-options="yearOptions"
          @shift="shiftMonth"
        />

        <div class="holiday-layout">
          <HolidayCalendarMonthCard
            :calendar-cells="calendarCells"
            :selected-date="selectedDate"
            :weekday-labels="weekdayLabels"
            @select-date="selectDate"
          />

          <div class="holiday-side">
            <HolidaySelectedDateCard
              :form="holidayForm"
              :selected-date="selectedDate"
              :selected-date-meta="selectedDateMeta"
              :can-edit="canEdit"
              :loading="loading"
              @save="saveHoliday"
              @remove="removeHoliday"
            />

            <HolidayRangeCreateCard
              :can-edit="canEdit"
              :form="rangeForm"
              :all-holidays="allHolidays"
              :loading="loading"
              @save="saveHolidayRange"
            />
          </div>
        </div>

        <HolidayEntriesTableCard
          :rows="blockedRows"
          :month-label="currentMonthLabel"
          :can-edit="canEdit"
          @open-date="selectDate"
          @remove="removeHoliday"
          @export="exportCsv"
        />
      </template>
    </section>
  </SocialWorkspaceLayout>
</template>

<style scoped>
.holiday-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.holiday-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.holiday-head-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.holiday-breadcrumbs {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #64748b;
  font-size: 14px;
  line-height: 20px;
}

.holiday-breadcrumbs a {
  color: #475569;
}

.holiday-breadcrumbs a:hover {
  color: #0f172a;
}

.holiday-breadcrumbs span:last-child {
  color: #1e293b;
}

.holiday-head h1 {
  margin: 0;
  font-size: 28px;
  line-height: 36px;
  color: #111827;
}

.holiday-back-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid #dbe5f0;
  border-radius: 12px;
  background: #fff;
  color: #475569;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  white-space: nowrap;
}

.holiday-back-link:hover {
  color: #0f172a;
}

.holiday-copy {
  max-width: 760px;
  margin: 0;
  color: #64748b;
  font-size: 14px;
  line-height: 20px;
}

.holiday-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(340px, 0.9fr);
  gap: 16px;
  align-items: start;
}

.holiday-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.holiday-page :deep(.content-card) {
  border: 1px solid #dbe5f0;
  border-radius: 18px;
  background: #fff;
  box-shadow: none;
}

.holiday-page :deep(.content-card .p-card-body) {
  gap: 14px;
  padding: 16px 18px;
}

.holiday-page :deep(.content-card .p-card-title) {
  margin: 0;
  color: #0f172a;
  font-size: 18px;
  line-height: 26px;
}

.holiday-page :deep(.content-card .p-card-content) {
  padding-top: 0;
}

@media (max-width: 1180px) {
  .holiday-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .holiday-head {
    flex-direction: column;
  }

  .holiday-head h1 {
    font-size: 24px;
    line-height: 32px;
  }

  .holiday-back-link {
    align-self: flex-start;
  }
}
</style>
