<script setup lang="ts">
import SocialIssueDocumentRow from '@/components/social/SocialIssueDocumentRow.vue'
import SocialOutlineIcon from '@/components/social/SocialOutlineIcon.vue'

defineProps<{
  loading?: boolean
}>()

const emit = defineEmits<{
  printTickets: []
  printStudents: []
  downloadStudents: []
  printReceipt: []
  printSummary: []
  downloadSummary: []
}>()
</script>

<template>
  <section class="issue-documents">
    <SocialIssueDocumentRow
      icon="ticket"
      tone="green"
      title="Лист талонов на питание"
      description="Печатные листы талонов для выдачи студентам."
    >
      <template #actions>
        <button type="button" class="issue-action-button issue-action-button--primary" :disabled="loading" @click="emit('printTickets')">
          <SocialOutlineIcon name="print" />
          <span>Печать талонов</span>
        </button>
      </template>
    </SocialIssueDocumentRow>

    <SocialIssueDocumentRow
      icon="student"
      tone="blue"
      title="Список студентов"
      description="Список студентов с правом на питание за выбранный период."
    >
      <template #actions>
        <button type="button" class="issue-action-button issue-action-button--primary" :disabled="loading" @click="emit('printStudents')">
          <SocialOutlineIcon name="print" />
          <span>Печать списка</span>
        </button>
        <button type="button" class="issue-action-button issue-action-button--secondary" :disabled="loading" @click="emit('downloadStudents')">
          <SocialOutlineIcon name="excel" />
          <span>Скачать Excel</span>
        </button>
      </template>
    </SocialIssueDocumentRow>

    <SocialIssueDocumentRow
      icon="document"
      tone="orange"
      title="Ведомость получения"
      description="Ведомость получения талонов студентами для подписей и фиксации факта выдачи."
    >
      <template #actions>
        <button type="button" class="issue-action-button issue-action-button--primary" :disabled="loading" @click="emit('printReceipt')">
          <SocialOutlineIcon name="print" />
          <span>Печать ведомости</span>
        </button>
      </template>
    </SocialIssueDocumentRow>

    <SocialIssueDocumentRow
      icon="document"
      tone="violet"
      title="Итоговая ведомость"
      description="Сводная ведомость по выданным талонам за выбранный период."
    >
      <template #actions>
        <button type="button" class="issue-action-button issue-action-button--primary" :disabled="loading" @click="emit('printSummary')">
          <SocialOutlineIcon name="print" />
          <span>Печать итоговой ведомости</span>
        </button>
        <button type="button" class="issue-action-button issue-action-button--secondary" :disabled="loading" @click="emit('downloadSummary')">
          <SocialOutlineIcon name="excel" />
          <span>Скачать Excel</span>
        </button>
      </template>
    </SocialIssueDocumentRow>
  </section>
</template>

<style scoped>
.issue-documents {
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #fff;
  overflow: hidden;
}

.issue-action-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 48px;
  min-width: 196px;
  padding: 0 18px;
  border-radius: 12px;
  border: 1px solid transparent;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  white-space: nowrap;
  cursor: pointer;
}

.issue-action-button:disabled {
  opacity: 0.6;
  cursor: wait;
}

.issue-action-button--primary {
  background: #16a34a;
  border-color: #16a34a;
  color: #fff;
}

.issue-action-button--primary:hover:not(:disabled) {
  background: #15803d;
  border-color: #15803d;
}

.issue-action-button--secondary {
  background: #fff;
  border-color: #dbe3ee;
  color: #0f172a;
}

.issue-action-button--secondary:hover:not(:disabled) {
  background: #f8fafc;
}

@media (max-width: 1180px) {
  .issue-action-button {
    min-width: 0;
  }
}

@media (max-width: 640px) {
  .issue-action-button {
    width: 100%;
  }
}
</style>
