import type { LoginRequest, LoginResponse, User } from '@/types'

import { appendLog, mutateDb, normalizeUsername, requireUser, sanitizeUser } from './helpers'

export function login(request: LoginRequest): LoginResponse {
  return mutateDb((nextDb) => {
    const username = normalizeUsername(request.username)
    if (!username || !request.password) {
      throw new Error('Логин и пароль обязательны')
    }

    const user = nextDb.users.find(
      (item) => normalizeUsername(item.username) === username && item.password === request.password,
    )
    if (!user) {
      throw new Error('Неверный логин или пароль')
    }
    if (!user.is_active) {
      throw new Error('Пользователь отключен')
    }

    user.last_login = new Date().toISOString()
    appendLog(nextDb, {
      user_id: user.id,
      user_name: user.full_name,
      action: 'login',
      entity_type: 'user',
      entity_id: user.id,
      details: {},
      ip_address: '127.0.0.1',
      user_agent: 'Mock Browser',
    })

    return { token: `mock.${user.id}.${Date.now()}`, user: sanitizeUser(user) }
  })
}

export function getProfile(token?: string | null): User {
  return sanitizeUser(requireUser(token))
}
