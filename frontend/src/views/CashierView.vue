<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import journalImage from '@/assets/cashier-menu/journal.png'
import summaryImage from '@/assets/cashier-menu/summary.png'
import terminalImage from '@/assets/cashier-menu/terminal.png'
import AppIcon from '@/components/icons/AppIcon.vue'
import { useCashierLauncher } from '@/composables/useCashierLauncher'

const {
  stats,
  offlineLoading,
  offlineLoadingMessage,
  queueCount,
  needsReviewCount,
  snapshotAgeMs,
  snapshotTone,
  summaryOfflineUnavailable,
  summaryCardSubtitle,
  summaryCardNote,
  buildingLabel,
  servingLabel,
  servingTone,
  preflightMessage,
} = useCashierLauncher()

const currentTimestamp = ref(Date.now())

let clockTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  clockTimer = setInterval(() => {
    currentTimestamp.value = Date.now()
  }, 60_000)
})

onBeforeUnmount(() => {
  if (clockTimer) {
    clearInterval(clockTimer)
    clockTimer = null
  }
})

const networkTone = computed(() => (stats.value ? 'success' : 'warn'))
const networkLabel = computed(() => (stats.value ? 'Интернет доступен' : 'Интернет недоступен'))

const terminalStatusTone = computed(() => (preflightMessage.value ? 'warn' : 'success'))
const terminalStatusLabel = computed(() =>
  preflightMessage.value ? 'Требуется проверка перед работой' : 'Терминал готов к работе',
)

const snapshotHeroLabel = computed(() => {
  if (offlineLoading.value) {
    return 'Оффлайн-данные загружаются'
  }

  if (snapshotTone.value === 'success') {
    return 'Оффлайн-данные готовы'
  }

  if (snapshotTone.value === 'warn') {
    return 'Оффлайн-данные устарели'
  }

  return 'Оффлайн-данные отсутствуют'
})

const snapshotFooterLabel = computed(() => {
  if (offlineLoading.value) {
    return 'Оффлайн-снимок обновляется'
  }

  if (snapshotTone.value === 'success') {
    return 'Оффлайн-снимок актуален'
  }

  if (snapshotTone.value === 'warn') {
    return 'Оффлайн-снимок устарел'
  }

  return 'Оффлайн-снимок отсутствует'
})

const lastSyncLabel = computed(() => {
  if (snapshotAgeMs.value === null || offlineLoading.value) {
    return 'нет данных'
  }

  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(currentTimestamp.value - snapshotAgeMs.value))
})

const formattedTodayAmount = computed(() =>
  new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
  }).format(stats.value?.costToday ?? 0),
)

const summaryMetricsLabel = computed(
  () => `Выдач: ${stats.value?.mealsToday ?? 0} · Сумма: ${formattedTodayAmount.value} ₽`,
)

const journalMetricsLabel = computed(
  () => `На проверке: ${needsReviewCount.value} · Очередь: ${queueCount.value}`,
)
</script>

