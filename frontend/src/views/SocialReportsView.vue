<script setup lang="ts">
import ReportsWorkspacePage from '@/components/reports/ReportsWorkspacePage.vue'
import SocialWorkspaceLayout from '@/components/social/SocialWorkspaceLayout.vue'
</script>

<template>
  <SocialWorkspaceLayout active-nav="reports">
    <ReportsWorkspacePage
      title="Отчеты"
      subtitle="Итоговые ведомости, печатные формы и Excel-документы по выбранному периоду."
      load-error-message="Не удалось загрузить раздел отчетов начальника соцпедагогов"
    />
  </SocialWorkspaceLayout>
</template>
