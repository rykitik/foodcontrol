<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { getTodayStats } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import type { DashboardStats, UserRole } from '@/types'

const auth = useAuthStore()
const activeRole = computed(() => auth.effectiveRole ?? auth.userRole ?? 'social')

const stats = ref<DashboardStats | null>(null)
const dashboardBuildingId = computed(() =>
  activeRole.value === 'cashier' || activeRole.value === 'social' ? auth.userBuilding ?? undefined : undefined,
)

const roleTitles: Record<UserRole, string> = {
  social: 'Рабочее место соцпедагога',
  head_social: 'Рабочий стол начальника соцпедагогов',
  cashier: 'Кассовый режим',
  accountant: 'Документы и ведомости',
  admin: 'Управление системой',
}

const statCards = computed(() => [
  { label: 'Студентов', value: stats.value?.studentsTotal ?? 0 },
  { label: 'Активных талонов', value: stats.value?.ticketsActive ?? 0 },
  { label: 'Выдано сегодня', value: stats.value?.mealsToday ?? 0 },
  { label: 'Сумма за день', value: `${(stats.value?.costToday ?? 0).toFixed(2)} ₽` },
])

const roleActions = computed(() => {
  const role = activeRole.value

  if (role === 'cashier') {
    return [
      { title: 'Меню кассы', to: '/cashier', text: 'Терминал выдачи, сводка смены и журнал операций.' },
      { title: 'Сводка смены', to: '/cashier/summary', text: 'Итоги дня, локальная очередь и последние операции.' },
    ]
  }

  if (role === 'accountant') {
    return [
      { title: 'Отчеты', to: '/accountant', text: 'Печатные формы, ведомости стоимости и итоговые таблицы.' },
    ]
  }

  if (role === 'admin') {
    return [
      { title: 'Админ-раздел', to: '/admin', text: 'Пользователи, студенты и импорт данных.' },
      { title: 'Журнал аудита', to: '/audit', text: 'Системные события, логи действий и проверка изменений.' },
    ]
  }

  return [
    { title: 'Студенты', to: '/social', text: 'Список студентов корпуса, корпус питания и действия по талонам.' },
    { title: 'Выпуск и печать', to: '/social/issuance', text: 'Месячный выпуск, A4-листы талонов и ведомости получения.' },
  ]
})

const servingStateLabel = computed(() => {
  if (!stats.value) {
    return 'Загрузка...'
  }
  return stats.value.serving_today ? 'Питание открыто' : 'Питание закрыто'
})

const buildingLabel = computed(() => auth.user?.building_name || 'Все корпуса')
const byCategory = computed(() => stats.value?.byCategory.slice(0, 5) ?? [])
const workspaceContext = computed(() => {
  const rows = [
    { label: 'Период', value: stats.value?.period || 'Сегодня' },
    { label: 'Корпус', value: buildingLabel.value },
    { label: 'Питание', value: servingStateLabel.value },
  ]

  if (auth.isRolePreviewActive) {
    rows.push({ label: 'Режим', value: 'Просмотр от другой роли' })
  }

  return rows
})

onMounted(async () => {
  stats.value = await getTodayStats(dashboardBuildingId.value)
})
</script>

