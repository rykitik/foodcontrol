<script setup lang="ts">
import { computed } from 'vue'

import CashierTerminalAutoResetIndicator from '@/components/cashier/CashierTerminalAutoResetIndicator.vue'
import CashierTerminalClock from '@/components/cashier/CashierTerminalClock.vue'
import CashierTerminalMealGrid from '@/components/cashier/CashierTerminalMealGrid.vue'
import CashierTerminalReadyInput from '@/components/cashier/CashierTerminalReadyInput.vue'
import CashierTerminalStudentBanner from '@/components/cashier/CashierTerminalStudentBanner.vue'
import { mealsLabel, resolveRemainingMeals } from '@/composables/cashierTerminal/shared'
import type { MealType } from '@/types'

type StatusKind =
  | 'ready'
  | 'success'
  | 'partial_used'
  | 'already_used'
  | 'blocked'
  | 'holiday'
  | 'invalid'
  | 'error'
  | 'queued'
  | 'info'

const props = defineProps<{
  statusClass: string
  statusKind: StatusKind
  statusTitle: string
  statusText: string
  lastQueryValue: string
  studentName?: string
  studentGroup?: string
  ticketPeriod?: string
  issuedAmount?: string
  lookupStatuses: Array<{
    meal_type: MealType
    issued: boolean
    price: number
  }>
  selectedMeals: MealType[]
  remainingMeals: MealType[]
  allowedMealsLabel: string
  selectionLabel: string
  showManualMealControls: boolean
  autoResetActive: boolean
  autoResetKey: number
  autoResetDelayMs: number
  queryValue: string
  queueCount: number
  loading: boolean
}>()

defineEmits<{
  toggleMeal: [mealType: MealType]
  'update:queryValue': [value: string]
  submitLookup: []
  retryQueue: []
}>()

const stateLabel = computed(() => {
  if (props.statusKind === 'blocked' && props.statusTitle === 'Питание в другом корпусе') {
    return 'ДРУГОЙ КОРПУС'
  }

  const map: Record<StatusKind, string> = {
    ready: 'СКАНИРОВАНИЕ',
    success: 'МОЖНО ВЫДАТЬ',
    partial_used: 'ЧАСТЬ УЖЕ ВЫДАНА',
    already_used: 'УЖЕ ВЫДАНО',
    blocked: 'ВЫДАЧА ЗАПРЕЩЕНА',
    holiday: 'ВЫДАЧА ЗАКРЫТА',
    invalid: 'ТАЛОН НЕ НАЙДЕН',
    error: 'ОШИБКА',
    queued: 'ОФЛАЙН',
    info: 'ПОДТВЕРЖДЕНИЕ',
  }

  return map[props.statusKind]
})

const isReadyState = computed(() => props.statusKind === 'ready')
const hasLastQueryValue = computed(() => Boolean(props.lastQueryValue))
const statusTextSegments = computed(() =>
  props.statusText
    .split('·')
    .map((segment) => segment.trim())
    .filter(Boolean),
)

const statusMetaLabel = computed(() => (hasLastQueryValue.value ? 'Последний код' : 'Последняя проверка'))
const statusMetaValue = computed(() => props.lastQueryValue || 'Нет результата')

const resultHeadline = computed(() => {
  switch (props.statusKind) {
    case 'success':
      return props.statusTitle === 'Часть питания уже выдана' ? 'Можно выдать' : 'Талон принят'
    case 'partial_used':
      return 'Можно выдать'
    case 'already_used':
    case 'holiday':
    case 'invalid':
      return 'Выдача запрещена'
    case 'blocked':
      return props.statusTitle === 'Питание в другом корпусе' ? 'Другой корпус питания' : 'Выдача запрещена'
    case 'queued':
      return 'Выдайте питание'
    case 'info':
      return props.showManualMealControls ? 'Подтвердите выдачу' : 'Требуется внимание'
    case 'error':
      return 'Требуется внимание'
    default:
      return props.statusTitle
  }
})

const resultCardClass = computed(() => ({
  'terminal-result-card--success': props.statusKind === 'success',
  'terminal-result-card--warning': ['partial_used', 'already_used', 'queued', 'info', 'holiday'].includes(props.statusKind),
  'terminal-result-card--reject': props.statusKind === 'invalid',
  'terminal-result-card--danger': ['blocked', 'error'].includes(props.statusKind),
}))

const showSuccessActionLine = computed(() => ['success', 'partial_used'].includes(props.statusKind))
const effectiveRemainingMeals = computed(() => resolveRemainingMeals(props.remainingMeals, props.lookupStatuses))
const showsVoucherEntitlement = computed(() =>
  ['already_used', 'blocked', 'holiday', 'invalid', 'error'].includes(props.statusKind),
)

