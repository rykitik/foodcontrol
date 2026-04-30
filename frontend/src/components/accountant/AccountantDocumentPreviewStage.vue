<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, toRef, watch } from 'vue'

import AppIcon from '@/components/icons/AppIcon.vue'
import { useAccountantPreviewFrame } from '@/composables/useAccountantPreviewFrame'
import type { PrintableDocument } from '@/types'
import { buildPrintableHtml } from '@/utils/printDocument'

const props = withDefaults(
  defineProps<{
    documentTitle: string
    preview: PrintableDocument | null
    loading?: boolean
    metadataStatus?: string
    frameKey?: string | null
    presentation?: 'embedded' | 'fullscreen'
    expandable?: boolean
    isFullscreen?: boolean
  }>(),
  {
    presentation: 'embedded',
    expandable: false,
    isFullscreen: false,
  },
)

const emit = defineEmits<{
  openFullscreen: []
  closeFullscreen: []
}>()

const previewHtml = computed(() => (props.preview ? buildPrintableHtml(props.preview) : ''))
const compactMetadataStatus = computed(() => {
  if (!props.metadataStatus) {
    return ''
  }

  const normalizedStatus = props.metadataStatus.toLocaleLowerCase('ru-RU')
  if (normalizedStatus.includes('систем')) {
    return 'Реквизиты: системные'
  }
  if (normalizedStatus.includes('общ') || normalizedStatus.includes('сохран')) {
    return 'Реквизиты: общие'
  }

  return props.metadataStatus
})
const previewStatusLabel = computed(() => {
  if (props.loading) {
    return 'Обновляется'
  }

  if (props.preview) {
    return 'Готово к печати'
  }

  return 'Ожидает выбор формы'
})
const fullscreenButtonLabel = 'Открыть полноэкранный просмотр'
const closeFullscreenButtonLabel = 'Закрыть полноэкранный просмотр'

const {
  viewportRef,
  frameRef,
  frameMeasured,
  isPanning,
  previewScaleLabel,
  viewportCanvasStyle,
  previewFrameStyle,
  isFitMode,
  canZoomIn,
  canZoomOut,
  setFitMode,
  setActualSize,
  zoomIn,
  zoomOut,
  handleFrameLoad,
  handleViewportPointerDown,
  handleViewportPointerMove,
  handleViewportPointerEnd,
  handleViewportWheel,
  handleViewportKeydown,
} = useAccountantPreviewFrame(toRef(props, 'preview'))

let previousBodyOverflow = ''

function requestCloseFullscreen() {
  emit('closeFullscreen')
}

function syncBodyScrollLock(active: boolean) {
  if (typeof document === 'undefined') {
    return
  }

  if (active) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return
  }

  document.body.style.overflow = previousBodyOverflow
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !props.isFullscreen) {
    return
  }

  event.preventDefault()
  requestCloseFullscreen()
}

