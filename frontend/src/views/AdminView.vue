<script setup lang="ts">
import { computed } from 'vue'

import AdminImportStudentsCard from '@/components/admin/AdminImportStudentsCard.vue'
import AdminAuditPanel from '@/components/admin/AdminAuditPanel.vue'
import AdminCatalogsPanel from '@/components/admin/AdminCatalogsPanel.vue'
import AdminHelpPanel from '@/components/admin/AdminHelpPanel.vue'
import AdminMetricCards from '@/components/admin/AdminMetricCards.vue'
import AdminRolePreviewPanel from '@/components/admin/AdminRolePreviewPanel.vue'
import AdminSectionTabs from '@/components/admin/AdminSectionTabs.vue'
import AdminStudentCreateModal from '@/components/admin/AdminStudentCreateModal.vue'
import AdminUserCreateModal from '@/components/admin/AdminUserCreateModal.vue'
import AdminStudentsPanel from '@/components/admin/AdminStudentsPanel.vue'
import AdminUsersPanel from '@/components/admin/AdminUsersPanel.vue'
import BrandLogo from '@/components/common/BrandLogo.vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import { APP_NAME } from '@/config/app'
import { useAdminWorkspace, type AdminSection } from '@/composables/useAdminWorkspace'
import { getAdminRoleLabel } from '@/utils/adminPresentation'

const workspace = useAdminWorkspace()

const sidebarItems: Array<{ label: string; section: AdminSection; icon: 'students' | 'student' | 'excel' | 'document' | 'reports' }> = [
  { label: 'Пользователи', section: 'users', icon: 'students' },
  { label: 'Студенты', section: 'students', icon: 'student' },
  { label: 'Импорт студентов', section: 'import', icon: 'excel' },
  { label: 'Справочники', section: 'catalogs', icon: 'document' },
  { label: 'Аудит действий', section: 'audit', icon: 'reports' },
]

const activeSectionModel = computed({
  get: () => workspace.activeSection.value,
  set: (value: AdminSection) => workspace.navigateToSection(value),
})

const currentPreviewLabel = computed(() =>
  workspace.auth.isRolePreviewActive
    ? getAdminRoleLabel(workspace.auth.effectiveRole ?? 'social')
    : 'Режим администратора',
)
const previewModeOptions = computed(() => workspace.rolePreviewOptions.value)
const previewModeModel = computed({
  get: () => workspace.rolePreview.value,
  set: (value) => {
    workspace.rolePreview.value = value
  },
})

function openPreviewMode() {
  workspace.applyRolePreview()
}
</script>