const successActionLabel = computed(() => {
  if (!showSuccessActionLine.value) {
    return ''
  }

  if (props.showManualMealControls) {
    return 'Доступно'
  }

  return props.statusTitle === 'Выдача подтверждена' ? 'Выдано' : 'Выдать'
})

const successActionValue = computed(() => {
  if (!showSuccessActionLine.value) {
    return ''
  }

  if (props.showManualMealControls) {
    return props.allowedMealsLabel || statusTextSegments.value[0] || 'Нет данных'
  }

  return statusTextSegments.value[0] || props.allowedMealsLabel || 'Нет данных'
})

const successSecondaryText = computed(() => {
  if (!showSuccessActionLine.value) {
    return ''
  }

  return statusTextSegments.value.slice(1).join(' · ')
})

const summaryPrimaryLabel = computed(() => (showsVoucherEntitlement.value ? 'По талону предусмотрено' : 'Можно выдать'))

const summaryPrimaryValue = computed(() => {
  if (isReadyState.value) {
    return 'Определится после проверки'
  }

  if (showsVoucherEntitlement.value) {
    return props.allowedMealsLabel && props.allowedMealsLabel !== '—' ? props.allowedMealsLabel : '—'
  }

  if (effectiveRemainingMeals.value.length) {
    return mealsLabel(effectiveRemainingMeals.value)
  }

  return props.allowedMealsLabel || 'Нет данных'
})

const summarySecondaryLabel = computed(() => (props.showManualMealControls ? 'Выбрано к выдаче' : 'Результат проверки'))

const summarySecondaryValue = computed(() => {
  if (isReadyState.value) {
    return 'Нет результата'
  }

  if (props.statusKind === 'success' || props.statusKind === 'partial_used') {
    return props.statusTitle === 'Выдача подтверждена' ? 'Подтверждено к выдаче' : 'Проверка пройдена'
  }

  return props.showManualMealControls ? props.selectionLabel : props.statusText
})
</script>

<template>
  <section :class="statusClass">
    <div class="terminal-status-head">
      <span class="terminal-state-chip">{{ stateLabel }}</span>
      <div class="terminal-status-meta" :class="{ 'terminal-status-meta--empty': !hasLastQueryValue }">
        <span>{{ statusMetaLabel }}</span>
        <strong>{{ statusMetaValue }}</strong>
      </div>
    </div>

    <div v-if="isReadyState" class="terminal-status-copy terminal-status-copy--ready">
      <span class="terminal-ready-badge">{{ statusTitle }}</span>
      <h1>Сканируйте талон</h1>
      <p>Поднесите талон к сканеру или введите код вручную</p>
      <div class="terminal-ready-clock">
        <CashierTerminalClock variant="hero" />
      </div>
    </div>

    <div v-else class="terminal-result-card" :class="resultCardClass">
      <span class="terminal-result-kicker">{{ stateLabel }}</span>
      <h1>{{ resultHeadline }}</h1>
      <div v-if="showSuccessActionLine" class="terminal-result-action">
        <span>{{ successActionLabel }}</span>
        <strong>{{ successActionValue }}</strong>
      </div>
      <p class="terminal-result-lead">{{ statusTitle }}</p>
      <p v-if="successSecondaryText || !showSuccessActionLine" class="terminal-result-text">
        {{ showSuccessActionLine ? successSecondaryText : statusText }}
      </p>
    </div>

    <CashierTerminalReadyInput
      v-if="isReadyState"
      :model-value="queryValue"
      :queue-count="queueCount"
      :loading="loading"
      @update:model-value="$emit('update:queryValue', $event)"
      @submit="$emit('submitLookup')"
      @retry-queue="$emit('retryQueue')"
    />

    <CashierTerminalStudentBanner
      v-if="studentName"
      :student-name="studentName"
      :student-group="studentGroup"
      :ticket-period="ticketPeriod"
      :issued-amount="issuedAmount"
    />

    <CashierTerminalMealGrid
      v-if="showManualMealControls && lookupStatuses.length"
      :lookup-statuses="lookupStatuses"
      :selected-meals="selectedMeals"
      :remaining-meals="remainingMeals"
      @toggle-meal="$emit('toggleMeal', $event)"
    />

    <div class="terminal-summary-row" :class="{ 'terminal-summary-row--result': !isReadyState }">
      <div class="terminal-summary-card" :class="{ 'terminal-summary-card--reference': showsVoucherEntitlement }">
        <span>{{ summaryPrimaryLabel }}</span>
        <strong>{{ summaryPrimaryValue }}</strong>
      </div>
      <div class="terminal-summary-card terminal-summary-card--issue">
        <span>{{ summarySecondaryLabel }}</span>
        <strong :class="{ 'terminal-summary-value--issue': showManualMealControls }">
          {{ summarySecondaryValue }}
        </strong>
      </div>
    </div>

    <CashierTerminalAutoResetIndicator
      :active="autoResetActive"
      :reset-key="autoResetKey"
      :delay-ms="autoResetDelayMs"
    />
  </section>
