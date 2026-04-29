import { webcrypto } from 'node:crypto'

import { afterEach, beforeEach, vi } from 'vitest'

const originalFetch = globalThis.fetch

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  })
}

if (!globalThis.ResizeObserver) {
  class ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  Object.defineProperty(globalThis, 'ResizeObserver', {
    value: ResizeObserver,
    configurable: true,
  })
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

Object.defineProperty(window, 'scrollTo', {
  writable: true,
  configurable: true,
  value: vi.fn(),
})

beforeEach(() => {
  vi.resetModules()
  vi.unmock('@/services/api')
  vi.unmock('@/services/cashierOfflineDb')
  vi.unmock('@/services/cashierOfflineGrant')
  vi.unmock('@/services/cashierOfflineSnapshot')
  vi.unmock('@/services/cashierOfflineStorage')
  vi.unmock('@/services/cashierStartupOrchestrator')

  localStorage.clear()
  sessionStorage.clear()
  document.body.innerHTML = '<div id="app"></div>'
  window.history.replaceState({}, '', '/')

  if (originalFetch) {
    globalThis.fetch = originalFetch
  }
})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  document.body.innerHTML = ''
  window.history.replaceState({}, '', '/')

  if (originalFetch) {
    globalThis.fetch = originalFetch
  }

  vi.restoreAllMocks()
  vi.useRealTimers()
})