<template>
  <div class="admin-layout">
    <aside class="admin-sidebar">
      <RouterLink to="/admin" class="admin-brand">
        <span class="admin-brand__mark" aria-hidden="true">
          <BrandLogo alt="" />
        </span>
        <span class="admin-brand__copy">{{ APP_NAME }}</span>
      </RouterLink>

      <nav class="admin-sidebar__nav" aria-label="Панель администратора">
        <span class="admin-sidebar__label">Панель администратора</span>
        <button
          v-for="item in sidebarItems"
          :key="item.section"
          type="button"
          class="admin-nav-item"
          :class="{ active: workspace.activeSection.value === item.section }"
          @click="workspace.navigateToSection(item.section)"
        >
          <AppIcon :name="item.icon" />
          {{ item.label }}
        </button>
      </nav>

      <footer class="admin-sidebar__user">
        <div class="admin-sidebar__user-head">
          <span class="admin-avatar" aria-hidden="true">
            <AppIcon name="student" />
          </span>
          <span>
            <strong>{{ workspace.auth.displayName }}</strong>
            <small>{{ getAdminRoleLabel(workspace.auth.userRole ?? 'admin') }}</small>
          </span>
        </div>

        <AdminRolePreviewPanel
          v-if="workspace.rolePreviewOptions.value.length"
          v-model="previewModeModel"
          :options="previewModeOptions"
          :current-label="currentPreviewLabel"
          :preview-active="workspace.auth.isRolePreviewActive"
          :account-role-label="getAdminRoleLabel(workspace.auth.userRole ?? 'admin')"
          @apply="openPreviewMode"
          @reset="workspace.clearRolePreview"
        />
      </footer>
    </aside>

    <main class="admin-main">
      <header class="admin-main__header">
        <div>
          <h1>Панель администратора</h1>
          <p>Управление пользователями, студентами, импортом данных и справочниками системы.</p>
        </div>

        <div class="admin-main__actions">
          <p-button label="Выйти" severity="secondary" outlined @click="workspace.logout">
            <template #icon>
              <AppIcon name="signOut" />
            </template>
          </p-button>
        </div>
      </header>

      <p v-if="workspace.message.value" class="admin-alert success">{{ workspace.message.value }}</p>
      <p v-if="workspace.error.value" class="admin-alert error">{{ workspace.error.value }}</p>

      <AdminMetricCards :cards="workspace.metricCards.value" />

      <AdminSectionTabs v-model="activeSectionModel" />

      <AdminUsersPanel
        v-if="workspace.activeSection.value === 'users'"
        :users="workspace.filteredUsers.value"
        :search="workspace.userSearch.value"
        :role-filter="workspace.userRoleFilter.value"
        :status-filter="workspace.userStatusFilter.value"
        :building-filter="workspace.userBuildingFilter.value"
        :role-options="workspace.userRoleFilterOptions.value"
        :status-options="workspace.userStatusFilterOptions"
        :has-filters="workspace.hasUserFilters.value"
        @update:search="workspace.userSearch.value = $event"
        @update:role-filter="workspace.userRoleFilter.value = $event"
        @update:status-filter="workspace.userStatusFilter.value = $event"
        @update:building-filter="workspace.userBuildingFilter.value = $event"
        @reset-filters="workspace.resetUserFilters"
        @create-user="workspace.showUserCreate.value = true"
        @edit-user="workspace.fillUserEditor"
      />

      <section
        v-if="workspace.activeSection.value === 'users' && workspace.selectedUser.value"
        :ref="(el) => (workspace.userEditorRef.value = el as HTMLElement | null)"
        class="admin-edit-card"
      >
        <header>
          <h2>Редактирование пользователя</h2>
          <p>{{ workspace.selectedUser.value.username }}</p>
        </header>
        <div class="admin-form-grid">
          <label class="field">
            <span>ФИО</span>
            <p-input-text v-model="workspace.editUserForm.full_name" />
          </label>
          <label class="field">
            <span>Email</span>
            <p-input-text v-model="workspace.editUserForm.email" placeholder="Можно оставить пустым" />
          </label>
          <label class="field">
            <span>Телефон</span>
            <p-input-text v-model="workspace.editUserForm.phone" placeholder="Можно оставить пустым" />
          </label>
          <label class="field">
            <span>Корпус</span>
            <p-dropdown
              v-model="workspace.editUserForm.building_id"
              :options="workspace.buildingOptions"
              option-label="label"
              option-value="value"
              :disabled="!workspace.selectedUserRequiresBuilding.value"
            />
          </label>
        </div>
        <label class="admin-check-row">
          <p-checkbox v-model="workspace.editUserForm.is_active" binary />
          <span>Учетная запись активна</span>
        </label>
        <div class="admin-edit-actions">
          <p-button label="Сохранить" :loading="workspace.loading.value" @click="workspace.saveUserEdit" />
          <p-button
            :label="workspace.selectedUser.value.is_active ? 'Отключить' : 'Включить'"
            severity="secondary"
            outlined
            @click="workspace.toggleUser(workspace.selectedUser.value)"
          />
          <p-button label="Скопировать логин" severity="secondary" text @click="workspace.copyFieldValue(workspace.selectedUser.value.username, 'Логин')" />
        </div>
      </section>

      <AdminStudentsPanel
        v-if="workspace.activeSection.value === 'students'"
        :students="workspace.visibleStudents.value"
        :total="workspace.studentTotal.value"
        :page="workspace.studentPage.value"
        :page-size="workspace.studentPageSize.value"
        :loading="workspace.loading.value"
        :search="workspace.studentSearch.value"
        :category-filter="workspace.studentCategoryFilter.value"
        :status-filter="workspace.studentStatusFilter.value"
        :categories="workspace.categories.value"
        :status-options="workspace.studentStatusFilterOptions"
        :page-size-options="workspace.studentPageSizeOptions"
        :has-filters="workspace.hasStudentFilters.value"
        @update:search="workspace.studentSearch.value = $event"
        @update:category-filter="workspace.studentCategoryFilter.value = $event"
        @update:status-filter="workspace.studentStatusFilter.value = $event"
        @update:page-size="workspace.studentPageSize.value = $event"
        @reset-filters="workspace.resetStudentFilters"
        @create-student="workspace.showStudentCreate.value = true"
        @edit-student="workspace.fillStudentEditor"
        @open-student="workspace.openStudentCard"
        @change-page="workspace.changeStudentPage"
      />

      <section
        v-if="workspace.activeSection.value === 'students' && workspace.selectedStudent.value"
        :ref="(el) => (workspace.studentEditorRef.value = el as HTMLElement | null)"
        class="admin-edit-card"
      >
        <header>
          <h2>Редактирование студента</h2>
          <p>{{ workspace.studentCodeLabel }} {{ workspace.selectedStudentDisplayCard.value }} · {{ workspace.selectedStudentEffectiveBuilding.value }}</p>
        </header>
        <div class="admin-form-grid">
          <label class="field">
            <span>ФИО</span>
            <p-input-text v-model="workspace.editStudentForm.full_name" />
          </label>
          <label class="field">
            <span>Группа</span>
            <p-input-text v-model="workspace.editStudentForm.group_name" />
          </label>
          <label class="field">
            <span>Корпус</span>
            <p-dropdown v-model="workspace.editStudentForm.building_id" :options="workspace.buildingOptions" option-label="label" option-value="value" />
          </label>
          <label class="field">
            <span>Категория</span>
            <p-dropdown v-model="workspace.editStudentForm.category_id" :options="workspace.categories.value" option-label="name" option-value="id" />
          </label>
        </div>
        <label class="admin-check-row">
          <p-checkbox v-model="workspace.editStudentForm.is_active" binary />
          <span>Студент активен</span>
        </label>
        <div class="admin-edit-actions">
          <p-button label="Сохранить" :loading="workspace.loading.value" @click="workspace.saveStudentEdit" />
          <p-button
            :label="workspace.selectedStudent.value.is_active ? 'Отключить' : 'Включить'"
            severity="secondary"
            outlined
            @click="workspace.toggleStudent(workspace.selectedStudent.value)"
          />
          <p-button label="Открыть карточку" severity="secondary" text @click="workspace.openStudentCard(workspace.selectedStudent.value.id)" />
        </div>
      </section>

      <section v-if="workspace.activeSection.value === 'import'" class="admin-drawer-card">
        <AdminImportStudentsCard
          :loading="workspace.loading.value"
          :busy="workspace.importLoadingEntity.value === 'students'"
          :summary="workspace.studentImportResult.value"
          @download-template="workspace.downloadStudentTemplate"
          @preview-import="workspace.runStudentImport($event, true)"
          @run-import="workspace.runStudentImport($event, false)"
        />
      </section>

      <AdminCatalogsPanel
        v-if="workspace.activeSection.value === 'catalogs'"
        :categories="workspace.categories.value"
      />

      <AdminAuditPanel
        v-if="workspace.activeSection.value === 'audit'"
        :total-actions="workspace.auditActionsToday.value"
        :active-users="workspace.auditUsersToday.value"
        :latest-entry="workspace.latestAuditEntry.value"
        :entries="workspace.recentAuditEntries.value"
        @open-full="workspace.openAuditPage"
      />

      <AdminHelpPanel
        :preview-label="currentPreviewLabel"
        :preview-active="workspace.auth.isRolePreviewActive"
        :audit-actions-today="workspace.auditActionsToday.value"
        @open-audit="workspace.openAuditPage"
      />

      <AdminUserCreateModal
        :visible="workspace.showUserCreate.value"
        :loading="workspace.loading.value"
        :reset-key="workspace.userFormResetKey.value"
        :allow-admin-role="workspace.canCreateAdminUsers.value"
        @close="workspace.showUserCreate.value = false"
        @submit="workspace.submitUser"
      />

      <AdminStudentCreateModal
        :visible="workspace.showStudentCreate.value"
        :categories="workspace.categories.value"
        :loading="workspace.loading.value"
        :reset-key="workspace.studentFormResetKey.value"
        :building-id="null"
        :building-label="null"
        :lock-building="false"
        :group-suggestions="workspace.studentGroupSuggestions.value"
        :error-message="workspace.error.value"
        @close="workspace.showStudentCreate.value = false"
        @submit="workspace.submitStudent"
      />
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  background: #f6f8fb;
  color: #0b1730;
}