</template>

<style scoped>
.cashier-terminal-status {
  --status-bg: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(248, 250, 252, 0.88));
  --status-border: rgba(148, 163, 184, 0.26);
  --status-accent: #0f172a;

  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  padding: 16px;
  border-radius: 24px;
  border: 2px solid var(--status-border);
  background: var(--status-bg);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.cashier-terminal-status.state-ready {
  --status-bg: linear-gradient(180deg, rgba(233, 243, 255, 0.98), rgba(206, 228, 255, 0.94));
  --status-border: rgba(29, 78, 216, 0.48);
  --status-accent: #1e40af;
  box-shadow:
    0 0 0 2px rgba(37, 99, 235, 0.16),
    var(--shadow);
}

.cashier-terminal-status.state-success {
  --status-bg: linear-gradient(180deg, rgba(240, 253, 244, 0.98), rgba(220, 252, 231, 0.93));
  --status-border: rgba(22, 163, 74, 0.44);
  --status-accent: #15803d;
}

.cashier-terminal-status.state-partial_used {
  --status-bg: linear-gradient(180deg, rgba(255, 247, 237, 0.98), rgba(254, 215, 170, 0.42));
  --status-border: rgba(217, 119, 6, 0.5);
  --status-accent: #b45309;
}

.cashier-terminal-status.state-already_used {
  --status-bg: linear-gradient(180deg, rgba(255, 247, 237, 0.98), rgba(254, 215, 170, 0.44));
  --status-border: rgba(217, 119, 6, 0.5);
  --status-accent: #b45309;
}

.cashier-terminal-status.state-blocked {
  --status-bg: linear-gradient(180deg, rgba(241, 245, 249, 0.98), rgba(226, 232, 240, 0.88));
  --status-border: rgba(71, 85, 105, 0.38);
  --status-accent: #334155;
}

.cashier-terminal-status.state-holiday {
  --status-bg: linear-gradient(180deg, rgba(255, 251, 235, 0.98), rgba(254, 243, 199, 0.82));
  --status-border: rgba(180, 83, 9, 0.48);
  --status-accent: #b45309;
}

.cashier-terminal-status.state-invalid {
  --status-bg: linear-gradient(180deg, rgba(255, 247, 237, 0.98), rgba(254, 226, 226, 0.58));
  --status-border: rgba(234, 88, 12, 0.34);
  --status-accent: #c2410c;
  align-self: start;
}

.cashier-terminal-status.state-error {
  --status-bg: linear-gradient(180deg, rgba(254, 242, 242, 0.98), rgba(254, 202, 202, 0.76));
  --status-border: rgba(220, 38, 38, 0.5);
  --status-accent: #b91c1c;
}

.cashier-terminal-status.state-queued,
.cashier-terminal-status.state-info {
  --status-bg: linear-gradient(180deg, rgba(238, 242, 255, 0.98), rgba(224, 231, 255, 0.85));
  --status-border: rgba(79, 70, 229, 0.42);
  --status-accent: #3730a3;
}

.terminal-status-head,
.terminal-summary-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.terminal-status-head {
  align-items: flex-start;
  min-height: 58px;
  padding: 10px 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.84);
}

.terminal-state-chip {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--status-accent);
  color: white;
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.06em;
}

.terminal-status-meta {
  display: grid;
  justify-items: end;
  gap: 3px;
}

