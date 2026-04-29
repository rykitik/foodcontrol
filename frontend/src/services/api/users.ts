import type { User, UserCreateRequest, UserUpdateRequest } from '@/types'

import * as mock from '../mock'
import { authHeaders, requestJson } from '../http'

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase()
}

function normalizeCreateRequest(request: UserCreateRequest): UserCreateRequest {
  return {
    ...request,
    username: normalizeUsername(request.username),
  }
}

function normalizeUpdateRequest(request: UserUpdateRequest): UserUpdateRequest {
  if (!('username' in request)) {
    return request
  }

  return {
    ...request,
    username: normalizeUsername(request.username ?? ''),
  }
}

export async function listUsers(token?: string | null): Promise<User[]> {
  return requestJson('/users', { method: 'GET', headers: authHeaders(token) }, () => mock.listUsers(token))
}

export async function createUser(request: UserCreateRequest, token?: string | null): Promise<User> {
  const payload = normalizeCreateRequest(request)
  return requestJson(
    '/users',
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    },
    () => mock.createUser(payload, token),
  )
}

export async function updateUser(userId: string, request: UserUpdateRequest, token?: string | null): Promise<User> {
  const payload = normalizeUpdateRequest(request)
  return requestJson(
    `/users/${userId}`,
    {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    },
    () => mock.updateUser(userId, payload, token),
  )
}
