<script setup lang="ts">
import { computed, onMounted } from 'vue'

import SectionShortcutNav from '@/components/common/SectionShortcutNav.vue'
import CashierJournalAttentionPanel from '@/components/cashier/CashierJournalAttentionPanel.vue'
import CashierJournalOfflinePanel from '@/components/cashier/CashierJournalOfflinePanel.vue'
import CashierJournalOverviewCards from '@/components/cashier/CashierJournalOverviewCards.vue'
import CashierJournalRecordsTable from '@/components/cashier/CashierJournalRecordsTable.vue'
import CashierJournalScanActivityPanel from '@/components/cashier/CashierJournalScanActivityPanel.vue'
import { useCashierJournal } from '@/composables/useCashierJournal'
import { useAuthStore } from '@/stores/auth'
import { buildCashierJournalScanActivity } from '@/utils/cashierJournalActivity'
import { formatCashierJournalDate } from '@/utils/cashierJournalPresentation'

const { error, events, journal, loading, offlineState, offlineUnavailable, loadJournal } =
  useCashierJournal()
const auth = useAuthStore()

const isCashierRole = computed(() => auth.user?.role === 'cashier')
const periodLabel = computed(() => (journal.value ? formatCashierJournalDate(journal.value.date) : ''))
const scanActivity = computed(() => buildCashierJournalScanActivity(events.value))
const showCashierChecks = computed(() => isCashierRole.value)
const cashierNavItems = computed(() =>
  isCashierRole.value
    ? [
        { label: 'Сводка', to: '/cashier/summary' },
        { label: 'Терминал', to: '/cashier/terminal', tone: 'primary' as const },
      ]
    : [],
)

onMounted(() => {
  void loadJournal()
})
</script>

<template>
  <section class="cashier-journal-page">
    <header class="cashier-journal-hero">
      <div class="cashier-journal-copy">
        <p class="eyebrow">Журнал кассы</p>
        <h1>Проверка выдач и офлайн-контроль</h1>
        <p v-if="periodLabel" class="cashier-journal-period">{{ periodLabel }}</p>
      </div>

      <div class="cashier-journal-actions">
        <SectionShortcutNav
          v-if="isCashierRole"
          back-label="Назад в меню кассы"
          back-to="/cashier"
          :items="cashierNavItems"
        />
        <button type="button" class="cashier-journal-link" @click="void loadJournal()">Обновить</button>
      </div>
    </header>

    <div v-if="offlineUnavailable && !journal" class="cashier-journal-alert cashier-journal-alert-offline">
      <span>{{ error }}</span>
      <SectionShortcutNav
        v-if="isCashierRole"
        back-label="Назад в меню кассы"
        back-to="/cashier"
        :items="[{ label: 'Открыть терминал', to: '/cashier/terminal', tone: 'primary' }]"
      />
    </div>

    <div v-else-if="error" class="cashier-journal-alert">
      {{ error }}
    </div>

    <div v-if="loading && !journal" class="cashier-journal-loading">Загрузка журнала...</div>

    <CashierJournalOverviewCards v-if="journal" :summary="journal.summary" />

    <div class="cashier-journal-grid">
      <CashierJournalAttentionPanel v-if="journal" :items="journal.attention_items" />
      <CashierJournalScanActivityPanel v-if="showCashierChecks" :activity="scanActivity" />
    </div>

    <CashierJournalOfflinePanel v-if="showCashierChecks" :offline-state="offlineState" />

    <CashierJournalRecordsTable v-if="journal" :records="journal.records" />
  </section>
</template>

<style scoped>
.cashier-journal-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.cashier-journal-hero,
.cashier-journal-alert,
.cashier-journal-loading {
  border-radius: var(--radius-xl);
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.84);
  box-shadow: var(--shadow);
}

.cashier-journal-hero {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
  padding: 24px;
  background:
    radial-gradient(circle at top left, rgba(29, 78, 216, 0.12), transparent 36%),
    radial-gradient(circle at bottom right, rgba(14, 116, 144, 0.12), transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.88));
}

.cashier-journal-copy {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cashier-journal-copy h1 {
  margin: 0;
  color: var(--text);
  font-size: clamp(1.9rem, 3vw, 3rem);
}

.cashier-journal-period {
  margin: 0;
  color: var(--text);
  font-weight: 700;
}

.cashier-journal-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.cashier-journal-link {
  min-height: 42px;
  padding: 0 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.92);
  color: var(--text);
  font: inherit;
  font-weight: 700;
}

.cashier-journal-alert,
.cashier-journal-loading {
  padding: 16px 18px;
}

.cashier-journal-alert {
  color: #991b1b;
  background: rgba(254, 242, 242, 0.92);
  border-color: rgba(220, 38, 38, 0.16);
  font-weight: 700;
}

.cashier-journal-alert-offline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  color: #1d4ed8;
  background: rgba(239, 246, 255, 0.92);
  border-color: rgba(29, 78, 216, 0.18);
}

.cashier-journal-loading {
  color: var(--muted);
}

.cashier-journal-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

@media (max-width: 1180px) {
  .cashier-journal-hero,
  .cashier-journal-grid {
    grid-template-columns: 1fr;
    flex-direction: column;
  }
}

@media (max-width: 760px) {
  .cashier-journal-actions,
  .cashier-journal-alert-offline {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
