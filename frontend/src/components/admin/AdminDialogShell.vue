<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import AppIcon from '@/components/icons/AppIcon.vue'

const props = withDefaults(
  defineProps<{
    visible: boolean
    title: string
    description?: string
    loading?: boolean
  }>(),
  {
    description: '',
    loading: false,
  },
)

const emit = defineEmits<{
  close: []
}>()

const dialogRef = ref<HTMLElement | null>(null)
let previousBodyOverflow = ''

function requestClose() {
  if (props.loading) {
    return
  }

  emit('close')
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.visible) {
    event.preventDefault()
    requestClose()
  }
}

function syncBodyScrollLock(visible: boolean) {
  if (typeof document === 'undefined') {
    return
  }

  if (visible) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return
  }

  document.body.style.overflow = previousBodyOverflow
}

function focusPrimaryField() {
  const primaryInput = dialogRef.value?.querySelector('input[type="text"], input:not([type])')
  if (primaryInput instanceof HTMLInputElement) {
    primaryInput.focus({ preventScroll: true })
    primaryInput.select()
  }
}

watch(
  () => props.visible,
  async (visible) => {
    syncBodyScrollLock(visible)

    if (!visible) {
      return
    }

    await nextTick()
    requestAnimationFrame(() => {
      focusPrimaryField()
    })
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('keydown', handleWindowKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWindowKeydown)
  syncBodyScrollLock(false)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="admin-dialog">
      <div v-show="visible" class="admin-dialog" @click.self="requestClose">
        <div class="admin-dialog__backdrop" />

        <section
          ref="dialogRef"
          class="admin-dialog__panel"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
        >
          <header class="admin-dialog__header">
            <div class="admin-dialog__copy">
              <h2>{{ title }}</h2>
              <p v-if="description">{{ description }}</p>
            </div>

            <button
              type="button"
              class="admin-dialog__close"
              aria-label="Закрыть окно"
              :disabled="loading"
              @click="requestClose"
            >
              <AppIcon name="cancel" />
            </button>
          </header>

          <div class="admin-dialog__body">
            <slot />
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.admin-dialog {
  position: fixed;
  inset: 0;
  z-index: 1250;
  display: grid;
  place-items: center;
  padding: 24px;
}

.admin-dialog__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.28);
}

.admin-dialog__panel {
  position: relative;
  z-index: 1;
  width: min(760px, calc(100vw - 48px));
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  border: 1px solid #dbe3ee;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.18);
  overflow: hidden;
}

.admin-dialog__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 24px 18px;
  border-bottom: 1px solid #edf1f5;
}

.admin-dialog__copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.admin-dialog__copy h2,
.admin-dialog__copy p {
  margin: 0;
}

.admin-dialog__copy h2 {
  color: #0f172a;
  font-size: 20px;
  line-height: 28px;
}

.admin-dialog__copy p {
  color: #64748b;
  font-size: 14px;
  line-height: 20px;
}

.admin-dialog__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
}

.admin-dialog__close:disabled {
  opacity: 0.6;
  cursor: default;
}

.admin-dialog__close:not(:disabled):hover {
  background: #f8fafc;
  color: #0f172a;
}

.admin-dialog__body {
  padding: 22px 24px 24px;
  overflow: auto;
}

.admin-dialog-enter-active,
.admin-dialog-leave-active {
  transition: opacity 0.18s ease;
}

.admin-dialog-enter-active .admin-dialog__panel,
.admin-dialog-leave-active .admin-dialog__panel {
  transition:
    transform 0.18s ease,
    opacity 0.18s ease;
}

.admin-dialog-enter-from,
.admin-dialog-leave-to {
  opacity: 0;
}

.admin-dialog-enter-from .admin-dialog__panel,
.admin-dialog-leave-to .admin-dialog__panel {
  opacity: 0;
  transform: translateY(12px) scale(0.985);
}

@media (max-width: 720px) {
  .admin-dialog {
    padding: 12px;
  }

  .admin-dialog__panel {
    width: 100%;
    max-height: calc(100vh - 24px);
    border-radius: 18px;
  }

  .admin-dialog__header {
    padding: 18px 18px 14px;
  }

  .admin-dialog__body {
    padding: 18px;
  }
}
</style>
