import { ref } from 'vue'
import { describe, expect, test, vi } from 'vitest'

import type { CashierOfflineSnapshotResponse } from '@/types'
import type { CashierStoragePartition } from '@/types/cashierOfflineStorage'

const partition: CashierStoragePartition = {
  terminal_id: 'terminal-1',
  user_id: 'cashier-1',
  role: 'cashier',
}

function createOfflineSnapshot(): CashierOfflineSnapshotResponse {
  return {
    generated_at: '2026-04-16T09:00:00.000Z',
    snapshot_version: 'snapshot-v1',
    service_date: '2026-04-16',
    building_id: 1,
    datasets: {
      students: [
        {
          id: 'student-1',
          full_name: 'Test Student',
          student_card: '100001',
          group_name: 'A-01',
          building_id: 1,
          meal_building_id: 1,
          allow_all_meal_buildings: false,
          effective_meal_building_id: 1,
          category_id: 1,
          is_active: true,
        },
      ],
      tickets: [
        {
          id: 'ticket-1',
          student_id: 'student-1',
          category_id: 1,
          status: 'active',
          qr_code: 'QR-001',
          start_date: '2026-04-01',
          end_date: '2026-04-30',
          created_at: '2026-04-01T00:00:00.000Z',
          today_statuses: [
            {
              meal_type: 'breakfast',
              issued: true,
              price: 120,
              issue_time: '08:15:00',
            },
            {
              meal_type: 'lunch',
              issued: false,
              price: 165,
              issue_time: null,
            },
          ],
          issued_today_amount: 120,
        },
      ],
      categories: [
        {
          id: 1,
          name: 'Default',
          code: 'DEFAULT',
          breakfast: true,
          lunch: true,
          meal_types: ['breakfast', 'lunch'],
          meal_prices: {
            breakfast: 120,
            lunch: 165,
          },
        },
      ],
      holidays: [],
      configured_holidays: [],
      lookup_restrictions: [],
    },
    rules: {
      supported_meal_types: ['breakfast', 'lunch'],
      serving_today: true,
      serving_block_reason: null,
    },
  }
}

