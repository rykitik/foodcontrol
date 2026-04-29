<script setup lang="ts">
import AppIcon from '@/components/icons/AppIcon.vue'
import SocialBulkBar from '@/components/social/SocialBulkBar.vue'
import SocialBulkIssuePanel from '@/components/social/SocialBulkIssuePanel.vue'
import SocialStudentCreateModal from '@/components/social/SocialStudentCreateModal.vue'
import SocialStudentsFilterBar from '@/components/social/SocialStudentsFilterBar.vue'
import SocialStudentsTable from '@/components/social/SocialStudentsTable.vue'
import SocialWorkspaceLayout from '@/components/social/SocialWorkspaceLayout.vue'
import StudentsPager from '@/components/students/StudentsPager.vue'
import TicketEndDateModal from '@/components/tickets/TicketEndDateModal.vue'
import { useSocialStudentsPage } from '@/composables/useSocialStudentsPage'

const page = useSocialStudentsPage()
</script>

<template>
  <SocialWorkspaceLayout active-nav="students">
    <section class="students-page">
      <header class="page-head">
        <div class="page-copy">
          <h1>Студенты</h1>
          <p class="page-context">{{ page.pageContextLabel }}</p>
        </div>

        <p-button
          class="page-add-button"
          @click="page.openCreateStudent"
        >
          <span class="page-add-button-content">
            <AppIcon name="studentAdd" />
            <span>Добавить студента</span>
          </span>
        </p-button>
      </header>

      <SocialStudentsFilterBar
        :search="page.search"
        :month="page.month"
        :year="page.year"
        :category-id="page.categoryId"
        :student-status-filter="page.studentStatusFilter"
        :categories="page.categories"
        :loading="page.loading"
        @update:search="page.search = $event"
        @update:month="page.month = $event"
        @update:year="page.year = $event"
        @update:category-id="page.categoryId = $event"
        @update:student-status-filter="page.studentStatusFilter = $event"
        @submit-search="page.submitStudentSearch"
        @refresh="page.loadPage"
      />

      <div v-if="page.successMessage" class="banner banner--success">{{ page.successMessage }}</div>
      <div v-if="page.errorMessage" class="banner banner--error">{{ page.errorMessage }}</div>
      <div v-if="!page.canIssueTickets" class="banner banner--warn">{{ page.issueDisabledReason }}</div>

      <SocialBulkBar
        v-if="page.hasSelection"
        :count="page.selectedCount"
        :busy="page.bulkIssueSubmitting"
        @clear="page.clearSelection"
        @issue="page.openBulkIssuePanel"
      />

      <SocialStudentsTable
        :students="page.students"
        :tickets="page.tickets"
        :loading="page.loading"
        :busy-student-id="page.busyStudentId"
        :busy-ticket-id="page.busyTicketId"
        :printing-ticket-id="page.printingTicketId"
        :busy-meal-building-student-id="page.busyMealBuildingStudentId"
        :manageable-building-id="page.manageableBuildingId"
        :management-disabled-reason="page.managementDisabledReason"
        :can-issue-tickets="page.canIssueTickets"
        :issue-disabled-reason="page.issueDisabledReason"
        :selected-student-ids="page.selectedStudentIds"
        :all-visible-selected="page.allVisibleSelected"
        @issue="page.issue"
        @cancel="page.cancel"
        @change-end-date="page.openTicketEndDateModal"
        @reissue="page.reissue"
        @print="page.print"
        @toggle-active="page.toggleStudentActive"
        @open="page.open"
        @toggle-select="page.toggleStudent"
        @toggle-select-all="page.toggleAllVisible"
        @update-meal-building="page.saveMealBuilding"
      />

      <StudentsPager
        variant="numeric"
        summary-label="Всего студентов"
        :total="page.studentTotal"
        :page="page.studentPage"
        :page-size="page.studentPageSize"
        :loading="page.loading"
        @change-page="page.changeStudentPage"
      />

      <SocialBulkIssuePanel
        :visible="page.bulkIssuePanelOpen"
        :selected-count="page.selectedCount"
        :month-label="page.selectedMonthLabel"
        :period-type="page.ticketPeriod.periodType"
        :start-date="page.ticketPeriod.startDate"
        :end-date="page.ticketPeriod.endDate"
        :start-date-min="page.ticketPeriod.startDateMin"
        :end-date-max="page.ticketPeriod.endDateMax"
        :preview="page.bulkPreview"
        :loading="page.bulkPreviewLoading"
        :submitting="page.bulkIssueSubmitting"
        :error-message="page.bulkPreviewError"
        :validation-message="page.ticketPeriod.validationMessage"
        @close="page.closeBulkIssuePanel"
        @submit="page.issueSelectedStudents"
        @update-period-type="page.ticketPeriod.setPeriodType"
        @update-start-date="page.ticketPeriod.setStartDate"
        @update-end-date="page.ticketPeriod.setEndDate"
      />

      <SocialStudentCreateModal
        :visible="page.studentCreateModalOpen"
        :categories="page.categories"
        :loading="page.studentCreateSubmitting"
        :reset-key="page.studentCreateResetKey"
        :error-message="page.studentCreateError"
        :building-id="page.studentCreateBuildingId"
        :building-label="page.studentCreateBuildingLabel"
        :lock-building="page.studentCreateLockBuilding"
        :group-suggestions="page.studentGroupSuggestions"
        @close="page.closeCreateStudentModal"
        @submit="page.submitStudent"
      />

      <TicketEndDateModal
        :visible="page.ticketEndDateModalOpen"
        :ticket="page.ticketEndDateTarget"
        :loading="page.ticketEndDateSubmitting"
        :error-message="page.ticketEndDateError"
        @close="page.closeTicketEndDateModal"
        @submit="page.submitTicketEndDate"
      />
    </section>
  </SocialWorkspaceLayout>
</template>

<style scoped>
.students-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.page-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-head h1 {
  margin: 0;
  font-size: 28px;
  line-height: 36px;
  color: #111827;
}

.page-context {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
  line-height: 20px;
}

.page-add-button :deep(.p-button) {
  min-height: 42px;
  padding-inline: 18px;
  border-radius: 12px;
}

.page-add-button-content {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.banner {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.banner--success {
  background: #dcfce7;
  color: #166534;
}

.banner--error {
  background: #fee2e2;
  color: #991b1b;
}

.banner--warn {
  background: #fef3c7;
  color: #92400e;
}

@media (max-width: 1120px) {
  .page-head {
    flex-direction: column;
    align-items: stretch;
  }

  .page-add-button {
    width: 100%;
  }
}

@media (max-width: 720px) {
  .students-page {
    gap: 16px;
  }

  .page-head h1 {
    font-size: 24px;
    line-height: 30px;
  }
}
</style>