<template>
  <section class="dashboard-role-page">
    <div class="dashboard-hero">
      <div class="dashboard-hero-copy">
        <p class="eyebrow">Рабочий стол</p>
        <h1>{{ roleTitles[activeRole] }}</h1>
      </div>

      <div class="dashboard-hero-meta">
        <div class="dashboard-chip">{{ buildingLabel }}</div>
        <div class="dashboard-chip">{{ servingStateLabel }}</div>
        <div class="dashboard-chip">{{ stats?.period || 'Сегодня' }}</div>
      </div>
    </div>

    <div v-if="stats?.serving_today === false" class="dashboard-banner">
      {{ stats.serving_block_reason || 'Сегодня питание не выдается.' }}
    </div>

    <div class="dashboard-stat-grid">
      <article v-for="card in statCards" :key="card.label" class="dashboard-stat-card">
        <span>{{ card.label }}</span>
        <strong>{{ card.value }}</strong>
      </article>
    </div>

    <div class="dashboard-grid">
      <section class="dashboard-card">
        <div class="dashboard-card-head">
          <span>Разделы</span>
          <strong>{{ auth.displayName }}</strong>
        </div>

        <div class="dashboard-action-list">
          <RouterLink v-for="item in roleActions" :key="item.to" :to="item.to" class="dashboard-action-card">
            <strong>{{ item.title }}</strong>
            <p>{{ item.text }}</p>
          </RouterLink>
        </div>
      </section>

      <section class="dashboard-card">
        <div class="dashboard-card-head">
          <span>Выдача по категориям</span>
          <strong>{{ stats?.period || 'Сегодня' }}</strong>
        </div>

        <div v-if="byCategory.length" class="dashboard-list">
          <div v-for="row in byCategory" :key="row.category" class="dashboard-list-row">
            <div>
              <strong>{{ row.category }}</strong>
              <p>{{ row.count }} выдач</p>
            </div>
            <span>{{ row.amount.toFixed(2) }} ₽</span>
          </div>
        </div>
        <div v-else class="dashboard-empty">Нет данных за день.</div>
      </section>

      <section class="dashboard-card dashboard-card-wide">
        <div class="dashboard-card-head">
          <span>Рабочий контекст</span>
          <strong>{{ auth.displayName }}</strong>
        </div>

        <div class="dashboard-list">
          <div v-for="row in workspaceContext" :key="row.label" class="dashboard-list-row dashboard-context-row">
            <strong>{{ row.label }}</strong>
            <span>{{ row.value }}</span>
          </div>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.dashboard-role-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.dashboard-hero,
.dashboard-card,
.dashboard-stat-card {
  border-radius: var(--radius-xl);
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: var(--shadow);
}

.dashboard-hero {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
  padding: 24px;
  background:
    radial-gradient(circle at top left, rgba(29, 78, 216, 0.12), transparent 36%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.84));
}

.dashboard-hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.dashboard-chip {
  display: inline-flex;
  align-items: center;
  min-height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.92);
  color: white;
  font-size: 0.92rem;
  font-weight: 700;
}

.dashboard-banner {
  margin: 0;
  padding: 12px 16px;
  border-radius: 16px;
  background: rgba(220, 38, 38, 0.12);
  color: #991b1b;
  font-weight: 700;
}

.dashboard-stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.dashboard-stat-card {
  display: grid;
  gap: 8px;
  padding: 16px 18px;
}

.dashboard-stat-card span {
  color: var(--muted);
  font-size: 0.84rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.dashboard-stat-card strong {
  color: var(--text);
  font-size: clamp(1.7rem, 2.8vw, 2.6rem);
  line-height: 1;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.18fr) minmax(0, 0.82fr);
  gap: 18px;
}

.dashboard-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
}

.dashboard-card-wide {
  grid-column: 1 / -1;
}

.dashboard-card-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.dashboard-card-head span {
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.dashboard-card-head strong {
  color: var(--text);
  font-size: 1rem;
}

.dashboard-action-list,
.dashboard-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dashboard-action-card,
.dashboard-list-row {
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(255, 255, 255, 0.72);
}

.dashboard-action-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  color: inherit;
  transition: transform 0.18s ease, border-color 0.18s ease;
}

.dashboard-action-card:hover {
  transform: translateY(-1px);
  border-color: rgba(29, 78, 216, 0.34);
}

.dashboard-action-card strong,
.dashboard-list-row strong {
  color: var(--text);
}

.dashboard-action-card p,
.dashboard-list-row p {
  margin: 0;
  color: var(--muted);
}

.dashboard-list-row {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: center;
  padding: 14px 16px;
}

.dashboard-context-row strong {
  font-size: 0.94rem;
  font-weight: 700;
}

.dashboard-list-row span {
  color: var(--text);
  font-weight: 700;
  white-space: nowrap;
}

.dashboard-empty {
  padding: 16px;
  border-radius: 18px;
  border: 1px dashed rgba(148, 163, 184, 0.24);
  background: rgba(255, 255, 255, 0.58);
  color: var(--muted);
}

@media (max-width: 1200px) {
  .dashboard-stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .dashboard-hero,
  .dashboard-hero-meta,
  .dashboard-card-head,
  .dashboard-list-row {
    flex-direction: column;
    align-items: stretch;
  }

  .dashboard-stat-grid {
    grid-template-columns: 1fr;
  }
}
</style>
