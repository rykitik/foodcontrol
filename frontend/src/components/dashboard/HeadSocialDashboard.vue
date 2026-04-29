<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import PageLoadingBlock from '@/components/common/PageLoadingBlock.vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import type { AppIconName } from '@/components/icons/appIconRegistry'
import { headSocialDashboardKeys, socialWorkspaceSections } from '@/config/socialWorkspace'
import { getTodayStats } from '@/services/api'
import type { DashboardStats } from '@/types'

const stats = ref<DashboardStats | null>(null)
const loading = ref(false)
const initialized = ref(false)
const errorMessage = ref('')

const currencyFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const sectionItems = headSocialDashboardKeys.map((key) => socialWorkspaceSections[key])

const serviceStateLabel = computed(() => {
  if (!stats.value) {
    return 'Загрузка...'
  }

  return stats.value.serving_today ? 'Питание открыто' : 'Питание закрыто'
})

const periodLabel = computed(() => formatDashboardDate(stats.value?.period))
const categoryRows = computed(() => stats.value?.byCategory ?? [])

const totalCount = computed(() => categoryRows.value.reduce((sum, row) => sum + row.count, 0))
const totalAmount = computed(() => categoryRows.value.reduce((sum, row) => sum + row.amount, 0))

const statCards = computed<
  Array<{ key: string; icon: AppIconName; label: string; value: string; note: string }>
>(() => [
  {
    key: 'students',
    icon: 'students',
    label: 'Студентов',
    value: formatInteger(stats.value?.studentsTotal ?? 0),
    note: 'Всего в системе',
  },
  {
    key: 'tickets',
    icon: 'issue',
    label: 'Активных талонов',
    value: formatInteger(stats.value?.ticketsActive ?? 0),
    note: 'На сегодня',
  },
  {
    key: 'issued',
    icon: 'clipboardCheck',
    label: 'Выдано сегодня',
    value: formatInteger(stats.value?.mealsToday ?? 0),
    note: 'Талонов выдано',
  },
  {
    key: 'amount',
    icon: 'ruble',
    label: 'Сумма за день',
    value: formatCurrency(stats.value?.costToday ?? 0),
    note: 'По выданным талонам',
  },
])

function formatInteger(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value)
}

function formatCurrency(value: number): string {
  return `${currencyFormatter.format(value)} ₽`
}

function formatDashboardDate(value?: string | null): string {
  if (!value) {
    return 'Сегодня'
  }

  return dateFormatter.format(new Date(`${value}T00:00:00`))
}

async function loadStats() {
  loading.value = true
  errorMessage.value = ''

  try {
    stats.value = await getTodayStats()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Не удалось загрузить рабочий стол'
  } finally {
    loading.value = false
    initialized.value = true
  }
}

onMounted(() => {
  void loadStats()
})
</script>

<template>
  <section class="dashboard-page">
    <header class="dashboard-head">
      <div class="dashboard-head-copy">
        <p class="dashboard-eyebrow">Рабочий стол</p>
        <h1>Рабочий стол начальника отдела соцпедагогов</h1>
      </div>

      <div class="dashboard-head-meta">
        <span class="dashboard-head-chip">Все корпуса</span>
        <span class="dashboard-head-chip dashboard-head-chip--status">
          <span
            :class="[
              'dashboard-head-chip-dot',
              { 'dashboard-head-chip-dot--closed': stats && stats.serving_today === false },
            ]"
            aria-hidden="true"
          />
          <span>{{ serviceStateLabel }}</span>
        </span>
        <span class="dashboard-head-chip">
          <AppIcon name="calendar" />
          <span>{{ periodLabel }}</span>
        </span>
      </div>
    </header>

    <p v-if="stats?.serving_today === false" class="dashboard-banner">
      {{ stats.serving_block_reason || 'Сегодня питание не выдается.' }}
    </p>

    <p v-if="errorMessage" class="dashboard-error">{{ errorMessage }}</p>

    <PageLoadingBlock
      v-if="loading && !initialized"
      title="Загрузка рабочего стола"
      description="Получаем сводные показатели по талонам и выдаче питания."
    />

    <template v-else>
      <section class="dashboard-stat-grid" aria-label="Сводные показатели">
        <article v-for="card in statCards" :key="card.key" class="dashboard-stat-card">
          <span :class="['dashboard-stat-icon', `dashboard-stat-icon--${card.key}`]" aria-hidden="true">
            <AppIcon :name="card.icon" />
          </span>
          <div class="dashboard-stat-copy">
            <span>{{ card.label }}</span>
            <strong>{{ card.value }}</strong>
            <p>{{ card.note }}</p>
          </div>
        </article>
      </section>

      <div class="dashboard-grid">
        <section class="dashboard-panel">
          <div class="dashboard-panel-head">
            <span>Разделы</span>
          </div>

          <div class="dashboard-section-list">
            <RouterLink v-for="item in sectionItems" :key="item.key" :to="item.to" class="dashboard-section-card">
              <span :class="['dashboard-section-icon', `dashboard-section-icon--${item.key}`]" aria-hidden="true">
                <AppIcon :name="item.icon" />
              </span>
              <div class="dashboard-section-copy">
                <strong>{{ item.label }}</strong>
                <p>{{ item.description }}</p>
              </div>
              <span class="dashboard-section-arrow" aria-hidden="true">
                <AppIcon name="chevronRight" />
              </span>
            </RouterLink>
          </div>
        </section>

        <section class="dashboard-panel">
          <div class="dashboard-panel-head dashboard-panel-head--split">
            <span>Выдача по категориям</span>
            <strong>{{ periodLabel }}</strong>
          </div>

          <div class="dashboard-category-table-wrap">
            <table class="dashboard-category-table">
              <thead>
                <tr>
                  <th>Категория</th>
                  <th>Выдано</th>
                  <th>Сумма</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!categoryRows.length">
                  <td colspan="3" class="dashboard-category-empty">Нет данных за день.</td>
                </tr>
                <tr v-for="row in categoryRows" :key="row.category">
                  <td>{{ row.category }}</td>
                  <td>{{ formatInteger(row.count) }}</td>
                  <td>{{ formatCurrency(row.amount) }}</td>
                </tr>
                <tr v-if="categoryRows.length" class="dashboard-category-total">
                  <td>Итого</td>
                  <td>{{ formatInteger(totalCount) }}</td>
                  <td>{{ formatCurrency(totalAmount) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.dashboard-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.dashboard-head-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dashboard-eyebrow {
  margin: 0;
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 16px;
  text-transform: uppercase;
}

.dashboard-head h1 {
  margin: 0;
  color: #0f172a;
  font-size: 36px;
  line-height: 44px;
}

.dashboard-head-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
}

.dashboard-head-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid #dbe5f0;
  border-radius: 12px;
  background: #fff;
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.dashboard-head-chip--status {
  gap: 10px;
}

.dashboard-head-chip-dot {
  width: 9px;
  height: 9px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: #22c55e;
}

.dashboard-head-chip-dot--closed {
  background: #ef4444;
}

.dashboard-banner,
.dashboard-error {
  margin: 0;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid transparent;
  font-size: 14px;
  line-height: 20px;
}

.dashboard-banner {
  border-color: #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

.dashboard-error {
  border-color: #fecaca;
  background: #fff7f7;
  color: #b91c1c;
}

.dashboard-stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.dashboard-stat-card,
.dashboard-panel {
  border: 1px solid #dbe5f0;
  border-radius: 20px;
  background: #fff;
}

.dashboard-stat-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 16px;
  align-items: center;
  min-height: 120px;
  padding: 18px 20px;
}

.dashboard-stat-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
}