<template>
  <section class="cashier-menu-page">
    <header class="cashier-menu-hero">
      <div class="cashier-menu-hero-copy">
        <p class="cashier-menu-eyebrow">Касса столовой</p>
        <div class="cashier-menu-title-row">
          <h1>Рабочее место кассира</h1>
          <span class="cashier-menu-building">{{ buildingLabel }}</span>
        </div>
      </div>

      <div class="cashier-menu-statuses" aria-label="Состояние кассы">
        <span class="cashier-status-chip" :class="`tone-${servingTone}`">
          <span class="cashier-status-dot" aria-hidden="true"></span>
          {{ servingLabel }}
        </span>
        <span class="cashier-status-chip tone-neutral">Очередь {{ queueCount }}</span>
        <span class="cashier-status-chip tone-warn">На проверке {{ needsReviewCount }}</span>
        <span
          class="cashier-status-chip"
          :class="[`tone-${snapshotTone}`, { 'is-loading': offlineLoading }]"
        >
          <span class="cashier-status-dot" aria-hidden="true"></span>
          {{ snapshotHeroLabel }}
        </span>
      </div>
    </header>

    <div v-if="offlineLoadingMessage" class="cashier-menu-banner loading">
      <span class="cashier-menu-loader" aria-hidden="true"></span>
      <span>{{ offlineLoadingMessage }}</span>
    </div>

    <div v-else-if="preflightMessage" class="cashier-menu-banner warning">
      {{ preflightMessage }}
    </div>

    <div v-if="stats?.serving_today === false && stats.serving_block_reason" class="cashier-menu-banner">
      {{ stats.serving_block_reason }}
    </div>

    <section class="cashier-terminal-card" aria-labelledby="cashier-terminal-title">
      <div class="cashier-terminal-visual" aria-hidden="true">
        <img :src="terminalImage" alt="" />
      </div>

      <div class="cashier-terminal-content">
        <h2 id="cashier-terminal-title">Терминал</h2>
        <p>Основной режим работы кассира</p>

        <div class="cashier-terminal-ready" :class="`tone-${terminalStatusTone}`">
          <span class="cashier-status-dot" aria-hidden="true"></span>
          {{ terminalStatusLabel }}
        </div>

        <div class="cashier-terminal-actions">
          <RouterLink to="/cashier/terminal" class="cashier-menu-button primary">
            <AppIcon name="open" />
            Открыть терминал
          </RouterLink>
          <RouterLink to="/cashier/terminal" class="cashier-menu-button secondary">
            <AppIcon name="search" />
            Поиск талона
          </RouterLink>
          <RouterLink to="/cashier/journal" class="cashier-menu-button secondary">
            <AppIcon name="students" />
            Оффлайн-очередь
          </RouterLink>
        </div>
      </div>
    </section>

    <div class="cashier-section-grid">
      <component
        :is="summaryOfflineUnavailable ? 'div' : RouterLink"
        :to="summaryOfflineUnavailable ? undefined : '/cashier/summary'"
        class="cashier-section-card"
        :class="{ disabled: summaryOfflineUnavailable }"
        :aria-disabled="summaryOfflineUnavailable ? 'true' : undefined"
      >
        <span class="cashier-section-arrow" aria-hidden="true">
          <AppIcon name="chevronRight" />
        </span>

        <div class="cashier-section-media" aria-hidden="true">
          <img :src="summaryImage" alt="" />
        </div>

        <div class="cashier-section-body">
          <h2>Сводка</h2>
          <p>{{ summaryCardSubtitle }}</p>
          <small v-if="summaryCardNote">{{ summaryCardNote }}</small>

          <p class="cashier-section-metrics">{{ summaryMetricsLabel }}</p>

          <span class="cashier-menu-button outline">
            <AppIcon name="reports" />
            Открыть сводку
          </span>
        </div>
      </component>

      <RouterLink to="/cashier/journal" class="cashier-section-card">
        <span class="cashier-section-arrow" aria-hidden="true">
          <AppIcon name="chevronRight" />
        </span>

        <div class="cashier-section-media" aria-hidden="true">
          <img :src="journalImage" alt="" />
        </div>

        <div class="cashier-section-body">
          <h2>Журнал</h2>
          <p>Операции и оффлайн-контроль</p>

          <p class="cashier-section-metrics">{{ journalMetricsLabel }}</p>

          <span class="cashier-menu-button outline">
            <AppIcon name="document" />
            Открыть журнал
          </span>
        </div>
      </RouterLink>
    </div>

    <footer class="cashier-status-strip" aria-label="Техническое состояние кассы">
      <span class="cashier-status-strip-item" :class="`tone-${networkTone}`">
        <span class="cashier-status-dot" aria-hidden="true"></span>
        {{ networkLabel }}
      </span>
      <span class="cashier-status-strip-item" :class="`tone-${snapshotTone}`">
        <span class="cashier-status-dot" aria-hidden="true"></span>
        {{ snapshotFooterLabel }}
      </span>
      <span class="cashier-status-strip-item tone-neutral">
        <AppIcon name="clock" />
        Последняя синхронизация: <strong>{{ lastSyncLabel }}</strong>
      </span>
    </footer>
  </section>
</template>

<style scoped>
.cashier-menu-page {
  min-height: calc(100dvh - 122px);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cashier-menu-hero,
.cashier-terminal-card,
.cashier-section-card,
.cashier-status-strip {
  border: 1px solid #d8e2ef;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
}

.cashier-menu-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 24px;
  min-height: 118px;
  padding: 24px 32px;
  border-radius: 24px;
  background: linear-gradient(180deg, #f8fbff 0%, #f4faf8 100%);
}

.cashier-menu-hero-copy {
  min-width: 0;
}

.cashier-menu-eyebrow {
  margin: 0 0 8px;
  color: #2563eb;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.cashier-menu-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px 16px;
}

.cashier-menu-title-row h1 {
  margin: 0;
  color: #07172f;
  font-size: 38px;
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: 0;
}

.cashier-menu-building {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  color: #52617a;
  font-size: 15px;
  font-weight: 700;
}

.cashier-menu-statuses {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  max-width: 640px;
}

.cashier-status-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 0 14px;
  border: 1px solid #d7e1ee;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.82);
  color: #24324a;
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
}

