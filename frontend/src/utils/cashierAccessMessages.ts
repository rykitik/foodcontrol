const crossBuildingAccessPatterns = [
  /питается в другом корпусе/i,
  /питание назначено в/i,
  /назначенн\w* корпус/i,
]

const assignedMealBuildingPattern = /питание назначено в:\s*(.+)$/i

function normalizeCashierAccessMessage(message: string) {
  return message.trim().replace(/\s+/g, ' ')
}

export function buildCrossBuildingCashierAccessMessage(assignedMealBuildingLabel?: string | null): string {
  if (assignedMealBuildingLabel) {
    return `Студент питается в другом корпусе. Питание назначено в: ${assignedMealBuildingLabel}.`
  }

  return 'Студент питается в другом корпусе. Питание назначено по другому корпусу питания.'
}

export function isCrossBuildingCashierAccessMessage(message: string): boolean {
  const normalized = normalizeCashierAccessMessage(message)
  return crossBuildingAccessPatterns.some((pattern) => pattern.test(normalized))
}

export function extractCrossBuildingMealBuildingLabel(message: string): string | null {
  const normalized = normalizeCashierAccessMessage(message)
  const match = normalized.match(assignedMealBuildingPattern)
  if (!match) {
    return null
  }

  const label = match[1]?.trim().replace(/\.$/, '')
  return label || null
}
