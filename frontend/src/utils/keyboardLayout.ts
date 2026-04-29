const RU_LAYOUT_LOWER = 'ёйцукенгшщзхъфывапролджэячсмитьбю'
const EN_LAYOUT_LOWER = "`qwertyuiop[]asdfghjkl;'zxcvbnm,."

const RU_LAYOUT_UPPER = 'ЁЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮ'
const EN_LAYOUT_UPPER = '~QWERTYUIOP{}ASDFGHJKL:"ZXCVBNM<>'

const RU_SYMBOL_MAP: Record<string, string> = {
  '№': '#',
}

export function convertRuKeyboardLayoutToLatin(value: string): string {
  if (!value) {
    return value
  }

  let changed = false
  const converted = Array.from(value, (char) => {
    const lowerIndex = RU_LAYOUT_LOWER.indexOf(char)
    if (lowerIndex !== -1) {
      changed = true
      return EN_LAYOUT_LOWER[lowerIndex]
    }

    const upperIndex = RU_LAYOUT_UPPER.indexOf(char)
    if (upperIndex !== -1) {
      changed = true
      return EN_LAYOUT_UPPER[upperIndex]
    }

    const symbol = RU_SYMBOL_MAP[char]
    if (symbol) {
      changed = true
      return symbol
    }

    return char
  }).join('')

  return changed ? converted : value
}

export function normalizeTicketLookupCode(value: string): string {
  return convertRuKeyboardLayoutToLatin(value).trim()
}