.cashier-status-chip.tone-success,
.cashier-status-strip-item.tone-success,
.cashier-terminal-ready.tone-success {
  border-color: rgba(20, 142, 90, 0.25);
  background: rgba(15, 148, 91, 0.08);
  color: #087443;
}

.cashier-status-chip.tone-warn,
.cashier-status-strip-item.tone-warn,
.cashier-terminal-ready.tone-warn {
  border-color: rgba(217, 119, 6, 0.25);
  background: rgba(251, 146, 60, 0.09);
  color: #b45309;
}

.cashier-status-chip.tone-danger,
.cashier-status-strip-item.tone-danger {
  border-color: rgba(220, 38, 38, 0.24);
  background: rgba(239, 68, 68, 0.08);
  color: #b91c1c;
}

.cashier-status-chip.tone-neutral,
.cashier-status-strip-item.tone-neutral {
  border-color: rgba(37, 99, 235, 0.16);
  background: rgba(37, 99, 235, 0.06);
  color: #24446f;
}

.cashier-status-chip.is-loading {
  position: relative;
  overflow: hidden;
}

.cashier-status-chip.is-loading::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(110deg, transparent, rgba(255, 255, 255, 0.48), transparent);
  transform: translateX(-100%);
  animation: cashier-shimmer 1.3s ease-in-out infinite;
}

.cashier-status-dot {
  width: 10px;
  height: 10px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: currentColor;
}

.cashier-menu-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 14px;
  border: 1px solid rgba(220, 38, 38, 0.18);
  background: rgba(239, 68, 68, 0.08);
  color: #991b1b;
  font-weight: 700;
}

.cashier-menu-banner.loading {
  border-color: rgba(37, 99, 235, 0.16);
  background: rgba(37, 99, 235, 0.07);
  color: #1d4ed8;
}

.cashier-menu-banner.warning {
  border-color: rgba(217, 119, 6, 0.2);
  background: rgba(251, 146, 60, 0.1);
  color: #92400e;
}

.cashier-menu-loader {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: currentColor;
  box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.18);
  animation: cashier-pulse 1.2s ease-out infinite;
}

.cashier-terminal-card {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  align-items: center;
  gap: 28px;
  min-height: 224px;
  padding: 28px 32px;
  border-radius: 20px;
}

.cashier-terminal-visual {
  display: grid;
  place-items: center;
  min-width: 0;
}

.cashier-terminal-visual img {
  display: block;
  width: min(184px, 100%);
  height: auto;
}

.cashier-terminal-content {
  min-width: 0;
}

.cashier-terminal-content h2,
.cashier-section-body h2 {
  margin: 0;
  color: #07172f;
  font-weight: 800;
  letter-spacing: 0;
}

.cashier-terminal-content h2 {
  font-size: 34px;
  line-height: 1.05;
}

.cashier-terminal-content p,
.cashier-section-body p {
  margin: 6px 0 0;
  color: #65738c;
  font-size: 16px;
  font-weight: 500;
}

.cashier-terminal-ready {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  color: #087443;
  font-size: 15px;
  font-weight: 700;
}

.cashier-terminal-actions {
  display: grid;
  grid-template-columns: minmax(230px, 330px) minmax(170px, 230px) minmax(190px, 250px);
  gap: 14px;
  margin-top: 18px;
}

.cashier-menu-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 52px;
  padding: 0 20px;
  border: 1px solid #c8d5e7;
  border-radius: 10px;
  background: #fff;
  color: #0c2344;
  font-size: 16px;
  font-weight: 800;
  line-height: 1;
  text-align: center;
  transition:
    transform 0.16s ease,
    border-color 0.16s ease,
    background-color 0.16s ease,
    box-shadow 0.16s ease;
}

.cashier-menu-button :deep(.app-icon),
.cashier-section-arrow :deep(.app-icon),
.cashier-status-strip-item :deep(.app-icon) {
  flex: 0 0 auto;
}

