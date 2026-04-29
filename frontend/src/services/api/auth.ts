import type { LoginRequest, LoginResponse, User } from '@/types'

import * as mock from '../mock'
import { authHeaders, requestJson } from '../http'

export async function login(request: LoginRequest): Promise<LoginResponse> {
  return requestJson(
    '/auth/login',
    { method: 'POST', body: JSON.stringify(request), credentials: 'include' },
    () => mock.login(request),
  )
}

export async function getProfile(token?: string | null): Promise<User> {
  return requestJson('/auth/profile', { method: 'GET', headers: authHeaders(token) }, () => mock.getProfile(token))
}

export async function refreshSession(): Promise<LoginResponse> {
  return requestJson(
    '/auth/refresh',
    { method: 'POST', credentials: 'include' },
    () => {
      throw new Error('Mock refresh is not available')
    },
  )
}

export async function logout(token?: string | null): Promise<void> {
  await requestJson(
    '/auth/logout',
    { method: 'POST', headers: authHeaders(token), credentials: 'include' },
    () => undefined,
  )
}