function installOfflineSnapshotMocks(params?: {
  serviceDate?: string
  issuedLedger?: Array<'breakfast' | 'lunch'>
  queue?: Array<{
    request_id: string
    code: string
    selected_meals: Array<'breakfast' | 'lunch'>
    issue_date: string
    created_at: string
    student_name: string
    group_name: string
    student_id?: string
    ticket_id?: string
  }>
  lookupRestrictions?: CashierOfflineSnapshotResponse['datasets']['lookup_restrictions']
}) {
  const snapshot = createOfflineSnapshot()
  snapshot.datasets.lookup_restrictions = params?.lookupRestrictions ?? snapshot.datasets.lookup_restrictions
  const serviceDate = params?.serviceDate ?? snapshot.service_date
  const issuedLedger = params?.issuedLedger ?? []
  const queue = params?.queue ?? []
  const partitionKey = `${partition.terminal_id}:${partition.user_id}`

  vi.doMock('@/services/cashierOfflineDb', () => ({
    CASHIER_OFFLINE_STORES: {
      snapshot_students: 'snapshot_students',
      snapshot_tickets: 'snapshot_tickets',
      snapshot_categories: 'snapshot_categories',
      snapshot_holidays: 'snapshot_holidays',
      snapshot_lookup_restrictions: 'snapshot_lookup_restrictions',
    },
    idbDeleteMany: vi.fn(),
    idbPutMany: vi.fn(),
    idbGetAllByIndex: vi.fn(async (storeName: string, indexName: string, query: string) => {
      if (indexName !== 'partition_key' || query !== partitionKey) {
        return []
      }

      switch (storeName) {
        case 'snapshot_students':
          return snapshot.datasets.students.map((student) => ({
            snapshot_student_id: `${partitionKey}:${student.id}`,
            partition_key: partitionKey,
            terminal_id: partition.terminal_id,
            user_id: partition.user_id,
            role: 'cashier',
            student_id: student.id,
            full_name: student.full_name,
            full_name_lower: student.full_name.toLowerCase(),
            student_card: student.student_card,
            student_card_lower: student.student_card.toLowerCase(),
            group_name: student.group_name,
            building_id: student.building_id,
            meal_building_id: student.meal_building_id,
            allow_all_meal_buildings: student.allow_all_meal_buildings,
            effective_meal_building_id: student.effective_meal_building_id,
            category_id: student.category_id,
            is_active: student.is_active,
            updated_at: snapshot.generated_at,
          }))
        case 'snapshot_tickets':
          return snapshot.datasets.tickets.map((ticket) => ({
            snapshot_ticket_id: `${partitionKey}:${ticket.id}`,
            partition_key: partitionKey,
            terminal_id: partition.terminal_id,
            user_id: partition.user_id,
            role: 'cashier',
            ticket_id: ticket.id,
            ticket_id_lower: ticket.id.toLowerCase(),
            student_id: ticket.student_id,
            category_id: ticket.category_id,
            status: ticket.status,
            qr_code: ticket.qr_code,
            qr_code_lower: ticket.qr_code.toLowerCase(),
            start_date: ticket.start_date,
            end_date: ticket.end_date,
            created_at: ticket.created_at,
            today_statuses: ticket.today_statuses,
            issued_today_amount: ticket.issued_today_amount,
            updated_at: snapshot.generated_at,
          }))
        case 'snapshot_categories':
          return snapshot.datasets.categories.map((category) => ({
            snapshot_category_id: `${partitionKey}:${category.id}`,
            partition_key: partitionKey,
            terminal_id: partition.terminal_id,
            user_id: partition.user_id,
            role: 'cashier',
            category_id: category.id,
            value: category,
            updated_at: snapshot.generated_at,
          }))
        case 'snapshot_holidays':
          return []
        case 'snapshot_lookup_restrictions':
          return (snapshot.datasets.lookup_restrictions ?? []).map((restriction) => ({
            snapshot_lookup_restriction_id: `${partitionKey}:${restriction.lookup_kind}:${restriction.lookup_key.toLowerCase()}`,
            partition_key: partitionKey,
            terminal_id: partition.terminal_id,
            user_id: partition.user_id,
            role: 'cashier',
            lookup_key: restriction.lookup_key,
            lookup_key_lower: restriction.lookup_key.toLowerCase(),
            lookup_kind: restriction.lookup_kind,
            reason: restriction.reason,
            effective_meal_building_id: restriction.effective_meal_building_id ?? null,
            effective_meal_building_name: restriction.effective_meal_building_name ?? null,
            updated_at: snapshot.generated_at,
          }))
        default:
          return []
      }
    }),
    isCashierOfflineDbAvailable: vi.fn(() => true),
  }))

  vi.doMock('@/services/cashierOfflineStorage', () => ({
    getActiveCashierStoragePartition: vi.fn(() => partition),
    loadOfflineQueueForActivePartitionSync: vi.fn(() => queue),
    readSnapshotMeta: vi.fn(async () => ({
      partition_key: partitionKey,
      terminal_id: partition.terminal_id,
      user_id: partition.user_id,
      role: 'cashier',
      snapshot_version: snapshot.snapshot_version,
      generated_at: snapshot.generated_at,
      freshness_ts: snapshot.generated_at,
      service_date: serviceDate,
      updated_at: snapshot.generated_at,
    })),
    upsertSnapshotMeta: vi.fn(),
  }))
  vi.doMock('@/services/cashierOfflineIssuedLedger', () => ({
    resolveCashierIssuedMealSetForActivePartition: vi.fn(() => new Set(issuedLedger)),
  }))
}

