import { clearCashierOfflineAuthLocalState } from '@/services/cashierOfflineGrant'
import { clearCashierOfflineIssuedLedger } from '@/services/cashierOfflineIssuedLedger'
import { clearCashierOfflineSnapshotCache } from '@/services/cashierOfflineSnapshot'
import { clearCashierStartupAssessmentCache } from '@/services/cashierStartupOrchestrator'
import { clearCashierEventLogStorage } from '@/utils/cashierSession'

export function resetCashierOfflineClientState(): void {
  clearCashierOfflineAuthLocalState()
  clearCashierOfflineIssuedLedger()
  clearCashierOfflineSnapshotCache()
  clearCashierStartupAssessmentCache()
  clearCashierEventLogStorage()
}
