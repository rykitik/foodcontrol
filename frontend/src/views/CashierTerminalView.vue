<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import CashierTerminalSidebar from '@/components/cashier/CashierTerminalSidebar.vue'
import CashierTerminalStatusBoard from '@/components/cashier/CashierTerminalStatusBoard.vue'
import { useCashierScannerCapture } from '@/composables/useCashierScannerCapture'
import { useCashierTerminal } from '@/composables/useCashierTerminal'
import {
  getCachedCashierStartupAssessment,
  runCashierStartupOrchestrator,
} from '@/services/cashierStartupOrchestrator'
import type { CashierStartupAssessment } from '@/types/cashierStartup'

const router = useRouter()

const {
  auth,
  queryValue,
  status,
  statusClass,
  statusKind,
  lookup,
  stats,
  selectedMeals,
  requiresManualMealSelection,
  loading,
  queueCount,
  serviceBlocked,
  terminalStateLabel,
  lastQueryValue,
  lookupStatuses,
  allowedMealsLabel,
  selectionLabel,
  currentStudent,
  autoResetActive,
  autoResetKey,
  autoResetDelayMs,
  cashierTerminalReady,
  initializeCashierTerminalSession,
  submitLookupByCode,
  submitLookup,
  setQueryValue,
  toggleMeal,
  confirmCurrentSelection,
  retryPendingSelections,
} = useCashierTerminal()

const startupAssessment = ref<CashierStartupAssessment | null>(getCachedCashierStartupAssessment())
const isCashierRole = computed(() => auth.user?.role === 'cashier')

const startupState = computed(() => startupAssessment.value?.state ?? 'online_ready')
const startupBlocked = computed(() => startupState.value === 'offline_unavailable')
const showInlineStartupStatus = computed(
  () => Boolean(startupAssessment.value && startupState.value === 'online_ready'),
)
const showStartupBanner = computed(
  () => Boolean(startupAssessment.value && !startupBlocked.value && startupState.value !== 'online_ready'),
)
const startupBannerClass = computed(() => ({
  'cashier-startup-banner-warning': startupState.value === 'offline_stale_warning',
  'cashier-startup-banner-offline': startupState.value === 'offline_ready',
  'cashier-startup-banner-blocked': startupState.value === 'offline_unavailable',
}))
const startupMessage = computed(() => startupAssessment.value?.message || '')
const startupAction = computed(() => startupAssessment.value?.required_action || '')
const startupStateLabel = computed(() => {
  switch (startupState.value) {
    case 'online_ready':
      return 'Онлайн-режим'
    case 'offline_ready':
      return 'Оффлайн-режим'
    case 'offline_stale_warning':
      return 'Оффлайн-режим: данные устарели'
    case 'offline_unavailable':
      return 'Оффлайн-запуск недоступен'
    default:
      return 'Статус терминала'
  }
})
const startupInlineLabel = computed(() => {
  if (startupState.value === 'online_ready') {
    return 'Терминал готов к работе'
  }

  return startupMessage.value
})

const { resetScannerBuffer } = useCashierScannerCapture({
  enabled: () =>
    cashierTerminalReady.value &&
    !loading.value &&
    !startupBlocked.value &&
    !autoResetActive.value,
  onScan: (code) => submitLookupByCode(code),
})

watch(
  () => [autoResetActive.value, loading.value, startupBlocked.value] as const,
  ([autoResetLocked, isLoading, blocked]) => {
    if (autoResetLocked || isLoading || blocked) {
      resetScannerBuffer()
    }
  },
)

function goToLauncher() {
  void router.push('/cashier')
}

async function refreshStartupStatus(force = false) {
  if (!isCashierRole.value) {
    startupAssessment.value = null
    return
  }

  const requestedUserId = auth.user?.id ?? null
  const requestedRole = auth.user?.role ?? null
  const nextAssessment = await runCashierStartupOrchestrator({
    token: auth.token,
    user: auth.user,
    force,
  })

  if (auth.user?.id !== requestedUserId || auth.user?.role !== requestedRole) {
    return
  }

  startupAssessment.value = nextAssessment
}

onMounted(async () => {
  await initializeCashierTerminalSession()
  await refreshStartupStatus(true)
})

