<script setup lang="ts">
import AdminDialogShell from '@/components/admin/AdminDialogShell.vue'
import AppIcon from '@/components/icons/AppIcon.vue'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  openAudit: []
}>()
</script>

<template>
  <AdminDialogShell
    :visible="visible"
    title="Памятка администратора"
    description="Краткие правила по рабочему корпусу, созданию данных, импорту и аудиту действий."
    @close="emit('close')"
  >
    <div class="admin-guide">
      <article class="admin-guide__card">
        <header>
          <AppIcon name="plus" />
          <strong>Создание и импорт</strong>
        </header>
        <ul>
          <li>Пользователи и студенты создаются через модальные окна, чтобы не перегружать экран.</li>
          <li>Для соцпедагогов и кассиров корпус обязателен, для администратора и бухгалтера нет.</li>
          <li>При импорте колонка “Корпус” обязательна в каждой строке Excel.</li>
        </ul>
      </article>

      <article class="admin-guide__card">
        <header>
          <AppIcon name="reports" />
          <strong>Что попадает в аудит</strong>
        </header>
        <ul>
          <li>Входы и неудачные попытки входа.</li>
          <li>Создание и изменение пользователей, студентов, категорий и календаря.</li>
          <li>Импорт студентов, печатные формы, Excel-выгрузки и изменение реквизитов документов.</li>
        </ul>
      </article>

      <div class="admin-guide__actions">
        <p-button label="Открыть полный аудит" severity="secondary" outlined @click="emit('openAudit')" />
        <p-button label="Закрыть" @click="emit('close')" />
      </div>
    </div>
  </AdminDialogShell>
</template>

<style scoped>
.admin-guide {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.admin-guide__card {
  padding: 16px 18px;
  border: 1px solid #e3eaf5;
  border-radius: 14px;
  background: #fbfdff;
}

.admin-guide__card header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  color: #07172f;
}

.admin-guide__card p,
.admin-guide__card ul {
  margin: 0;
  color: #40506a;
  line-height: 1.55;
}

.admin-guide__card ul {
  padding-left: 18px;
}

.admin-guide__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 6px;
}

@media (max-width: 720px) {
  .admin-guide__actions {
    flex-direction: column;
  }
}
</style>