.cashier-menu-button.primary {
  border-color: #0b2348;
  background: linear-gradient(180deg, #102b57 0%, #071e43 100%);
  color: #fff;
  box-shadow: 0 12px 24px rgba(7, 30, 67, 0.16);
}

.cashier-menu-button.secondary {
  background: #fff;
  border-color: #cbd7e7;
  color: #17345f;
}

.cashier-menu-button.outline {
  width: 100%;
  min-height: 46px;
  margin-top: 16px;
  border-color: #14376d;
  background: #fff;
  color: #1f3f72;
}

.cashier-menu-button:hover {
  transform: translateY(-1px);
  border-color: #153b74;
}

.cashier-menu-button.primary:hover {
  box-shadow: 0 16px 28px rgba(7, 30, 67, 0.2);
}

.cashier-section-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.cashier-section-card {
  position: relative;
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  align-items: center;
  gap: 20px;
  min-height: 164px;
  padding: 22px 28px;
  border-radius: 20px;
  color: inherit;
  overflow: hidden;
  transition:
    transform 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease;
}

.cashier-section-card:hover {
  transform: translateY(-1px);
  border-color: rgba(20, 55, 109, 0.36);
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.08);
}

.cashier-section-card.disabled {
  cursor: default;
}

.cashier-section-card.disabled:hover {
  transform: none;
  border-color: #d8e2ef;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
}

.cashier-section-card.disabled .cashier-menu-button {
  color: #64748b;
  border-color: #d4deea;
}

.cashier-section-arrow {
  position: absolute;
  top: 24px;
  right: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #53647f;
}

.cashier-section-media {
  width: 78px;
  height: 78px;
  display: grid;
  place-items: center;
  align-self: start;
  border: 1px solid #dbe5f1;
  border-radius: 14px;
  background: #f4f8fd;
  overflow: hidden;
}

.cashier-section-media img {
  display: block;
  width: 80px;
  max-width: none;
  height: 80px;
  object-fit: cover;
}

.cashier-section-body {
  min-width: 0;
  padding-right: 36px;
}

.cashier-section-body h2 {
  font-size: 25px;
  line-height: 1.1;
}

.cashier-section-body small {
  display: block;
  margin-top: 6px;
  color: #64748b;
  font-weight: 700;
}

.cashier-section-metrics {
  color: #334155;
  font-size: 15px;
  font-weight: 800;
}

.cashier-status-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: center;
  min-height: 48px;
  border-radius: 16px;
  overflow: hidden;
}

.cashier-status-strip-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 48px;
  padding: 0 16px;
  color: #5c6b83;
  font-size: 14px;
  font-weight: 600;
}

.cashier-status-strip-item + .cashier-status-strip-item {
  border-left: 1px solid #dfe7f2;
}

.cashier-status-strip-item :deep(.app-icon) {
  color: #2563eb;
}

.cashier-status-strip-item strong {
  color: #263a59;
  font-weight: 800;
}

@keyframes cashier-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.22);
  }

  70% {
    box-shadow: 0 0 0 10px rgba(37, 99, 235, 0);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(37, 99, 235, 0);
  }
}

@keyframes cashier-shimmer {
  100% {
    transform: translateX(100%);
  }
}

@media (max-width: 1180px) {
  .cashier-menu-hero {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .cashier-menu-statuses {
    justify-content: flex-start;
  }

  .cashier-terminal-actions {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1120px) {
  .cashier-terminal-card {
    grid-template-columns: 190px minmax(0, 1fr);
    padding: 28px;
  }

  .cashier-terminal-actions,
  .cashier-section-grid {
    grid-template-columns: 1fr;
  }

  .cashier-section-card {
    min-height: 156px;
  }

  .cashier-status-strip {
    grid-template-columns: 1fr;
  }

  .cashier-status-strip-item + .cashier-status-strip-item {
    border-left: 0;
    border-top: 1px solid #dfe7f2;
  }
}

@media (max-width: 760px) {
  .cashier-menu-page {
    min-height: auto;
  }

  .cashier-menu-hero,
  .cashier-terminal-card,
  .cashier-section-card {
    border-radius: 16px;
  }

  .cashier-menu-hero {
    padding: 22px;
  }

  .cashier-menu-title-row h1 {
    font-size: 2rem;
  }

  .cashier-status-chip {
    width: 100%;
    justify-content: center;
  }

  .cashier-terminal-card,
  .cashier-section-card {
    grid-template-columns: 1fr;
    gap: 18px;
    padding: 24px;
  }

  .cashier-terminal-visual {
    justify-content: start;
  }

  .cashier-terminal-visual img {
    width: min(184px, 70vw);
  }

  .cashier-terminal-actions {
    gap: 12px;
  }

  .cashier-section-body {
    padding-right: 0;
  }

  .cashier-section-arrow {
    top: 28px;
    right: 28px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cashier-menu-button,
  .cashier-section-card,
  .cashier-menu-loader,
  .cashier-status-chip.is-loading::after {
    animation: none;
    transition: none;
  }
}
</style>
