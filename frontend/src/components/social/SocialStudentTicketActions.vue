<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import AppIcon from '@/components/icons/AppIcon.vue'
import type { Student, Ticket } from '@/types'

const props = defineProps<{
  student: Student
  activeTicket?: Ticket | null
  busyStudentId?: string | null
  busyTicketId?: string | null
  printingTicketId?: string | null
  canIssue?: boolean
  issueDisabledReason?: string
  disabled?: boolean
  disabledReason?: string
}>()

const emit = defineEmits<{
  issue: [student: Student]
  cancel: [ticket: Ticket]
  changeEndDate: [ticket: Ticket]
  reissue: [ticket: Ticket]
  print: [ticket: Ticket]
  toggleActive: [student: Student]
  open: [studentId: string]
}>()

const rootRef = ref<HTMLElement | null>(null)
const menuOpen = ref(false)

const primaryAction = computed(() => {
  if (props.activeTicket) {
    return {
      label: 'Открыть',
      tone: 'neutral',
      icon: 'open' as const,
      title: 'Открыть карточку и текущий талон',
    }
  }

  if (!props.student.is_active || props.disabled || props.canIssue === false) {
    return {
      label: 'Проверить',
      tone: 'warning',
      icon: 'search' as const,
      title: props.issueDisabledReason || props.disabledReason || 'Проверить ограничения по студенту',
    }
  }

  return {
    label: 'Выдать',
    tone: 'accent',
    icon: 'issue' as const,
    title: 'Выдать талон студенту',
  }
})

const hasTicketActions = computed(() => Boolean(props.activeTicket))
const primaryDisabled = computed(() => props.busyStudentId === props.student.id || props.busyTicketId === props.activeTicket?.id)
const canCancelActiveTicket = computed(() => Boolean(props.activeTicket && !props.activeTicket.is_locked && !props.disabled))

function closeMenu() {
  menuOpen.value = false
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!(event.target instanceof Node)) {
    return
  }

  if (rootRef.value?.contains(event.target)) {
    return
  }

  closeMenu()
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeMenu()
  }
}

watch(menuOpen, (nextOpen) => {
  if (typeof document === 'undefined') {
    return
  }

  if (nextOpen) {
    document.addEventListener('pointerdown', handleDocumentPointerDown)
    document.addEventListener('keydown', handleDocumentKeydown)
    return
  }

  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)
})

onBeforeUnmount(() => {
  if (typeof document === 'undefined') {
    return
  }

  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)
})

function handlePrimaryAction() {
  closeMenu()

  if (props.activeTicket) {
    emit('open', props.student.id)
    return
  }

  if (!props.student.is_active || props.disabled || props.canIssue === false) {
    emit('open', props.student.id)
    return
  }

  emit('issue', props.student)
}

function withMenuClose(callback: () => void) {
  callback()
  closeMenu()
}

function handleOpen() {
  withMenuClose(() => emit('open', props.student.id))
}

function handlePrint() {
  if (!props.activeTicket) {
    return
  }
  withMenuClose(() => emit('print', props.activeTicket!))
}

function handleReissue() {
  if (!props.activeTicket) {
    return
  }
  withMenuClose(() => emit('reissue', props.activeTicket!))
}

function handleChangeEndDate() {
  if (!props.activeTicket) {
    return
  }
  withMenuClose(() => emit('changeEndDate', props.activeTicket!))
}

function handleCancel() {
  if (!props.activeTicket) {
    return
  }
  withMenuClose(() => emit('cancel', props.activeTicket!))
}

function handleToggleStudent() {
  withMenuClose(() => emit('toggleActive', props.student))
}
</script>