describe('Cashier offline terminal', () => {
  test('offline lookup merges snapshot-issued meals with the local offline queue', async () => {
    vi.resetModules()
    installOfflineSnapshotMocks({
      queue: [
        {
          request_id: 'request-1',
          code: 'QR-001',
          selected_meals: ['lunch'],
          issue_date: '2026-04-16',
          created_at: '2026-04-16T10:05:00.000Z',
          student_name: 'Test Student',
          group_name: 'A-01',
          student_id: 'student-1',
          ticket_id: 'ticket-1',
        },
      ],
    })

    const { resolveCashierLookupOffline } = await import('@/services/cashierOfflineSnapshot')

    const result = await resolveCashierLookupOffline('QR-001', { issueDate: '2026-04-16' })

    expect(result?.remaining_meals).toEqual([])
    expect(result?.issued_today_amount).toBe(285)
    expect(result?.today_statuses).toEqual([
      {
        meal_type: 'breakfast',
        issued: true,
        price: 120,
        issue_time: '08:15:00',
      },
      {
        meal_type: 'lunch',
        issued: true,
        price: 165,
        issue_time: null,
      },
    ])
  })

  test('offline lookup is unavailable when the snapshot is not for the current service day', async () => {
    vi.resetModules()
    installOfflineSnapshotMocks({ serviceDate: '2026-04-16' })

    const { resolveCashierLookupOffline } = await import('@/services/cashierOfflineSnapshot')

    const result = await resolveCashierLookupOffline('QR-001', { issueDate: '2026-04-17' })

    expect(result).toBeNull()
  })

  test('offline lookup also respects locally confirmed online issues from this terminal', async () => {
    vi.resetModules()
    installOfflineSnapshotMocks({ issuedLedger: ['breakfast'] })

    const { resolveCashierLookupOffline } = await import('@/services/cashierOfflineSnapshot')

    const result = await resolveCashierLookupOffline('QR-001', { issueDate: '2026-04-16' })

    expect(result?.remaining_meals).toEqual(['lunch'])
    expect(result?.issued_today_amount).toBe(120)
    expect(result?.today_statuses).toEqual([
      {
        meal_type: 'breakfast',
        issued: true,
        price: 120,
        issue_time: '08:15:00',
      },
      {
        meal_type: 'lunch',
        issued: false,
        price: 165,
        issue_time: null,
      },
    ])
  })

  test('offline lookup reports another meal building when the scanned code belongs to a remote feeding building', async () => {
    vi.resetModules()
    installOfflineSnapshotMocks({
      lookupRestrictions: [
        {
          lookup_key: 'REMOTE-QR-001',
          lookup_kind: 'qr_code',
          reason: 'cross_building',
          effective_meal_building_id: 2,
          effective_meal_building_name: 'Корпус 2, Яковлева, д.17',
        },
      ],
    })

    const { resolveCashierLookupOffline } = await import('@/services/cashierOfflineSnapshot')

    await expect(resolveCashierLookupOffline('REMOTE-QR-001', { issueDate: '2026-04-16' })).rejects.toThrow(
      'Студент питается в другом корпусе. Питание назначено в: Корпус 2, Яковлева, д.17.',
    )
  })

  test('queued offline confirmation explicitly tells the cashier to issue food', async () => {
    vi.resetModules()

    const { createCashierTerminalStatusController } = await import('@/composables/cashierTerminal/status')
    const status = ref({ kind: 'ready', title: '', text: '' })
    const controller = createCashierTerminalStatusController({
      status,
      pushEvent: vi.fn(),
      scheduleAutoReset: vi.fn(),
    })

    controller.handleQueueEnqueued({
      request_id: 'request-1',
      code: 'QR-001',
      selected_meals: ['lunch'],
      issue_date: '2026-04-16',
      created_at: '2026-04-16T10:05:00.000Z',
      student_name: 'Test Student',
      group_name: 'A-01',
    })

    expect(status.value.kind).toBe('queued')
    expect(status.value.title).toBe('Выдайте питание')
    expect(status.value.text).toContain('Обед')
    expect(status.value.text).toContain('офлайн-очереди')
  })

  test('duplicate offline queue entries tell the cashier not to issue again', async () => {
    vi.resetModules()

    const { createCashierTerminalStatusController } = await import('@/composables/cashierTerminal/status')
    const status = ref({ kind: 'ready', title: '', text: '' })
    const controller = createCashierTerminalStatusController({
      status,
      pushEvent: vi.fn(),
      scheduleAutoReset: vi.fn(),
    })

    controller.handleQueueDuplicate({
      request_id: 'request-1',
      code: 'QR-001',
      selected_meals: ['breakfast'],
      issue_date: '2026-04-16',
      created_at: '2026-04-16T10:05:00.000Z',
      student_name: 'Test Student',
      group_name: 'A-01',
    })

    expect(status.value.kind).toBe('already_used')
    expect(status.value.title).toBe('Уже сохранено без интернета')
    expect(status.value.text).toContain('Повторно не выдавать')
  })
})