.admin-sidebar {
  position: sticky;
  top: 0;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 26px;
  padding: 28px 22px;
  border-right: 1px solid #dce5f1;
  background: rgba(255, 255, 255, 0.94);
}

.admin-brand {
  display: flex;
  align-items: center;
  gap: 14px;
  color: inherit;
}

.admin-brand__mark {
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
}

.admin-brand__copy {
  max-width: 180px;
  color: #07172f;
  font-size: 22px;
  line-height: 1.1;
  font-weight: 800;
}

.admin-sidebar__nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.admin-sidebar__label {
  margin-bottom: 6px;
  color: #6a7890;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.admin-nav-item {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 54px;
  padding: 0 14px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #40506a;
  font: inherit;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}

.admin-nav-item.active {
  background: #eef5ff;
  color: #0866ff;
}

.admin-sidebar__user,
.admin-help,
.admin-drawer-card,
.admin-edit-card {
  border: 1px solid #dce5f1;
  border-radius: 14px;
  background: #fff;
}

.admin-sidebar__user {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-top: auto;
  padding: 18px;
}

.admin-sidebar__user-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.admin-sidebar__user strong,
.admin-sidebar__user small {
  display: block;
}

.admin-sidebar__user small {
  margin-top: 4px;
  color: #5c6a82;
}

