export const PWA_SHORTCUT_ICON = {
  src: 'pwa-192.png',
  sizes: '192x192',
  type: 'image/png',
} as const

export const PWA_ICONS = [
  PWA_SHORTCUT_ICON,
  {
    src: 'pwa-512.png',
    sizes: '512x512',
    type: 'image/png',
  },
  {
    src: 'pwa-maskable-512.png',
    sizes: '512x512',
    type: 'image/png',
    purpose: 'maskable',
  },
] as const

export const PWA_CASHIER_SHORTCUTS = [
  {
    name: 'Касса',
    short_name: 'Касса',
    description: 'Открыть рабочее место кассира',
    url: '/cashier',
  },
  {
    name: 'Терминал кассы',
    short_name: 'Терминал',
    description: 'Открыть терминал выдачи питания',
    url: '/cashier/terminal',
  },
  {
    name: 'Журнал кассы',
    short_name: 'Журнал',
    description: 'Открыть журнал выдач и оффлайн-проверки',
    url: '/cashier/journal',
  },
].map((shortcut) => ({
  ...shortcut,
  icons: [PWA_SHORTCUT_ICON],
}))

export const PWA_APP_NAVIGATION_ALLOWLIST = [/^\/(?!api(?:\/|$)).*/]

export const PWA_WORKBOX_OPTIONS = {
  globPatterns: ['**/*.{js,css,html,svg,png,woff2,woff,ttf}'],
  navigateFallback: 'index.html',
  navigateFallbackDenylist: [/^\/api(?:\/|$)/],
} as const

export const PWA_DEV_OPTIONS = {
  enabled: true,
  type: 'module' as const,
  navigateFallbackAllowlist: PWA_APP_NAVIGATION_ALLOWLIST,
} as const