watch(
  () => [auth.user?.id ?? null, auth.user?.role ?? null] as const,
  (nextSession, previousSession) => {
    if (!previousSession) {
      return
    }

    if (nextSession[0] === previousSession[0] && nextSession[1] === previousSession[1]) {
      return
    }

    startupAssessment.value = null
  },
)

</script>

<template>
  <section class="cashier-terminal-page">
    <header class="cashier-terminal-head">
      <div class="cashier-terminal-head-copy">
        <p class="cashier-terminal-label">Выдача питания</p>
        <strong class="cashier-terminal-building">{{ auth.user?.building_name || 'Все корпуса' }}</strong>
        <p v-if="showInlineStartupStatus" class="cashier-terminal-startup-inline" :title="startupMessage">
          {{ startupInlineLabel }}
        </p>
      </div>

      <div class="cashier-terminal-head-actions">
        <span class="cashier-terminal-chip neutral">{{ terminalStateLabel }}</span>
        <span class="cashier-terminal-chip service" :class="{ warning: serviceBlocked }">
          {{ serviceBlocked ? 'Закрыто' : 'Открыто' }}
        </span>
        <span class="cashier-terminal-chip queue">{{ `Очередь ${queueCount}` }}</span>
        <button type="button" class="cashier-exit-button" @click="goToLauncher">Выйти из терминала</button>
      </div>
    </header>
    <div v-if="showStartupBanner" class="cashier-startup-banner" :class="startupBannerClass">
      <p class="cashier-startup-banner-title">{{ startupStateLabel }}</p>
      <p>{{ startupMessage }}</p>
      <p v-if="startupAction" class="cashier-startup-banner-action">{{ startupAction }}</p>
    </div>

    <div v-if="startupBlocked" class="cashier-startup-block">
      <h2>Оффлайн-запуск недоступен</h2>
      <p>{{ startupMessage }}</p>
      <p v-if="startupAction" class="cashier-startup-block-action">{{ startupAction }}</p>
      <p-button label="Назад в меню кассы" size="small" outlined @click="goToLauncher" />
    </div>

    <div v-else-if="serviceBlocked" class="cashier-terminal-banner">
      {{ stats?.serving_block_reason || 'Выдача на сегодня закрыта' }}
    </div>

    <div v-if="!startupBlocked" class="cashier-terminal-layout" :class="{ 'single-column': !requiresManualMealSelection }">
      <CashierTerminalStatusBoard
        :status-class="statusClass"
        :status-kind="statusKind"
        :status-title="status.title"
        :status-text="status.text"
        :last-query-value="lastQueryValue"
        :student-name="currentStudent?.name"
        :student-group="currentStudent?.group"
        :ticket-period="currentStudent?.ticketPeriod"
        :issued-amount="currentStudent?.issuedAmount"
        :lookup-statuses="lookupStatuses"
        :selected-meals="selectedMeals"
        :remaining-meals="lookup?.remaining_meals ?? []"
        :allowed-meals-label="allowedMealsLabel"
        :selection-label="selectionLabel"
        :show-manual-meal-controls="requiresManualMealSelection"
        :auto-reset-active="autoResetActive"
        :auto-reset-key="autoResetKey"
        :auto-reset-delay-ms="autoResetDelayMs"
        :query-value="queryValue"
        :queue-count="queueCount"
        :loading="loading"
        @update:query-value="setQueryValue"
        @submit-lookup="submitLookup"
        @retry-queue="retryPendingSelections"
        @toggle-meal="toggleMeal"
      />

      <CashierTerminalSidebar
        v-if="requiresManualMealSelection"
        :remaining-meals="lookup?.remaining_meals ?? []"
        :selected-meals="selectedMeals"
        :loading="loading"
        :show-manual-controls="requiresManualMealSelection"
        @toggle-meal="toggleMeal"
        @confirm="confirmCurrentSelection"
      />
    </div>
  </section>
</template>

<style scoped>
.cashier-terminal-page {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background:
    radial-gradient(circle at top left, rgba(29, 78, 216, 0.12), transparent 34%),
    radial-gradient(circle at top right, rgba(15, 118, 110, 0.1), transparent 28%),
    linear-gradient(180deg, #f8fafc 0%, #eef4ff 100%);
}

.cashier-terminal-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px 18px;
  align-items: center;
  padding: 12px 16px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.6));
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: 0 8px 18px rgba(148, 163, 184, 0.1);
  backdrop-filter: blur(12px);
}

