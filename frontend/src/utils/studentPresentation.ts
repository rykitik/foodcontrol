export const studentCodeLabel = 'Код студента'
export const studentCodeShortLabel = 'Код'
export const studentCodeHint = 'Присваивается системой автоматически'

export function formatStudentCode(value: string | null | undefined): string {
  const normalized = value?.trim()
  return normalized ? normalized : 'Не присвоен'
}