watch(
  () => props.isFullscreen,
  (active) => {
    syncBodyScrollLock(active)
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
  <Teleport to="body" :disabled="!isFullscreen">
    <section
      :class="[
        'accountant-preview-stage',
        { 'accountant-preview-stage--fullscreen': presentation === 'fullscreen' || isFullscreen },
      ]"
      data-testid="accountant-preview-stage"
      @click.self="isFullscreen ? requestCloseFullscreen() : undefined"
    >
      <div v-if="isFullscreen" class="accountant-preview-stage__backdrop" />

      <div class="accountant-preview-stage__surface">
        <div class="accountant-preview-stage__toolbar" data-testid="accountant-preview-toolbar">
          <div class="accountant-preview-stage__copy">
            <span>Лист документа</span>
            <strong>{{ documentTitle }}</strong>
          </div>

          <div class="accountant-preview-stage__toolbar-side">
            <div v-if="preview" class="accountant-preview-stage__zoom-controls">
              <p-button
                label="По ширине"
                size="small"
                severity="secondary"
                :outlined="!isFitMode"
                data-testid="accountant-preview-fit-width"
                @click="setFitMode"
              />
              <p-button
                label="100%"
                size="small"
                severity="secondary"
                :outlined="isFitMode"
                data-testid="accountant-preview-actual-size"
                @click="setActualSize"
              />
              <p-button
                class="accountant-preview-stage__icon-button"
                text
                rounded
                :disabled="!canZoomOut"
                data-testid="accountant-preview-zoom-out"
                @click="zoomOut"
              >
                <template #icon>
                  <AppIcon name="searchMinus" />
                </template>
              </p-button>
              <span class="accountant-preview-stage__zoom-badge">{{ previewScaleLabel }}</span>
              <p-button
                class="accountant-preview-stage__icon-button"
                text
                rounded
                :disabled="!canZoomIn"
                data-testid="accountant-preview-zoom-in"
                @click="zoomIn"
              >
                <template #icon>
                  <AppIcon name="searchPlus" />
                </template>
              </p-button>
            </div>

            <div class="accountant-preview-stage__badges">
              <p-tag v-if="compactMetadataStatus" :value="compactMetadataStatus" severity="contrast" />
              <p-tag :value="previewStatusLabel" severity="secondary" />
              <p-button
                v-if="expandable && preview && !isFullscreen"
                class="accountant-preview-stage__icon-button"
                text
                rounded
                data-testid="accountant-preview-open-fullscreen"
                :aria-label="fullscreenButtonLabel"
                @click="emit('openFullscreen')"
              >
                <template #icon>
                  <AppIcon name="open" />
                </template>
              </p-button>
              <button
                v-if="isFullscreen"
                type="button"
                class="accountant-preview-stage__close-button"
                :aria-label="closeFullscreenButtonLabel"
                @click="requestCloseFullscreen"
              >
                <AppIcon name="cancel" />
              </button>
            </div>
          </div>
        </div>

        <div v-if="loading" class="accountant-preview-stage__empty accountant-preview-stage__empty--loading">
          <span class="accountant-preview-stage__spinner" aria-hidden="true"></span>
          <span>Предпросмотр обновляется...</span>
        </div>

        <div v-else-if="preview" class="accountant-preview-stage__frame-shell" data-testid="accountant-preview-frame-shell">
          <div
            ref="viewportRef"
            :class="[
              'accountant-preview-stage__frame-viewport',
              { 'accountant-preview-stage__frame-viewport--panning': isPanning },
            ]"
            data-testid="accountant-preview-viewport"
            tabindex="0"
            @pointerdown="handleViewportPointerDown"
            @pointermove="handleViewportPointerMove"
            @pointerup="handleViewportPointerEnd"
            @pointercancel="handleViewportPointerEnd"
            @lostpointercapture="handleViewportPointerEnd"
            @keydown="handleViewportKeydown"
            @wheel="handleViewportWheel"
          >
            <div class="accountant-preview-stage__frame-canvas" :style="viewportCanvasStyle">
              <iframe
                :key="frameKey ?? documentTitle"
                ref="frameRef"
                class="accountant-preview-stage__frame"
                :style="previewFrameStyle"
                :srcdoc="previewHtml"
                :title="preview.title"
                data-testid="accountant-preview-frame"
                scrolling="no"
                @load="handleFrameLoad"
              />
            </div>
          </div>

          <div v-if="!frameMeasured" class="accountant-preview-stage__frame-overlay" data-testid="accountant-preview-overlay">
            <span class="accountant-preview-stage__spinner" aria-hidden="true"></span>
            <span>Подгоняем лист под область просмотра...</span>
          </div>
        </div>

        <div v-else class="accountant-preview-stage__empty">
          <AppIcon name="document" />
          <div>
            <strong>Выберите форму слева в списке</strong>
            <p>После выбора здесь откроется актуальный документ с текущими фильтрами и реквизитами.</p>
          </div>
        </div>
      </div>
    </section>
  </Teleport>
</template>

<style scoped>
.accountant-preview-stage {
  display: grid;
  gap: 14px;
  min-width: 0;
}

.accountant-preview-stage__surface {
  display: grid;
  gap: 14px;
  min-width: 0;
}

.accountant-preview-stage__toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  padding: 14px 16px;
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(15, 23, 42, 0.04);
  min-width: 0;
}

.accountant-preview-stage__copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.accountant-preview-stage__copy span {
  color: var(--muted);
  font-size: 0.88rem;
}

.accountant-preview-stage__copy strong {
  color: var(--text);
}

.accountant-preview-stage__toolbar-side {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 12px;
  justify-content: flex-end;
  align-items: center;
  min-width: 0;
  max-width: none;
}

.accountant-preview-stage__zoom-controls,
.accountant-preview-stage__badges {
  display: inline-flex;
  flex-wrap: nowrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-start;
  min-width: 0;
  max-width: 100%;
  flex-shrink: 0;
}

.accountant-preview-stage__zoom-badge {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  color: var(--text);
  font-size: 0.92rem;
  font-weight: 700;
  white-space: nowrap;
}

.accountant-preview-stage__icon-button {
  width: 44px;
  height: 44px;
}

.accountant-preview-stage__icon-button :deep(.app-icon) {
  width: 18px;
  height: 18px;
}