.terminal-status-meta span {
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.terminal-status-meta strong {
  color: #475569;
  font-size: 0.98rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.terminal-status-meta--empty strong {
  color: var(--muted);
  font-weight: 600;
}

.terminal-status-copy {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  justify-content: center;
  flex: 1 1 auto;
  text-align: center;
  min-height: 300px;
}

.terminal-status-copy--ready {
  min-height: 220px;
}

.terminal-ready-badge {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 11px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(37, 99, 235, 0.18);
  color: #1d4ed8;
  font-size: 0.76rem;
  font-weight: 800;
}

.terminal-status-copy h1,
.terminal-result-card h1 {
  margin: 0;
  color: var(--status-accent);
  font-size: clamp(3rem, 6.3vw, 5.5rem);
  font-weight: 900;
  line-height: 0.92;
  letter-spacing: -0.05em;
  text-shadow: 0 2px 0 rgba(255, 255, 255, 0.45);
}

.terminal-status-copy p {
  margin: 0;
  color: var(--text);
  font-size: clamp(1.08rem, 1.85vw, 1.55rem);
  font-weight: 700;
  line-height: 1.34;
  max-width: 760px;
}

.terminal-result-card {
  display: grid;
  gap: 12px;
  align-items: start;
  justify-items: center;
  padding: 26px 26px 24px;
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(255, 255, 255, 0.84);
  text-align: center;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.72),
    0 14px 30px rgba(15, 23, 42, 0.08);
}

.terminal-result-card--success {
  background: linear-gradient(180deg, rgba(240, 253, 244, 0.94), rgba(255, 255, 255, 0.9));
  border-color: rgba(22, 163, 74, 0.28);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    0 18px 34px rgba(22, 163, 74, 0.12);
}

.terminal-result-card--warning {
  background: linear-gradient(180deg, rgba(255, 251, 235, 0.96), rgba(255, 255, 255, 0.9));
  border-color: rgba(180, 83, 9, 0.24);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    0 16px 30px rgba(180, 83, 9, 0.1);
}

.terminal-result-card--reject {
  background: linear-gradient(180deg, rgba(255, 247, 237, 0.96), rgba(255, 255, 255, 0.9));
  border-color: rgba(234, 88, 12, 0.22);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    0 16px 30px rgba(234, 88, 12, 0.08);
}

.terminal-result-card--danger {
  background: linear-gradient(180deg, rgba(254, 242, 242, 0.96), rgba(255, 255, 255, 0.9));
  border-color: rgba(220, 38, 38, 0.24);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    0 18px 34px rgba(220, 38, 38, 0.1);
}

.terminal-result-kicker {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 11px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
  color: var(--status-accent);
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.terminal-result-action {
  display: grid;
  gap: 4px;
  justify-items: center;
}

.terminal-result-action span {
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.terminal-result-action strong {
  color: var(--status-accent);
  font-size: clamp(1.9rem, 3.2vw, 2.8rem);
  font-weight: 900;
  line-height: 1.02;
}

.terminal-result-lead,
.terminal-result-text {
  margin: 0;
  max-width: 920px;
}

.terminal-result-lead {
  color: var(--text);
  font-size: clamp(1.24rem, 2.1vw, 1.76rem);
  font-weight: 800;
  line-height: 1.28;
}

.terminal-result-text {
  color: var(--muted);
  font-size: clamp(1rem, 1.55vw, 1.22rem);
  font-weight: 700;
  line-height: 1.38;
}

.terminal-ready-clock {
  margin-top: 6px;
}

.terminal-summary-row {
  gap: 12px;
}

.terminal-summary-row--result {
  gap: 10px;
}

.terminal-summary-card {
  flex: 1 1 0;
  display: grid;
  gap: 8px;
  padding: 16px 18px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.terminal-summary-card span {
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.terminal-summary-card strong {
  color: var(--text);
  font-size: clamp(1.22rem, 1.8vw, 1.7rem);
  line-height: 1.25;
}

.terminal-summary-row--result .terminal-summary-card {
  background: rgba(255, 255, 255, 0.72);
  border-color: rgba(148, 163, 184, 0.12);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.54);
}

.terminal-summary-row--result .terminal-summary-card strong {
  font-size: clamp(1.06rem, 1.45vw, 1.36rem);
}

.terminal-summary-card--reference {
  background: rgba(255, 255, 255, 0.62);
  border-color: rgba(148, 163, 184, 0.1);
}

.terminal-summary-card--reference strong {
  color: #475569;
}

.cashier-terminal-status.state-invalid .terminal-result-card {
  padding: 22px 24px 20px;
}

.cashier-terminal-status.state-invalid .terminal-summary-row {
  gap: 8px;
}

.cashier-terminal-status.state-invalid .terminal-summary-card {
  padding: 14px 16px;
}

.terminal-summary-card--issue {
  border: 1px solid rgba(37, 99, 235, 0.24);
  background: linear-gradient(180deg, rgba(219, 234, 254, 0.56), rgba(255, 255, 255, 0.9));
}

.cashier-terminal-status.state-partial_used .terminal-summary-card--issue {
  border-color: rgba(217, 119, 6, 0.26);
  background: linear-gradient(180deg, rgba(255, 237, 213, 0.72), rgba(255, 255, 255, 0.92));
}

.cashier-terminal-status.state-partial_used .terminal-summary-value--issue {
  color: #7c2d12;
}

.terminal-summary-value--issue {
  color: #0b1b43;
  font-size: clamp(2rem, 4vw, 3.4rem);
  font-weight: 900;
  line-height: 1.05;
}

@media (max-width: 1360px) {
  .terminal-status-copy h1,
  .terminal-result-card h1 {
    font-size: clamp(2.7rem, 5.6vw, 4.8rem);
  }
}

@media (max-width: 760px) {
  .terminal-status-head {
    align-items: stretch;
    flex-direction: column;
  }

  .terminal-status-meta {
    justify-items: start;
  }

  .terminal-summary-row {
    flex-direction: column;
  }
}
</style>
