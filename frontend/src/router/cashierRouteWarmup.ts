const loadCashierViewModule = () => import('@/views/CashierView.vue')
const loadCashierTerminalViewModule = () => import('@/views/CashierTerminalView.vue')
const loadCashierSummaryViewModule = () => import('@/views/CashierSummaryView.vue')
const loadCashierJournalViewModule = () => import('@/views/CashierJournalView.vue')

const CASHIER_CRITICAL_ROUTE_WARMUP_ENTRY_PATHS = new Set([
  '/',
  '/cashier',
  '/cashier/terminal',
  '/cashier/journal',
])

const CASHIER_CRITICAL_ROUTE_LOADERS = [
  loadCashierViewModule,
  loadCashierTerminalViewModule,
  loadCashierJournalViewModule,
] as const

let cashierCriticalWarmupPromise: Promise<void> | null = null

export const loadCashierView = () => loadCashierViewModule()

export const loadCashierTerminalView = () => loadCashierTerminalViewModule()

export const loadCashierSummaryView = () => loadCashierSummaryViewModule()

export const loadCashierJournalView = () => loadCashierJournalViewModule()

export function shouldWarmCashierCriticalRoutes(path: string): boolean {
  return CASHIER_CRITICAL_ROUTE_WARMUP_ENTRY_PATHS.has(path)
}

export function warmCashierCriticalRouteChunks(): Promise<void> {
  if (!cashierCriticalWarmupPromise) {
    cashierCriticalWarmupPromise = Promise.all(CASHIER_CRITICAL_ROUTE_LOADERS.map((loadRoute) => loadRoute()))
      .then(() => undefined)
      .catch((error) => {
        cashierCriticalWarmupPromise = null
        throw error
      })
  }

  return cashierCriticalWarmupPromise
}
