<script setup lang="ts">
import { computed, onMounted } from 'vue'

import SectionShortcutNav from '@/components/common/SectionShortcutNav.vue'
import CashierSummaryBuildingsTable from '@/components/cashier/CashierSummaryBuildingsTable.vue'
import CashierSummaryDailyHistoryTable from '@/components/cashier/CashierSummaryDailyHistoryTable.vue'
import CashierSummaryOverviewCards from '@/components/cashier/CashierSummaryOverviewCards.vue'
import CashierSummaryToolbar from '@/components/cashier/CashierSummaryToolbar.vue'
import { useCashierSummary } from '@/composables/useCashierSummary'
import { useAuthStore } from '@/stores/auth'
import { formatCashierSummaryPeriod } from '@/utils/cashierSummaryPresentation'

const {
  error,
  filterMode,
  loading,
  monthOptions,
  offlineUnavailable,
  selectedMonthValue,
  summary,
  downloadSummaryXlsx,
  loadSummary,
  selectMonth,
  showMonth,
  showToday,
} = useCashierSummary()
const auth = useAuthStore()
const isCashierRole = computed(() => auth.user?.role === 'cashier')

const periodLabel = computed(() => {
  if (!summary.value) {
    return ''
  }
  return formatCashierSummaryPeriod(summary.value.period_start, summary.value.period_end)
})
const cashierNavItems = computed(() =>
  isCashierRole.value
    ? [
        { label: 'Журнал', to: '/cashier/journal' },
        { label: 'Терминал', to: '/cashier/terminal', tone: 'primary' as const },
      ]
    : [],
)

onMounted(() => {
  void loadSummary()
})
</script>

<template>
  <section class="cashier-summary-page">
    <header class="cashier-summary-hero">
      <div class="cashier-summary-copy">
        <p class="eyebrow">Отчеты кассы</p>
        <h1>Дневная сводка</h1>
        <p v-if="periodLabel" class="cashier-summary-period">{{ periodLabel }}</p>
      </div>

      <SectionShortcutNav
        v-if="isCashierRole"
        back-label="Назад в меню кассы"
        back-to="/cashier"
        :items="cashierNavItems"
      />
    </header>

    <CashierSummaryToolbar
      v-if="!offlineUnavailable || summary"
      :filter-mode="filterMode"
      :loading="loading"
      :month-options="monthOptions"
      :selected-month-value="selectedMonthValue"
      :summary="summary"
      @download-xlsx="downloadSummaryXlsx"
      @refresh="loadSummary"
      @select-month="selectMonth"
      @show-month="showMonth"
      @show-today="showToday"
    />

    <div v-if="offlineUnavailable && !summary" class="cashier-summary-alert cashier-summary-alert-offline">
      <span>{{ error }}</span>
      <SectionShortcutNav
        v-if="isCashierRole"
        back-label="Назад в меню кассы"
        back-to="/cashier"
      />
    </div>

    <div v-else-if="error" class="cashier-summary-alert">
      {{ error }}
    </div>

    <div v-if="loading && !summary" class="cashier-summary-loading">Загрузка сводки...</div>

    <template v-else-if="summary">
      <CashierSummaryOverviewCards :summary="summary" />
      <CashierSummaryDailyHistoryTable
        :rows="summary.daily_rows"
        :scope-label="summary.scope.history_scope_label"
      />
      <CashierSummaryBuildingsTable :table="summary.buildings_table" />
    </template>
  </section>
</template>

<style scoped>
.cashier-summary-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.cashier-summary-hero,
.cashier-summary-alert,
.cashier-summary-loading {
  border-radius: var(--radius-xl);
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.84);
  box-shadow: var(--shadow);
}

.cashier-summary-hero {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
  padding: 24px;
  background:
    radial-gradient(circle at top left, rgba(29, 78, 216, 0.12), transparent 36%),
    radial-gradient(circle at bottom right, rgba(15, 118, 110, 0.12), transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.88));
}

.cashier-summary-copy {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cashier-summary-copy h1 {
  margin: 0;
  color: var(--text);
  font-size: clamp(1.9rem, 3vw, 3rem);
}

.cashier-summary-period {
  margin: 0;
  color: var(--text);
  font-weight: 700;
}

.cashier-summary-alert,
.cashier-summary-loading {
  padding: 16px 18px;
}

.cashier-summary-alert {
  color: #991b1b;
  background: rgba(254, 242, 242, 0.92);
  border-color: rgba(220, 38, 38, 0.16);
  font-weight: 700;
}

.cashier-summary-alert-offline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  color: #1d4ed8;
  background: rgba(239, 246, 255, 0.92);
  border-color: rgba(29, 78, 216, 0.18);
}

.cashier-summary-loading {
  color: var(--muted);
}

@media (max-width: 1180px) {
  .cashier-summary-hero {
    flex-direction: column;
  }
}

@media (max-width: 760px) {
  .cashier-summary-alert-offline {
    align-items: stretch;
  }
}
</style>