.dashboard-stat-icon--students {
  background: #eff6ff;
  color: #2563eb;
}

.dashboard-stat-icon--tickets {
  background: #effcf3;
  color: #16a34a;
}

.dashboard-stat-icon--issued {
  background: #f5f3ff;
  color: #7c3aed;
}

.dashboard-stat-icon--amount {
  background: #fff7ed;
  color: #ea580c;
}

.dashboard-stat-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.dashboard-stat-copy span,
.dashboard-panel-head span {
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 16px;
  text-transform: uppercase;
}

.dashboard-stat-copy strong {
  color: #0f172a;
  font-size: 22px;
  line-height: 28px;
}

.dashboard-stat-copy p {
  margin: 0;
  color: #475569;
  font-size: 14px;
  line-height: 20px;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(460px, 0.98fr);
  gap: 18px;
  align-items: start;
}

.dashboard-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
}

.dashboard-panel-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dashboard-panel-head--split {
  justify-content: space-between;
}

.dashboard-panel-head strong {
  color: #334155;
  font-size: 14px;
  line-height: 20px;
}

.dashboard-section-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dashboard-section-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 12px 14px;
  border: 1px solid #e5edf6;
  border-radius: 16px;
  background: #fff;
  color: inherit;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    box-shadow 0.18s ease;
}

.dashboard-section-card:hover {
  border-color: #c7d8ee;
  background: #fbfdff;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
}

.dashboard-section-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
}

.dashboard-section-icon--students {
  background: #eff6ff;
  color: #2563eb;
}

.dashboard-section-icon--issuance {
  background: #effcf3;
  color: #16a34a;
}

.dashboard-section-icon--categories {
  background: #f5f3ff;
  color: #7c3aed;
}

.dashboard-section-icon--holidays {
  background: #fff7ed;
  color: #ea580c;
}

.dashboard-section-icon--reports {
  background: #eff6ff;
  color: #2563eb;
}

.dashboard-section-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.dashboard-section-copy strong {
  color: #0f172a;
  font-size: 15px;
  line-height: 22px;
}

.dashboard-section-copy p {
  margin: 0;
  color: #475569;
  font-size: 14px;
  line-height: 20px;
}

.dashboard-section-arrow {
  display: inline-flex;
  color: #334155;
}

.dashboard-category-table-wrap {
  overflow-x: auto;
}

.dashboard-category-table {
  width: 100%;
  border-collapse: collapse;
}

.dashboard-category-table th,
.dashboard-category-table td {
  padding: 12px 10px;
  border-top: 1px solid #edf2f7;
  text-align: left;
  vertical-align: middle;
}

.dashboard-category-table thead th {
  border-top: 0;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
}

.dashboard-category-table tbody td {
  color: #334155;
  font-size: 14px;
  line-height: 20px;
}

.dashboard-category-table th:nth-child(2),
.dashboard-category-table th:nth-child(3),
.dashboard-category-table td:nth-child(2),
.dashboard-category-table td:nth-child(3) {
  text-align: right;
}

.dashboard-category-empty {
  text-align: center !important;
  color: #64748b;
}

.dashboard-category-total td {
  color: #2563eb;
  font-weight: 700;
}

@media (max-width: 1200px) {
  .dashboard-stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .dashboard-head {
    flex-direction: column;
    align-items: stretch;
  }

  .dashboard-head-meta {
    justify-content: flex-start;
  }
}

@media (max-width: 720px) {
  .dashboard-head h1 {
    font-size: 28px;
    line-height: 36px;
  }

  .dashboard-stat-grid {
    grid-template-columns: 1fr;
  }

  .dashboard-stat-card,
  .dashboard-section-card {
    grid-template-columns: 1fr;
  }

  .dashboard-section-arrow {
    display: none;
  }
}
</style>