<template>
  <div ref="rootRef" class="row-actions" :title="disabled ? disabledReason : undefined">
    <div class="action-group">
      <button
        type="button"
        :class="['primary-action', `primary-action--${primaryAction.tone}`]"
        :disabled="primaryDisabled"
        :title="primaryAction.title"
        @click="handlePrimaryAction"
      >
        <AppIcon :name="primaryAction.icon" />
        <span>{{ primaryAction.label }}</span>
      </button>

      <button
        type="button"
        class="secondary-trigger"
        :class="{ 'secondary-trigger--open': menuOpen }"
        aria-label="Открыть меню действий"
        :aria-expanded="menuOpen"
        @click="toggleMenu"
      >
        <AppIcon name="more" />
      </button>
    </div>

    <div v-if="menuOpen" class="secondary-menu-popup">
      <div v-if="hasTicketActions" class="menu-section">
        <p class="menu-section-title">По талону</p>
        <button
          type="button"
          class="menu-item"
          :disabled="printingTicketId === activeTicket?.id || busyTicketId === activeTicket?.id"
          @click="handlePrint"
        >
          <AppIcon name="print" />
          <span>Печать талона</span>
        </button>
        <button
          type="button"
          class="menu-item"
          :disabled="busyTicketId === activeTicket?.id || disabled"
          @click="handleReissue"
        >
          <AppIcon name="reissue" />
          <span>Перевыпустить талон</span>
        </button>
        <button
          type="button"
          class="menu-item"
          :disabled="busyTicketId === activeTicket?.id || disabled"
          @click="handleChangeEndDate"
        >
          <AppIcon name="calendar" />
          <span>Изменить срок действия</span>
        </button>
        <button
          type="button"
          class="menu-item menu-item--danger"
          :disabled="busyTicketId === activeTicket?.id || !canCancelActiveTicket"
          :title="activeTicket?.is_locked ? 'Если по талону уже есть выдачи, меняйте дату окончания вместо отмены' : undefined"
          @click="handleCancel"
        >
          <AppIcon name="cancel" />
          <span>Отменить талон</span>
        </button>
      </div>

      <div class="menu-section" :class="{ 'menu-section--separated': hasTicketActions }">
        <p class="menu-section-title">По студенту</p>
        <button type="button" class="menu-item" @click="handleOpen">
          <AppIcon name="student" />
          <span>Карточка студента</span>
        </button>
        <button
          type="button"
          class="menu-item"
          :disabled="busyStudentId === student.id || disabled"
          @click="handleToggleStudent"
        >
          <AppIcon :name="student.is_active ? 'disable' : 'plus'" />
          <span>{{ student.is_active ? 'Отключить студента' : 'Включить студента' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.row-actions {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  min-width: 0;
}

.action-group {
  display: inline-flex;
  align-items: stretch;
  min-width: 0;
}

.primary-action,
.secondary-trigger,
.menu-item {
  min-height: 32px;
  font: inherit;
}

.primary-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 84px;
  padding: 0 9px;
  border: 1px solid transparent;
  border-right-width: 0;
  border-radius: 9px 0 0 9px;
  cursor: pointer;
  justify-content: center;
  font-size: 12px;
  line-height: 16px;
  font-weight: 600;
}

.primary-action :deep(.app-icon),
.secondary-trigger :deep(.app-icon),
.menu-item :deep(.app-icon) {
  width: 20px;
  height: 20px;
}

.primary-action--accent {
  border-color: #16a34a;
  background: #16a34a;
  color: #fff;
}

.primary-action--neutral {
  border-color: #dbe3ee;
  background: #fff;
  color: #0f172a;
}

.primary-action--warning {
  border-color: #fdba74;
  background: #fff7ed;
  color: #c2410c;
}

.primary-action:disabled,
.secondary-trigger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.secondary-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  padding: 0;
  border: 1px solid #dbe3ee;
  border-radius: 0 9px 9px 0;
  background: #fff;
  color: #475569;
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease;
}

.primary-action--accent + .secondary-trigger {
  border-color: #16a34a;
  background: #15803d;
  color: #fff;
}

.primary-action--warning + .secondary-trigger {
  border-color: #fdba74;
  background: #fff7ed;
  color: #c2410c;
}

.secondary-trigger--open {
  background: #f8fafc;
}

.primary-action--accent + .secondary-trigger.secondary-trigger--open {
  background: #166534;
}

.secondary-menu-popup {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  left: auto;
  z-index: 12;
  min-width: 220px;
  max-width: min(240px, calc(100vw - 24px));
  padding: 6px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.14);
  transform-origin: top right;
}

.menu-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.menu-section--separated {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid #eef2f7;
}

.menu-section-title {
  margin: 0 0 2px;
  padding: 0 8px;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 0 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #111827;
  cursor: pointer;
  text-align: left;
  font-size: 12px;
  line-height: 16px;
}

.menu-item span {
  flex: 1 1 auto;
}

.menu-item:hover:not(:disabled) {
  background: #f8fafc;
}

.menu-item:disabled {
  color: #94a3b8;
  cursor: not-allowed;
}

.menu-item--danger {
  color: #b91c1c;
}
</style>
