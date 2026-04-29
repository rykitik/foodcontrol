import type { UserRole } from '@/types'

export const roleLabels: Record<UserRole, string> = {
  social: 'Социальный педагог',
  head_social: 'Начальник отдела соцпедагогов',
  cashier: 'Кассир',
  accountant: 'Бухгалтер',
  admin: 'Администратор',
}

export const roleHome: Record<UserRole, string> = {
  social: '/social',
  head_social: '/dashboard',
  cashier: '/cashier',
  accountant: '/accountant',
  admin: '/admin',
}

export const roleRoutes: Record<UserRole, string[]> = {
  social: ['/social', '/social/issuance', '/categories-settings', '/holidays', '/students'],
  head_social: ['/dashboard', '/social', '/social/issuance', '/cashier/summary', '/reports', '/holidays', '/categories-settings', '/students'],
  cashier: ['/cashier', '/students'],
  accountant: ['/accountant', '/students'],
  admin: ['/admin', '/audit'],
}

export function resolveRoleHome(role?: UserRole | null): string {
  return roleHome[role ?? 'social']
}

export function resolveRoleLanding(role?: UserRole | null): string {
  return resolveRoleHome(role)
}

export function resolveRoleRedirect(role: UserRole, path: string): string | null {
  if (role === 'head_social' && path === '/accountant') {
    return '/reports'
  }

  if (role === 'head_social') {
    if (
      path === '/cashier' ||
      path === '/cashier/terminal' ||
      path.startsWith('/cashier/terminal/') ||
      path === '/cashier/journal' ||
      path.startsWith('/cashier/journal/')
    ) {
      return '/cashier/summary'
    }
  }

  return null
}

export function isRolePathAllowed(role: UserRole, path: string): boolean {
  const allowed = roleRoutes[role]
  return allowed.some((allowedPath) => path === allowedPath || path.startsWith(`${allowedPath}/`))
}
