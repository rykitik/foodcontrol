import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { roleHome } from '@/config/navigation'
import { listAuditLogs, type AuditLogFilter } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import type { AuditLogEntry } from '@/types'
import { formatAuditActionLabel, formatAuditEntityLabel, isAuditAttentionAction, toMoscowDateKey } from '@/utils/adminPresentation'

const auditLimitOptions = [100, 200, 300, 500, 1000]

function buildActorSearchText(entry: AuditLogEntry): string {
  return [
    entry.user_name,
    String(entry.details?.username ?? ''),
    String(entry.details?.full_name ?? ''),
  ]
    .join(' ')
    .toLowerCase()
}

export function useAuditWorkspace() {
  const auth = useAuthStore()
  const router = useRouter()

  const logs = ref<AuditLogEntry[]>([])
  const loading = ref(false)
  const error = ref('')
  const filters = reactive({
    action: 'all',
    entityType: 'all',
    actor: '',
    ipAddress: '',
    dateFrom: '',
    dateTo: '',
    limit: 300,
  })

  const homePath = computed(() => roleHome[auth.userRole ?? 'admin'])
  const backLabel = computed(() => (homePath.value === '/admin' ? 'К админке' : 'К дашборду'))
  const actionOptions = computed(() => [
    { label: 'Все действия', value: 'all' },
    ...Array.from(new Set(logs.value.map((entry) => entry.action))).map((action) => ({
      label: formatAuditActionLabel(action),
      value: action,
    })),
  ])
  const entityOptions = computed(() => [
    { label: 'Все сущности', value: 'all' },
    ...Array.from(new Set(logs.value.map((entry) => entry.entity_type).filter(Boolean))).map((entityType) => ({
      label: formatAuditEntityLabel(entityType as string),
      value: entityType as string,
    })),
  ])

  const filteredLogs = computed(() => {
    const actorQuery = filters.actor.trim().toLowerCase()
    if (!actorQuery) {
      return logs.value
    }

    return logs.value.filter((entry) => buildActorSearchText(entry).includes(actorQuery))
  })
  const loadedCount = computed(() => logs.value.length)
  const filteredCount = computed(() => filteredLogs.value.length)
  const todayCount = computed(() => {
    const todayKey = toMoscowDateKey(new Date())
    return filteredLogs.value.filter((entry) => {
      return toMoscowDateKey(entry.created_at) === todayKey
    }).length
  })
  const uniqueActorsCount = computed(() => new Set(filteredLogs.value.map((entry) => entry.user_name)).size)
  const attentionCount = computed(() => filteredLogs.value.filter((entry) => isAuditAttentionAction(entry.action)).length)

  function buildServerFilter(): AuditLogFilter {
    return {
      action: filters.action === 'all' ? undefined : filters.action,
      entity_type: filters.entityType === 'all' ? undefined : filters.entityType,
      ip_address: filters.ipAddress.trim() || undefined,
      date_from: filters.dateFrom || undefined,
      date_to: filters.dateTo || undefined,
      limit: filters.limit,
    }
  }

  async function refresh() {
    loading.value = true
    error.value = ''
    try {
      logs.value = await listAuditLogs(auth.token, buildServerFilter())
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Не удалось загрузить аудит'
    } finally {
      loading.value = false
    }
  }

  async function applyFilters() {
    await refresh()
  }

  async function resetFilters() {
    filters.action = 'all'
    filters.entityType = 'all'
    filters.actor = ''
    filters.ipAddress = ''
    filters.dateFrom = ''
    filters.dateTo = ''
    filters.limit = 300
    await refresh()
  }

  function goBack() {
    void router.push(homePath.value)
  }

  onMounted(() => {
    void refresh()
  })

  return {
    actionOptions,
    attentionCount,
    backLabel,
    error,
    filteredCount,
    filteredLogs,
    filters,
    goBack,
    homePath,
    loadedCount,
    loading,
    logs,
    refresh,
    resetFilters,
    applyFilters,
    todayCount,
    uniqueActorsCount,
    entityOptions,
    limitOptions: auditLimitOptions,
  }
}
