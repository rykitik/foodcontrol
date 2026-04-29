<script setup lang="ts">
import { ref } from 'vue'

import AdminGuideModal from '@/components/admin/AdminGuideModal.vue'
import AppIcon from '@/components/icons/AppIcon.vue'

defineProps<{
  previewLabel: string
  previewActive: boolean
  auditActionsToday: number
}>()

const emit = defineEmits<{
  openAudit: []
}>()

const showGuide = ref(false)
</script>

<template>
  <section class="admin-help-panel">
    <div class="admin-help-panel__copy">
      <div>
        <span class="admin-help-panel__eyebrow">Памятка администратора</span>
        <h2>Операционная памятка</h2>
        <p>Короткие подсказки по импорту, режиму просмотра и контролю изменений в системе.</p>
      </div>

      <div class="admin-help-panel__facts">
        <article class="admin-help-fact">
          <AppIcon name="excel" />
          <div>
            <strong>Импорт студентов</strong>
            <span>Корпус обязателен в каждой строке файла</span>
          </div>
        </article>
        <article class="admin-help-fact">
          <AppIcon name="eye" />
          <div>
            <strong>Текущий режим</strong>
            <span>{{ previewActive ? previewLabel : 'Режим администратора' }}</span>
          </div>
        </article>
        <article class="admin-help-fact">
          <AppIcon name="reports" />
          <div>
            <strong>Событий за сегодня</strong>
            <span>{{ auditActionsToday }}</span>
          </div>
        </article>
      </div>
    </div>

    <div class="admin-help-panel__actions">
      <p-button label="Памятка" severity="secondary" outlined @click="showGuide = true">
        <template #icon>
          <AppIcon name="document" />
        </template>
      </p-button>
      <p-button label="Открыть аудит" severity="secondary" outlined @click="emit('openAudit')">
        <template #icon>
          <AppIcon name="reports" />
        </template>
      </p-button>
    </div>

    <AdminGuideModal
      :visible="showGuide"
      @close="showGuide = false"
      @open-audit="
        () => {
          showGuide = false
          emit('openAudit')
        }
      "
    />
  </section>
</template>

<style scoped>
.admin-help-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 24px;
  border: 1px solid #dce5f1;
  border-radius: 14px;
  background: #f1f7ff;
}

.admin-help-panel__copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.admin-help-panel__eyebrow {
  color: #5c6a82;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.admin-help-panel h2,
.admin-help-panel p {
  margin: 0;
}

.admin-help-panel h2 {
  margin-top: 6px;
  color: #07172f;
  font-size: 22px;
}

.admin-help-panel p {
  margin-top: 8px;
  color: #56657d;
}

.admin-help-panel__facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.admin-help-fact {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid #dce5f1;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.86);
  color: #40506a;
}

.admin-help-fact strong,
.admin-help-fact span {
  display: block;
}

.admin-help-fact strong {
  color: #07172f;
  font-size: 14px;
}

.admin-help-fact span {
  margin-top: 4px;
  font-size: 13px;
}

.admin-help-panel__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

@media (max-width: 1100px) {
  .admin-help-panel,
  .admin-help-panel__facts {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: stretch;
  }

  .admin-help-panel__actions {
    flex-direction: row;
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}

@media (max-width: 720px) {
  .admin-help-panel__facts,
  .admin-help-panel__actions {
    grid-template-columns: 1fr;
    flex-direction: column;
  }
}
</style>
