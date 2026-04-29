<script setup lang="ts">
import AppIcon from '@/components/icons/AppIcon.vue'
import StudentsPager from '@/components/students/StudentsPager.vue'
import { buildingOptions } from '@/config/options'
import type { Category, Student, StudentStatusFilter } from '@/types'

defineProps<{
  students: Student[]
  total: number
  page: number
  pageSize: number
  loading: boolean
  search: string
  categoryFilter: number | 'all'
  statusFilter: StudentStatusFilter
  categories: Category[]
  statusOptions: Array<{ label: string; value: StudentStatusFilter }>
  pageSizeOptions: Array<{ label: string; value: number }>
  hasFilters: boolean
}>()

const emit = defineEmits<{
  'update:search': [value: string]
  'update:categoryFilter': [value: number | 'all']
  'update:statusFilter': [value: StudentStatusFilter]
  'update:pageSize': [value: number]
  resetFilters: []
  createStudent: []
  editStudent: [student: Student]
  openStudent: [studentId: string]
  changePage: [page: number]
}>()
</script>

<template>
  <section class="admin-panel">
    <header class="admin-panel__header">
      <div>
        <h2>Студенты</h2>
        <p>Списки по корпусам, категориям и статусам.</p>
      </div>
      <p-button class="admin-primary-action" @click="emit('createStudent')">
        <template #icon>
          <AppIcon name="plus" />
        </template>
        Добавить студента
      </p-button>
    </header>

    <div class="admin-panel__filters">
      <label class="admin-search">
        <span class="admin-search__icon" aria-hidden="true">
          <AppIcon name="search" />
        </span>
        <p-input-text
          id="admin-student-search"
          :model-value="search"
          placeholder="Поиск по ФИО или группе"
          @update:model-value="emit('update:search', String($event))"
        />
      </label>

      <label class="admin-filter">
        <span>Категория</span>
        <p-dropdown
          :model-value="categoryFilter"
          :options="[{ id: 'all', name: 'Все категории' }, ...categories]"
          option-label="name"
          option-value="id"
          @update:model-value="emit('update:categoryFilter', $event as number | 'all')"
        />
      </label>

      <label class="admin-filter">
        <span>Статус</span>
        <p-dropdown
          :model-value="statusFilter"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          @update:model-value="emit('update:statusFilter', $event as StudentStatusFilter)"
        />
      </label>

      <label class="admin-filter">
        <span>На странице</span>
        <p-dropdown
          :model-value="pageSize"
          :options="pageSizeOptions"
          option-label="label"
          option-value="value"
          @update:model-value="emit('update:pageSize', Number($event))"
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
            <th>Группа</th>
            <th>Код</th>
            <th>Категория</th>
            <th>Корпус</th>
            <th>Статус</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="student in students" :key="student.id">
            <td>{{ student.full_name }}</td>
            <td>{{ student.group_name }}</td>
            <td>{{ student.student_card }}</td>
            <td>{{ student.category.name }}</td>
            <td>{{ student.building_name || buildingOptions.find((item) => item.value === student.building_id)?.label || `Корпус ${student.building_id}` }}</td>
            <td>
              <span class="status-badge" :class="{ inactive: !student.is_active }">
                {{ student.is_active ? 'Активен' : 'Отключен' }}
              </span>
            </td>
            <td>
              <div class="row-actions">
                <button type="button" class="table-action" aria-label="Открыть карточку" @click="emit('openStudent', student.id)">
                  <AppIcon name="open" />
                </button>
                <button type="button" class="table-action" aria-label="Редактировать студента" @click="emit('editStudent', student)">
                  <AppIcon name="more" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="students.length === 0" class="admin-empty">Студенты не найдены</div>
    </div>

    <StudentsPager
      :total="total"
      :page="page"
      :page-size="pageSize"
      :loading="loading"
      @change-page="emit('changePage', $event)"
    />
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
.admin-panel__filters {
  display: flex;
  align-items: center;
  gap: 16px;
}

.admin-panel__header {
  justify-content: space-between;
  margin-bottom: 24px;
}

.admin-panel__header h2,
.admin-panel__header p {
  margin: 0;
}

.admin-panel__header h2 {
  color: #07172f;
  font-size: 22px;
  line-height: 1.2;
}

.admin-panel__header p {
  margin-top: 6px;
  color: #5c6a82;
}

.admin-primary-action {
  min-width: 200px;
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
  min-width: 940px;
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

.status-badge {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 7px;
  background: #e8f8ef;
  color: #079455;
  font-size: 13px;
  font-weight: 800;
}

.status-badge.inactive {
  background: #f1f5f9;
  color: #64748b;
}

.row-actions {
  display: inline-flex;
  gap: 8px;
}

.table-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
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

@media (max-width: 1180px) {
  .admin-panel__filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .admin-panel {
    padding: 18px;
  }

  .admin-panel__header {
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