.admin-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: 1px solid #dce5f1;
}

.admin-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 36px 38px 28px;
}

.admin-main__header,
.admin-main__actions {
  display: flex;
  align-items: flex-start;
  gap: 24px;
}

.admin-main__header {
  justify-content: space-between;
}

.admin-main__header h1,
.admin-main__header p {
  margin: 0;
}

.admin-main__header h1 {
  color: #07172f;
  font-size: 32px;
  line-height: 1.1;
  font-weight: 800;
}

.admin-main__header p {
  margin-top: 10px;
  color: #56657d;
  font-size: 16px;
}

.admin-main__actions {
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: flex-end;
}

.admin-alert {
  margin: 0;
  padding: 12px 16px;
  border-radius: 12px;
  font-weight: 700;
}

.admin-alert.success {
  background: #e8f8ef;
  color: #087443;
}

.admin-alert.error {
  background: #fef2f2;
  color: #b42318;
}

.admin-drawer-card,
.admin-edit-card,
.admin-help {
  padding: 24px;
}

.admin-edit-card {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.admin-edit-card header h2,
.admin-edit-card header p,
.admin-simple-header h2,
.admin-simple-header p {
  margin: 0;
}

.admin-edit-card header h2,
.admin-simple-header h2 {
  color: #07172f;
  font-size: 22px;
}

.admin-edit-card header p,
.admin-simple-header p {
  margin-top: 6px;
  color: #5c6a82;
}

.admin-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.admin-check-row {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
}

.admin-edit-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

@media (max-width: 1180px) {
  .admin-layout {
    grid-template-columns: 1fr;
  }

  .admin-sidebar {
    position: static;
    min-height: 0;
  }

  .admin-main__header {
    flex-direction: column;
  }
}

@media (max-width: 720px) {
  .admin-main {
    padding: 22px 16px;
  }

  .admin-main__actions,
  .admin-form-grid,
  .admin-help {
    align-items: stretch;
    flex-direction: column;
    grid-template-columns: 1fr;
  }

}
</style>
