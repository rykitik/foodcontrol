<script setup lang="ts">
import AppIcon from '@/components/icons/AppIcon.vue'
import { buildingOptions } from '@/config/options'
import {
  adminRoleTone,
  formatAdminDateTime,
  getAdminRoleLabel,
} from '@/utils/adminPresentation'
import type { User, UserRole } from '@/types'
import type { UserStatusFilter } from '@/config/adminFilters'

defineProps<{
  users: User[]
  search: string
  roleFilter: UserRole | 'all'
  statusFilter: UserStatusFilter
  buildingFilter: number | 'all'
  roleOptions: Array<{ label: string; value: UserRole | 'all' }>
  statusOptions: Array<{ label: string; value: UserStatusFilter }>
  hasFilters: boolean
}>()

const emit = defineEmits<{
  'update:search': [value: string]
  'update:roleFilter': [value: UserRole | 'all']
  'update:statusFilter': [value: UserStatusFilter]
  'update:buildingFilter': [value: number | 'all']
  resetFilters: []
  createUser: []
  editUser: [user: User]
}>()

const userBuildingOptions = [{ label: 'Все корпуса', value: 'all' as const }, ...buildingOptions]
</script>

<template>
  <section class="admin-panel">
    <header class="admin-panel__header">
      <div>
        <h2>Пользователи системы</h2>
      </div>
      <p-button class="admin-primary-action" @click="emit('createUser')">
        <template #icon>
          <AppIcon name="plus" />
        </template>
        Создать пользователя
      </p-button>
    </header>

    <div class="admin-panel__filters">
      <label class="admin-search">
        <span class="admin-search__icon" aria-hidden="true">
          <AppIcon name="search" />
        </span>
        <p-input-text
          id="admin-user-search"
          :model-value="search"
          placeholder="Поиск по ФИО или логину"
          @update:model-value="emit('update:search', String($event))"
        />
      </label>

      <label class="admin-filter">
        <span>Роль</span>
        <p-dropdown
          :model-value="roleFilter"
          :options="roleOptions"
          option-label="label"
          option-value="value"
          @update:model-value="emit('update:roleFilter', $event as UserRole | 'all')"
        />
      </label>

      <label class="admin-filter">
        <span>Статус</span>
        <p-dropdown
          :model-value="statusFilter"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          @update:model-value="emit('update:statusFilter', $event as UserStatusFilter)"
        />
      </label>

      <label class="admin-filter">
        <span>Корпус</span>
        <p-dropdown
          :model-value="buildingFilter"
          :options="userBuildingOptions"
          option-label="label"
          option-value="value"
          @update:model-value="emit('update:buildingFilter', $event as number | 'all')"
        />
      </label>

      <p-button severity="secondary" outlined :disabled="!hasFilters" @click="emit('resetFilters')">
        <template #icon>
          <AppIcon name="refresh" />
        </template>
        Сбросить
      </p-button>
    </div>

    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>ФИО</th>
            <th>Логин</th>
            <th>Роль</th>
            <th>Корпус</th>
            <th>Статус</th>
            <th>Последний вход</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td>{{ user.full_name }}</td>
            <td>{{ user.username }}</td>
            <td>
              <span class="role-badge" :class="`tone-${adminRoleTone[user.role]}`">
                {{ getAdminRoleLabel(user.role) }}
              </span>
            </td>
            <td>{{ user.building_name || 'Без корпуса' }}</td>
            <td>
              <span class="status-badge" :class="{ inactive: !user.is_active }">
                {{ user.is_active ? 'Активен' : 'Отключен' }}
              </span>
            </td>
            <td>{{ formatAdminDateTime(user.last_login) }}</td>
            <td>
              <button type="button" class="table-action" aria-label="Редактировать пользователя" @click="emit('editUser', user)">
                <AppIcon name="more" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="users.length === 0" class="admin-empty">Пользователи не найдены</div>
    </div>

    <footer class="admin-panel__footer">
      <span>1–{{ users.length }} из {{ users.length }} пользователей</span>
      <div class="admin-pagination">
        <button type="button" disabled>
          <AppIcon name="chevronLeft" />
        </button>
        <strong>1</strong>
        <button type="button" disabled>
          <AppIcon name="chevronRight" />
        </button>
      </div>
    </footer>
  </section>
</template>

<style scoped>
.admin-panel {
  padding: 28px;
  border: 1px solid #dce5f1;
  border-radius: 16px;
  background: #fff;
}

.admin-panel__header,
.admin-panel__filters,
.admin-panel__footer {
  display: flex;
  align-items: center;
  gap: 16px;
}

.admin-panel__header {
  justify-content: space-between;
  margin-bottom: 24px;
}

.admin-panel__header h2 {
  margin: 0;
  color: #07172f;
  font-size: 22px;
  line-height: 1.2;
}

.admin-primary-action {
  min-width: 220px;
}

.admin-panel__filters {
  display: grid;
  grid-template-columns: minmax(240px, 1.25fr) repeat(3, minmax(160px, 0.8fr)) auto;
  align-items: end;
  margin-bottom: 24px;
}

.admin-filter,
.admin-search {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.admin-filter span {
  color: #5c6a82;
  font-size: 13px;
  font-weight: 700;
}

.admin-search {
  position: relative;
  justify-content: flex-end;
}

.admin-search__icon {
  position: absolute;
  right: 14px;
  bottom: 11px;
  color: #6b7a92;
  z-index: 1;
}

.admin-search :deep(.p-inputtext) {
  padding-right: 42px;
}

.admin-table-wrap {
  overflow-x: auto;
  border: 1px solid #dfe7f2;
  border-radius: 12px;
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 900px;
}

.admin-table th,
.admin-table td {
  padding: 16px;
  border-bottom: 1px solid #e5edf6;
  color: #0b1730;
  text-align: left;
  vertical-align: middle;
}

.admin-table th {
  background: #f8fafc;
  color: #53627a;
  font-size: 13px;
  font-weight: 800;
}

.admin-table tr:last-child td {
  border-bottom: 0;
}

.role-badge,
.status-badge {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 800;
}

.role-badge.tone-blue {
  background: #edf4ff;
  color: #0866ff;
}

.role-badge.tone-violet {
  background: #f3edff;
  color: #7c3aed;
}

.role-badge.tone-orange {
  background: #fff4e6;
  color: #ea580c;
}

.role-badge.tone-green,
.status-badge {
  background: #e8f8ef;
  color: #079455;
}

.role-badge.tone-slate {
  background: #eef2f7;
  color: #475569;
}

.status-badge.inactive {
  background: #f1f5f9;
  color: #64748b;
}

.table-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 32px;
  border: 1px solid #d6e0ed;
  border-radius: 8px;
  background: #fff;
  color: #0b2348;
  cursor: pointer;
}

.admin-empty {
  padding: 24px;
  color: #64748b;
}

.admin-panel__footer {
  justify-content: space-between;
  margin-top: 22px;
  color: #40506a;
  font-weight: 600;
}

.admin-pagination {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.admin-pagination button,
.admin-pagination strong {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 9px;
}

.admin-pagination button {
  border: 1px solid #dce5f1;
  background: #fff;
  color: #91a0b5;
}

.admin-pagination strong {
  background: #0866ff;
  color: #fff;
}

@media (max-width: 1180px) {
  .admin-panel__filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .admin-panel {
    padding: 18px;
  }

  .admin-panel__header,
  .admin-panel__footer {
    align-items: stretch;
    flex-direction: column;
  }

  .admin-panel__filters {
    grid-template-columns: 1fr;
  }

  .admin-primary-action {
    width: 100%;
  }
}
</style>
