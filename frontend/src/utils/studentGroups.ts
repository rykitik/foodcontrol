const DEFAULT_GROUP_SUGGESTION_LIMIT = 20

function normalizeGroupName(value: string): string {
  return value.trim()
}

function normalizeLookup(value: string): string {
  return normalizeGroupName(value).toLocaleLowerCase('ru-RU')
}

export function sortStudentGroupNames(groupNames: string[]): string[] {
  return [...groupNames].sort((left, right) => left.localeCompare(right, 'ru'))
}

export function mergeStudentGroupName(groupNames: string[], nextGroupName: string): string[] {
  const normalizedName = normalizeGroupName(nextGroupName)
  if (!normalizedName) {
    return groupNames
  }

  const seen = new Set(groupNames.map(normalizeLookup))
  if (seen.has(normalizeLookup(normalizedName))) {
    return groupNames
  }

  return sortStudentGroupNames([...groupNames, normalizedName])
}

export function filterStudentGroupSuggestions(
  groupNames: string[],
  query: string,
  limit = DEFAULT_GROUP_SUGGESTION_LIMIT,
): string[] {
  const normalizedQuery = normalizeLookup(query)
  const normalizedLimit = Math.max(1, limit)
  const sortedGroups = sortStudentGroupNames(groupNames)

  if (!normalizedQuery) {
    return sortedGroups.slice(0, normalizedLimit)
  }

  return sortedGroups.filter((groupName) => normalizeLookup(groupName).includes(normalizedQuery)).slice(0, normalizedLimit)
}