.accountant-preview-stage__frame-shell {
  position: relative;
  min-width: 0;
  padding: 14px;
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background:
    linear-gradient(180deg, rgba(226, 232, 240, 0.48), rgba(248, 250, 252, 0.78)),
    radial-gradient(circle at top, rgba(255, 255, 255, 0.75), transparent 55%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
  overflow: hidden;
}

.accountant-preview-stage__frame-viewport {
  inline-size: 100%;
  min-width: 0;
  max-width: 100%;
  overflow: auto;
  border-radius: 18px;
  overscroll-behavior: contain;
  scrollbar-gutter: stable both-edges;
  box-sizing: border-box;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.accountant-preview-stage__frame-viewport:focus-visible {
  outline: 2px solid rgba(15, 118, 110, 0.28);
  outline-offset: 2px;
}

.accountant-preview-stage__frame-viewport--panning {
  cursor: grabbing;
}

.accountant-preview-stage__frame-canvas {
  position: relative;
  min-height: clamp(780px, 74vh, 1200px);
  min-width: 100%;
  box-sizing: border-box;
}

.accountant-preview-stage__frame {
  display: block;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 24px 48px rgba(148, 163, 184, 0.16);
  pointer-events: none;
}

.accountant-preview-stage__badges :deep(.p-tag) {
  max-width: min(18rem, 36vw);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}

.accountant-preview-stage__frame-overlay {
  position: absolute;
  inset: 14px;
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.82);
  color: var(--muted);
}

.accountant-preview-stage__empty {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 24px;
  border-radius: 24px;
  border: 1px dashed rgba(148, 163, 184, 0.3);
  background: rgba(248, 250, 252, 0.78);
  color: var(--muted);
}

.accountant-preview-stage__empty strong {
  color: var(--text);
}

.accountant-preview-stage__empty p {
  margin: 0;
  line-height: 1.55;
}

.accountant-preview-stage__empty :deep(.app-icon) {
  margin-top: 3px;
  color: #0f766e;
}

.accountant-preview-stage__spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(15, 118, 110, 0.18);
  border-top-color: #0f766e;
  border-radius: 999px;
  animation: accountant-spinner 0.8s linear infinite;
}

.accountant-preview-stage__empty--loading {
  align-items: center;
}

.accountant-preview-stage--fullscreen {
  position: fixed;
  inset: 0;
  z-index: 1400;
  display: grid;
  padding: 16px;
  min-height: 0;
  height: 100%;
}

.accountant-preview-stage__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.52);
}

.accountant-preview-stage--fullscreen .accountant-preview-stage__surface {
  position: relative;
  z-index: 1;
  min-height: 0;
  height: 100%;
  padding: 14px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 24px;
  background: rgba(248, 250, 252, 0.98);
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.24);
}

.accountant-preview-stage--fullscreen .accountant-preview-stage__toolbar {
  padding: 16px 18px;
  border-radius: 22px;
}

.accountant-preview-stage--fullscreen .accountant-preview-stage__frame-shell {
  display: grid;
  min-height: 0;
  height: 100%;
  padding: 16px;
  border-radius: 26px;
}

.accountant-preview-stage--fullscreen .accountant-preview-stage__frame-viewport {
  min-height: min(78vh, 960px);
  height: 100%;
  border-radius: 20px;
}

.accountant-preview-stage--fullscreen .accountant-preview-stage__frame-canvas {
  min-height: min(92vh, 1260px);
}

.accountant-preview-stage__close-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  border: 0;
  border-radius: 14px;
  background: rgba(148, 163, 184, 0.16);
  color: var(--muted);
  cursor: pointer;
}

.accountant-preview-stage__close-button :deep(.app-icon) {
  width: 18px;
  height: 18px;
}

@keyframes accountant-spinner {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 980px) {
  .accountant-preview-stage__toolbar {
    grid-template-columns: 1fr;
  }

  .accountant-preview-stage__toolbar-side {
    justify-content: flex-start;
    max-width: 100%;
  }

  .accountant-preview-stage__zoom-controls,
  .accountant-preview-stage__badges {
    justify-content: flex-start;
    flex-wrap: wrap;
    flex-shrink: 1;
  }
}

@media (max-width: 720px) {
  .accountant-preview-stage__frame-canvas {
    min-height: 680px;
  }

  .accountant-preview-stage--fullscreen {
    padding: 10px;
  }

  .accountant-preview-stage--fullscreen .accountant-preview-stage__surface {
    padding: 10px;
    border-radius: 20px;
  }
}
</style>