.cashier-terminal-head-copy,
.cashier-terminal-head-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.cashier-terminal-head-copy {
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
}

.cashier-terminal-head-actions {
  flex: 0 1 auto;
  justify-content: flex-end;
  padding-left: 16px;
  border-left: 1px solid rgba(148, 163, 184, 0.12);
}

.cashier-terminal-label {
  color: var(--accent);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.cashier-terminal-building {
  color: var(--text);
  font-size: 1.02rem;
  line-height: 1.1;
}

.cashier-terminal-startup-inline {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #0f766e;
  font-size: 0.78rem;
  font-weight: 700;
}

.cashier-terminal-startup-inline::before {
  content: '';
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #14b8a6;
  box-shadow: 0 0 0 4px rgba(20, 184, 166, 0.16);
}

.cashier-terminal-chip {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.cashier-terminal-chip.neutral {
  background: rgba(15, 23, 42, 0.04);
  border-color: rgba(15, 23, 42, 0.08);
  color: #334155;
}

.cashier-terminal-chip.service {
  background: rgba(21, 128, 61, 0.1);
  border-color: rgba(21, 128, 61, 0.14);
  color: #166534;
}

.cashier-terminal-chip.service.warning {
  background: rgba(180, 83, 9, 0.1);
  border-color: rgba(180, 83, 9, 0.14);
  color: #9a3412;
}

.cashier-terminal-chip.queue {
  background: rgba(29, 78, 216, 0.08);
  border-color: rgba(37, 99, 235, 0.12);
  color: #1d4ed8;
}

.cashier-exit-button {
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.26);
  color: var(--muted);
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease;
}

.cashier-exit-button:hover {
  background: rgba(255, 255, 255, 0.58);
  border-color: rgba(15, 23, 42, 0.14);
  color: var(--text);
}

.cashier-terminal-banner {
  padding: 10px 14px;
  border-radius: 14px;
  background: rgba(220, 38, 38, 0.12);
  border: 1px solid rgba(220, 38, 38, 0.2);
  color: #991b1b;
  font-size: 0.96rem;
  font-weight: 700;
  text-align: center;
}

.cashier-startup-banner {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.16);
  background: rgba(15, 23, 42, 0.06);
  color: #0f172a;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cashier-startup-banner-title {
  margin: 0;
  font-size: 0.76rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.cashier-startup-banner p {
  margin: 0;
}

.cashier-startup-banner-action {
  font-weight: 600;
}

.cashier-startup-banner-offline {
  border-color: rgba(14, 116, 144, 0.35);
  background: rgba(14, 116, 144, 0.1);
}

.cashier-startup-banner-warning {
  border-color: rgba(180, 83, 9, 0.35);
  background: rgba(180, 83, 9, 0.1);
}

.cashier-startup-banner-blocked {
  border-color: rgba(220, 38, 38, 0.3);
  background: rgba(220, 38, 38, 0.12);
}

.cashier-startup-block {
  padding: 16px;
  border-radius: 14px;
  border: 1px solid rgba(220, 38, 38, 0.28);
  background: rgba(220, 38, 38, 0.1);
  color: #7f1d1d;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cashier-startup-block h2,
.cashier-startup-block p {
  margin: 0;
}

.cashier-startup-block-action {
  font-weight: 700;
}

.cashier-terminal-layout {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 2.05fr) minmax(330px, 0.8fr);
  gap: 12px;
  overflow: hidden;
}

.cashier-terminal-layout.single-column {
  grid-template-columns: minmax(0, 1fr);
}

@media (max-width: 1180px) {
  .cashier-terminal-page {
    min-height: auto;
  }

  .cashier-terminal-head {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .cashier-terminal-head-actions {
    justify-content: flex-start;
    padding-left: 0;
    padding-top: 10px;
    border-left: 0;
    border-top: 1px solid rgba(148, 163, 184, 0.18);
  }

  .cashier-terminal-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .cashier-terminal-head {
    padding: 12px 14px;
  }

  .cashier-terminal-head-actions {
    align-items: stretch;
  }

  .cashier-terminal-building {
    font-size: 1.02rem;
  }
}
</style>
