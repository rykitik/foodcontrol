let cashierOfflineContextVersion = 0

export function getCashierOfflineContextVersion(): number {
  return cashierOfflineContextVersion
}

export function resetCashierOfflineContextVersion(): number {
  cashierOfflineContextVersion += 1
  return cashierOfflineContextVersion
}
