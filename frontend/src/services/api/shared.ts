export function createSearchParams(values: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, rawValue] of Object.entries(values)) {
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      continue
    }

    if (typeof rawValue === 'boolean') {
      if (rawValue) {
        params.set(key, '1')
      }
      continue
    }

    params.set(key, String(rawValue))
  }
  return params
}

export function withQuery(path: string, params: URLSearchParams): string {
  const query = params.toString()
  return query ? `${path}?${query}` : path
}
