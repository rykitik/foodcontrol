<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { roleHome } from '@/config/navigation'
import { listAuditLogs } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import type { AuditLogEntry } from '@/types'

const auth = useAuthStore()
const router = useRouter()
const homePath = computed(() => roleHome[auth.userRole ?? 'admin'])
const backLabel = computed(() => (homePath.value === '/admin' ? 'К админке' : 'К дашборду'))

const logs = ref<AuditLogEntry[]>([])
const loading = ref(false)
const actionFilter = ref('')
const entityFilter = ref('')

const filteredLogs = computed(() =>
  logs.value.filter((entry) => {
    const actionOk = !actionFilter.value || entry.action.includes(actionFilter.value)
    const entityOk = !entityFilter.value || (entry.entity_type ?? '').includes(entityFilter.value)
    return actionOk && entityOk
  }),
)

async function refresh() {
  loading.value = true
  try {
    logs.value = await listAuditLogs(auth.token)
  } finally {
    loading.value = false
  }
}

function formatDetails(details: Record<string, unknown>) {
  const entries = Object.entries(details ?? {})
  if (!entries.length) {
    return 'Без дополнительных данных'
  }

  return entries
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
    .join(' · ')
}

onMounted(refresh)
</script>

<template>
  <section class="page-stack audit-page">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Журнал действий</p>
        <h1>Аудит операций и событий системы</h1>
        <p class="audit-copy">Фильтрация спорных действий, ручных правок и операций по студентам, талонам и отчетам.</p>
      </div>
      <div class="heading-actions">
        <p-button :label="backLabel" severity="secondary" outlined @click="router.push(homePath)" />
      </div>
    </div>

    <p-card class="content-card">
      <template #title>Фильтры</template>
      <template #content>
        <div class="form-grid">
          <label class="field">
            <span>Действие</span>
            <p-input-text v-model="actionFilter" placeholder="login, create_user, record_meal..." />
          </label>
          <label class="field">
            <span>Сущность</span>
            <p-input-text v-model="entityFilter" placeholder="user, student, report..." />
          </label>
        </div>
      </template>
    </p-card>

    <p-card class="content-card">
      <template #title>Последние события</template>
      <template #content>
        <div v-if="loading" class="muted-block">Загружаем журнал...</div>
        <div v-else-if="filteredLogs.length" class="report-list">
          <div v-for="entry in filteredLogs" :key="entry.id" class="report-item">
            <div>
              <strong>{{ entry.action }}</strong>
              <p>{{ entry.user_name }} · {{ entry.entity_type || 'system' }} · {{ entry.created_at }}</p>
              <p>{{ formatDetails(entry.details) }}</p>
            </div>
            <div class="report-amounts">
              <span>{{ entry.ip_address || 'n/a' }}</span>
            </div>
          </div>
        </div>
        <div v-else class="muted-block">По выбранным фильтрам событий нет.</div>
      </template>
    </p-card>
  </section>
</template>

<style scoped>
.audit-page {
  gap: 16px;
}

.audit-copy {
  margin: 8px 0 0;
  max-width: 760px;
  color: var(--muted);
}

.heading-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}
</style>
