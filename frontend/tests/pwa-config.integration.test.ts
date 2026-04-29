import { describe, expect, test } from 'vitest'

import {
  PWA_CASHIER_SHORTCUTS,
  PWA_DEV_OPTIONS,
  PWA_WORKBOX_OPTIONS,
} from '@/config/pwa'

describe('PWA config integration', () => {
  test('enables offline cashier navigation for dev PWA installs', () => {
    expect(PWA_DEV_OPTIONS.enabled).toBe(true)
    expect(PWA_DEV_OPTIONS.type).toBe('module')
    expect(PWA_DEV_OPTIONS.navigateFallbackAllowlist.some((pattern) => pattern.test('/cashier/terminal'))).toBe(true)
    expect(PWA_WORKBOX_OPTIONS.navigateFallback).toBe('index.html')
    expect(PWA_WORKBOX_OPTIONS.navigateFallbackDenylist.some((pattern) => pattern.test('/api/meals/offline-snapshot'))).toBe(true)
    expect(PWA_CASHIER_SHORTCUTS.map((shortcut) => shortcut.url)).toEqual(
      expect.arrayContaining(['/cashier', '/cashier/terminal', '/cashier/journal']),
    )
  })
})
