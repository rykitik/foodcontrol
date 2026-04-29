import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'

import AppShell from '@/components/AppShell.vue'
import { isRolePathAllowed, resolveRoleHome, resolveRoleLanding, resolveRoleRedirect } from '@/config/navigation'
import {
  loadCashierJournalView,
  loadCashierSummaryView,
  loadCashierTerminalView,
  loadCashierView,
  shouldWarmCashierCriticalRoutes,
  warmCashierCriticalRouteChunks,
} from '@/router/cashierRouteWarmup'
import {
  isCashierStartupRoutePath,
  runCashierStartupOrchestrator,
} from '@/services/cashierStartupOrchestrator'
import { useAuthStore } from '@/stores/auth'
const DashboardView = () => import('@/views/DashboardView.vue')
const SocialPedagogView = () => import('@/views/SocialPedagogView.vue')
const SocialStudentCreateView = () => import('@/views/SocialStudentCreateView.vue')
const SocialIssueCenterView = () => import('@/views/SocialIssueCenterView.vue')
const SocialReportsView = () => import('@/views/SocialReportsView.vue')
const AccountView = () => import('@/views/AccountantView.vue')
const AdminView = () => import('@/views/AdminView.vue')
const AuditView = () => import('@/views/AuditView.vue')
const HolidayCalendarView = () => import('@/views/HolidayCalendarView.vue')
const CategorySettingsView = () => import('@/views/CategorySettingsView.vue')
const StudentDetailView = () => import('@/views/StudentDetailView.vue')
import LoginView from '@/views/LoginView.vue'
import NotFoundView from '@/views/NotFoundView.vue'

function isNotFoundRoute(to: RouteLocationNormalized): boolean {
  return to.name === 'not-found' || to.name === 'app-not-found'
}

function getAuthStore() {
  return useAuthStore()
}

async function redirectForAuth(to: RouteLocationNormalized) {
  const auth = getAuthStore()

  if (!auth.hydrated) {
    await auth.restoreSession()
  }

  if (to.meta.public === true) {
    if (auth.isAuthenticated && !isNotFoundRoute(to)) {
      return resolveRoleLanding(auth.effectiveRole ?? auth.userRole)
    }
    return true
  }

  if (!auth.isAuthenticated) {
    const reason =
      auth.sessionState === 'expired'
        ? 'expired'
        : auth.sessionState === 'network_unreachable'
          ? 'network_unreachable'
          : undefined
    return auth.buildLoginLocation({ redirect: to.fullPath, reason })
  }

  const role = auth.effectiveRole ?? auth.userRole ?? 'social'
  if (role === 'cashier' && shouldWarmCashierCriticalRoutes(to.path)) {
    void warmCashierCriticalRouteChunks().catch(() => undefined)
  }

  const roleRedirect = resolveRoleRedirect(role, to.path)
  if (roleRedirect) {
    return roleRedirect
  }

  if (isNotFoundRoute(to)) {
    return true
  }

  if (to.meta.roles && Array.isArray(to.meta.roles) && !to.meta.roles.includes(role)) {
    return resolveRoleHome(role)
  }

  if (!isRolePathAllowed(role, to.path) && to.path !== '/') {
    return resolveRoleHome(role)
  }

  if (to.path === '/') {
    return resolveRoleHome(role)
  }

  if (role === 'cashier' && isCashierStartupRoutePath(to.path)) {
    const startupAssessment = await runCashierStartupOrchestrator({
      token: auth.token,
      user: auth.user,
    })

    if (startupAssessment.state === 'offline_unavailable' && to.path !== '/cashier') {
      return '/cashier'
    }
  }

  return true
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { public: true },
    },
    {
      path: '/',
      component: AppShell,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: () => {
            const auth = getAuthStore()
            return resolveRoleHome(auth.effectiveRole ?? auth.userRole)
          },
        },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: DashboardView,
          meta: { roles: ['head_social'], keepAlive: true },
        },
        {
          path: 'social',
          name: 'social',
          component: SocialPedagogView,
          meta: { roles: ['social', 'head_social'] },
        },
        {
          path: 'social/create',
          name: 'social-student-create',
          component: SocialStudentCreateView,
          meta: { roles: ['social', 'head_social'] },
        },
        {
          path: 'social/issuance',
          name: 'social-issuance',
          component: SocialIssueCenterView,
          meta: { roles: ['social', 'head_social'] },
        },
        {
          path: 'cashier',
          name: 'cashier',
          component: loadCashierView,
          meta: { roles: ['cashier'] },
        },
        {
          path: 'cashier/terminal',
          name: 'cashier-terminal',
          component: loadCashierTerminalView,
          meta: { roles: ['cashier'], kiosk: true },
        },
        {
          path: 'cashier/summary',
          name: 'cashier-summary',
          component: loadCashierSummaryView,
          meta: { roles: ['cashier', 'head_social'] },
        },
        {
          path: 'cashier/journal',
          name: 'cashier-journal',
          component: loadCashierJournalView,
          meta: { roles: ['cashier'] },
        },
        {
          path: 'accountant',
          name: 'accountant',
          component: AccountView,
          meta: { roles: ['accountant'] },
        },
        {
          path: 'reports',
          name: 'reports',
          component: SocialReportsView,
          meta: { roles: ['head_social'] },
        },
        {
          path: 'admin',
          name: 'admin',
          component: AdminView,
          meta: { roles: ['admin'], fullscreen: true },
        },
        {
          path: 'audit',
          name: 'audit',
          component: AuditView,
          meta: { roles: ['admin'] },
        },
        {
          path: 'holidays',
          name: 'holidays',
          component: HolidayCalendarView,
          meta: { roles: ['social', 'head_social'] },
        },
        {
          path: 'categories-settings',
          name: 'categories-settings',
          component: CategorySettingsView,
          meta: { roles: ['social', 'head_social'] },
        },
        {
          path: 'students/:id',
          name: 'student-detail',
          component: StudentDetailView,
          meta: { roles: ['social', 'head_social', 'cashier', 'accountant'] },
        },
        {
          path: ':pathMatch(.*)*',
          name: 'app-not-found',
          component: NotFoundView,
          meta: { roles: ['social', 'head_social', 'cashier', 'accountant', 'admin'] },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFoundView,
      meta: { public: true },
    },
  ],
})

router.beforeEach(async (to) => redirectForAuth(to))

export default router
