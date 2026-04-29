<script setup lang="ts">
import PageLoadingBlock from '@/components/common/PageLoadingBlock.vue'
import SocialIssueDocumentsPanel from '@/components/social/SocialIssueDocumentsPanel.vue'
import SocialIssueFiltersBar from '@/components/social/SocialIssueFiltersBar.vue'
import SocialIssueMetrics from '@/components/social/SocialIssueMetrics.vue'
import SocialOutlineIcon from '@/components/social/SocialOutlineIcon.vue'
import SocialWorkspaceLayout from '@/components/social/SocialWorkspaceLayout.vue'
import { useSocialIssueCenterPage } from '@/composables/useSocialIssueCenterPage'

const page = useSocialIssueCenterPage()
</script>

<template>
  <SocialWorkspaceLayout active-nav="issuance">
    <section class="issue-page">
      <header class="issue-head">
        <div class="issue-head__copy">
          <h1>Выпуск и печать</h1>
          <p>Печатные формы и выдача талонов по выбранному периоду</p>
        </div>
      </header>

      <PageLoadingBlock v-if="page.loading && !page.initialized" title="Подготовка печатных форм" />

      <template v-else>
        <SocialIssueFiltersBar
          :period-key="page.periodKey"
          :period-options="page.periodOptions"
          :category-id="page.selectedCategoryId"
          :categories="page.categories"
          :loading="page.loading"
          @update:period-key="page.setPeriodKey"
          @update:category-id="page.selectedCategoryId = $event"
          @refresh="page.refreshPeriodData"
          @use-current-period="page.setCurrentPeriod"
        />

        <p v-if="page.successMessage" class="success-banner">{{ page.successMessage }}</p>
        <p v-if="page.errorMessage" class="error-banner">{{ page.errorMessage }}</p>

        <SocialIssueMetrics
          :students-count="page.studentsCount"
          :workday-count="page.workdayCount"
          :holiday-count="page.holidayCount"
          :meal-day-count="page.mealDayCount"
        />

        <SocialIssueDocumentsPanel
          :loading="page.loading"
          @print-tickets="page.printTicketSheet"
          @print-students="page.printStudentList"
          @download-students="page.downloadStudentsWorkbook"
          @print-receipt="page.printReceiptSheet"
          @print-summary="page.printSummarySheet"
          @download-summary="page.downloadSummaryWorkbook"
        />

        <div class="issue-note">
          <span class="issue-note__icon">
            <SocialOutlineIcon name="info" />
          </span>
          <div class="issue-note__copy">
            <strong>Данные формируются на основе активных студентов и календаря питания.</strong>
            <p>Перед печатью убедитесь, что выбранный период и категория указаны верно.</p>
          </div>
        </div>
      </template>
    </section>
  </SocialWorkspaceLayout>
</template>

<style scoped>
.issue-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.issue-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.issue-head__copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.issue-head h1,
.issue-head p {
  margin: 0;
}

.issue-head h1 {
  color: #0f172a;
  font-size: 28px;
  line-height: 36px;
}

.issue-head p {
  color: #64748b;
  font-size: 14px;
  line-height: 20px;
}

.success-banner,
.error-banner {
  margin: 0;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid transparent;
  font-size: 14px;
  line-height: 20px;
}

.success-banner {
  border-color: #bbf7d0;
  background: #f0fdf4;
  color: #166534;
}

.error-banner {
  border-color: #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

.issue-note {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 18px;
  border: 1px solid #dbeafe;
  border-radius: 18px;
  background: #f8fbff;
  color: #1d4ed8;
}

.issue-note__icon {
  display: inline-flex;
  flex: 0 0 auto;
}

.issue-note__copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.issue-note__copy strong,
.issue-note__copy p {
  margin: 0;
}

.issue-note__copy strong {
  color: #1e3a8a;
  font-size: 14px;
  line-height: 20px;
}

.issue-note__copy p {
  color: #475569;
  font-size: 14px;
  line-height: 20px;
}

@media (max-width: 720px) {
  .issue-head h1 {
    font-size: 24px;
    line-height: 30px;
  }

  .issue-note {
    padding: 14px 16px;
  }
}
</style>
