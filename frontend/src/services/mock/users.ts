import type { User, UserCreateRequest, UserUpdateRequest } from '@/types'

import type { MockUser } from './data'
import { readMockDb } from './store'
import { appendLog, buildBuildingName, clone, mutateDb, normalizeUsername, requireUser, sanitizeUser, uid } from './helpers'

function ensureCanListUsers(user: MockUser): void {
  if (!['head_social', 'accountant', 'admin'].includes(user.role)) {
    throw new Error('Недостаточно прав')
  }
}

function ensureCanManageUsers(actor: MockUser): void {
  if (!['head_social', 'admin'].includes(actor.role)) {
    throw new Error('Недостаточно прав')
  }
}

export function listUsers(token?: string | null): User[] {
  const user = requireUser(token)
  ensureCanListUsers(user)
  return clone(readMockDb().users.map((user) => sanitizeUser(user)))
}

export function createUser(request: UserCreateRequest, token?: string | null): User {
  return mutateDb((nextDb) => {
    const actor = requireUser(token, nextDb)
    ensureCanManageUsers(actor)
    if (actor.role === 'head_social' && request.role === 'admin') {
      throw new Error('Недостаточно прав для создания администратора')
    }

    const username = normalizeUsername(request.username)
    if (!username) {
      throw new Error('Логин обязателен')
    }

    if (nextDb.users.some((user) => normalizeUsername(user.username) === username)) {
      throw new Error('Пользователь с таким логином уже существует')
    }

    const buildingId = request.building_id ?? null
    const user: MockUser = {
      id: uid('u'),
      username,
      password: request.password,
      full_name: request.full_name.trim(),
      email: request.email?.trim() || undefined,
      phone: request.phone?.trim() || undefined,
      role: request.role,
      building_id: buildingId,
      building_name: buildBuildingName(buildingId),
      is_active: request.is_active ?? true,
    }

    nextDb.users.unshift(user)
    appendLog(nextDb, {
      user_id: actor.id,
      user_name: actor.full_name,
      action: 'create_user',
      entity_type: 'user',
      entity_id: user.id,
      details: { role: user.role },
      ip_address: '127.0.0.1',
      user_agent: 'Mock Browser',
    })

    return clone(sanitizeUser(user))
  })
}

export function updateUser(userId: string, request: UserUpdateRequest, token?: string | null): User {
  return mutateDb((nextDb) => {
    const actor = requireUser(token, nextDb)
    ensureCanManageUsers(actor)
    const user = nextDb.users.find((item) => item.id === userId)
    if (!user) {
      throw new Error('Пользователь не найден')
    }
    if (actor.role === 'head_social' && user.role === 'admin') {
      throw new Error('Недостаточно прав для изменения администратора')
    }

    if ('username' in request) {
      const username = normalizeUsername(request.username)
      if (!username) {
        throw new Error('Логин не может быть пустым')
      }
      if (nextDb.users.some((item) => item.id !== user.id && normalizeUsername(item.username) === username)) {
        throw new Error('Пользователь с таким логином уже существует')
      }
      user.username = username
    }

    if (request.full_name !== undefined) {
      user.full_name = request.full_name.trim() || user.full_name
    }
    if ('email' in request) {
      user.email = request.email?.trim() || undefined
    }
    if ('phone' in request) {
      user.phone = request.phone?.trim() || undefined
    }
    if ('building_id' in request) {
      user.building_id = request.building_id ?? null
    }
    user.building_name = buildBuildingName(user.building_id)
    if ('is_active' in request && request.is_active !== undefined) {
      user.is_active = request.is_active
    }

    appendLog(nextDb, {
      user_id: actor.id,
      user_name: actor.full_name,
      action: 'update_user',
      entity_type: 'user',
      entity_id: user.id,
      details: request as Record<string, unknown>,
      ip_address: '127.0.0.1',
      user_agent: 'Mock Browser',
    })

    return clone(sanitizeUser(user))
  })
}
