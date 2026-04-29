import { computed, nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue'

import type { PrintableDocument } from '@/types'
import {
  ACCOUNTANT_PREVIEW_SCALE_STEP,
  buildAccountantPreviewViewportLayout,
  clampAccountantPreviewScale,
  formatAccountantPreviewScale,
  resolveAccountantPreviewScale,
  type AccountantPreviewScaleMode,
} from '@/utils/accountingPreviewLayout'
import {
  captureAccountantPreviewAnchor,
  resolveAccountantPreviewScroll,
} from '@/utils/accountingPreviewViewport'

export function useAccountantPreviewFrame(preview: Ref<PrintableDocument | null>) {
  const viewportRef = ref<HTMLDivElement | null>(null)
  const frameRef = ref<HTMLIFrameElement | null>(null)
  const scaleMode = ref<AccountantPreviewScaleMode>('fit')
  const manualScale = ref(1)
  const viewportWidthPx = ref(0)
  const contentWidthPx = ref(0)
  const contentHeightPx = ref(0)
  const frameMeasured = ref(false)
  const isPanning = ref(false)

  let resizeObserver: ResizeObserver | null = null
  let activePointerId: number | null = null
  let panStartX = 0
  let panStartY = 0
  let panStartScrollLeft = 0
  let panStartScrollTop = 0

  const previewScale = computed(() =>
    resolveAccountantPreviewScale({
      mode: scaleMode.value,
      manualScale: manualScale.value,
      containerWidthPx: viewportWidthPx.value,
      contentWidthPx: contentWidthPx.value,
    }),
  )
  const previewScaleLabel = computed(() =>
    scaleMode.value === 'fit'
      ? `По ширине · ${formatAccountantPreviewScale(previewScale.value)}`
      : formatAccountantPreviewScale(previewScale.value),
  )
  const viewportLayout = computed(() =>
    buildAccountantPreviewViewportLayout({
      scale: previewScale.value,
      contentWidthPx: contentWidthPx.value,
      contentHeightPx: contentHeightPx.value,
    }),
  )
  const viewportCanvasStyle = computed(() => {
    if (!frameMeasured.value) {
      return undefined
    }

    return {
      width: `${viewportLayout.value.scaledWidthPx}px`,
      height: `${viewportLayout.value.scaledHeightPx}px`,
      minWidth: '100%',
      marginLeft: '0',
      marginRight: '0',
    }
  })
  const previewFrameStyle = computed(() => {
    if (!frameMeasured.value) {
      return undefined
    }

    return {
      width: `${viewportLayout.value.iframeWidthPx}px`,
      height: `${viewportLayout.value.iframeHeightPx}px`,
      transform: `scale(${previewScale.value})`,
      transformOrigin: 'top left',
    }
  })
  const canZoomOut = computed(() => clampAccountantPreviewScale(previewScale.value - ACCOUNTANT_PREVIEW_SCALE_STEP) < previewScale.value)
  const canZoomIn = computed(() => clampAccountantPreviewScale(previewScale.value + ACCOUNTANT_PREVIEW_SCALE_STEP) > previewScale.value)

  function setFitMode() {
    void updateScale('fit', manualScale.value)
  }

  function setActualSize() {
    void updateScale('manual', 1)
  }

  function zoomIn() {
    void updateScale('manual', clampAccountantPreviewScale(previewScale.value + ACCOUNTANT_PREVIEW_SCALE_STEP))
  }

  function zoomOut() {
    void updateScale('manual', clampAccountantPreviewScale(previewScale.value - ACCOUNTANT_PREVIEW_SCALE_STEP))
  }

  function handleFrameLoad() {
    void measureFrameAfterLoad()
  }

  function focusViewport() {
    viewportRef.value?.focus({ preventScroll: true })
  }

  function handleViewportPointerDown(event: PointerEvent) {
    if (!preview.value || event.button !== 0) {
      focusViewport()
      return
    }

    const viewport = viewportRef.value
    if (!viewport) {
      return
    }

    focusViewport()
    activePointerId = event.pointerId
    panStartX = event.clientX
    panStartY = event.clientY
    panStartScrollLeft = viewport.scrollLeft
    panStartScrollTop = viewport.scrollTop
    isPanning.value = true
    viewport.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  function handleViewportPointerMove(event: PointerEvent) {
    const viewport = viewportRef.value
    if (!viewport || !isPanning.value || activePointerId !== event.pointerId) {
      return
    }

    viewport.scrollLeft = panStartScrollLeft - (event.clientX - panStartX)
    viewport.scrollTop = panStartScrollTop - (event.clientY - panStartY)
    event.preventDefault()
  }

  function handleViewportPointerEnd(event: PointerEvent) {
    const viewport = viewportRef.value
    if (activePointerId !== event.pointerId) {
      return
    }

    if (viewport?.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId)
    }
    activePointerId = null
    isPanning.value = false
  }

  function measureFrame() {
    const frame = frameRef.value
    const doc = frame?.contentDocument
    if (!frame || !doc) {
      frameMeasured.value = false
      return
    }

    refreshViewportWidth()
    normalizePreviewDocument(doc)

    const worksheet = doc.querySelector<HTMLElement>('.accounting-worksheet')
    const measurementTarget = worksheet ?? doc.body
    const targetRect = measurementTarget.getBoundingClientRect()

    contentWidthPx.value = Math.max(
      Math.ceil(targetRect.width),
      Math.ceil(measurementTarget.scrollWidth),
      Math.ceil(doc.documentElement.scrollWidth),
    )
    contentHeightPx.value = Math.max(
      Math.ceil(targetRect.height),
      Math.ceil(measurementTarget.scrollHeight),
      Math.ceil(doc.body.scrollHeight),
      Math.ceil(doc.documentElement.scrollHeight),
    )
    frameMeasured.value = contentWidthPx.value > 0 && contentHeightPx.value > 0
  }

  async function measureFrameAfterLoad() {
    measureFrame()
    await waitForFrameFonts(frameRef.value?.contentDocument ?? null)
    measureFrame()
  }

  function refreshViewportWidth() {
    viewportWidthPx.value = Math.max(viewportRef.value?.clientWidth ?? 0, 0)
  }

  function setupResizeObserver() {
    teardownResizeObserver()

    if (!viewportRef.value) {
      return
    }

    resizeObserver = new ResizeObserver(() => {
      refreshViewportWidth()
    })
    resizeObserver.observe(viewportRef.value)
    refreshViewportWidth()
  }

  function teardownResizeObserver() {
    resizeObserver?.disconnect()
    resizeObserver = null
  }

  watch(viewportRef, () => {
    setupResizeObserver()
  })

  watch(preview, (nextPreview) => {
    if (!nextPreview) {
      contentWidthPx.value = 0
      contentHeightPx.value = 0
      frameMeasured.value = false
      return
    }

    frameMeasured.value = false
  })

  onBeforeUnmount(() => {
    teardownResizeObserver()
  })

  async function updateScale(
    nextMode: AccountantPreviewScaleMode,
    nextManualScale: number,
    anchorViewportXPx?: number,
    anchorViewportYPx?: number,
  ) {
    const viewport = viewportRef.value
    const anchor = viewport
      ? captureAccountantPreviewAnchor({
          scrollLeft: viewport.scrollLeft,
          scrollTop: viewport.scrollTop,
          clientWidth: viewport.clientWidth,
          clientHeight: viewport.clientHeight,
          scale: previewScale.value,
          viewportXPx: anchorViewportXPx,
          viewportYPx: anchorViewportYPx,
        })
      : null

    scaleMode.value = nextMode
    manualScale.value = clampAccountantPreviewScale(nextManualScale)

    if (!anchor || !viewport) {
      return
    }

    await nextTick()

    const nextScroll = resolveAccountantPreviewScroll({
      anchor,
      clientWidth: viewport.clientWidth,
      clientHeight: viewport.clientHeight,
      scale: previewScale.value,
    })
    viewport.scrollLeft = nextScroll.scrollLeft
    viewport.scrollTop = nextScroll.scrollTop
  }

  function handleViewportWheel(event: WheelEvent) {
    if (!preview.value || !(event.ctrlKey || event.metaKey)) {
      return
    }

    event.preventDefault()
    focusViewport()

    const viewport = viewportRef.value
    if (!viewport) {
      return
    }

    const nextScale = clampAccountantPreviewScale(
      previewScale.value + (event.deltaY < 0 ? ACCOUNTANT_PREVIEW_SCALE_STEP : -ACCOUNTANT_PREVIEW_SCALE_STEP),
    )
    if (nextScale === previewScale.value) {
      return
    }

    const rect = viewport.getBoundingClientRect()
    void updateScale(
      'manual',
      nextScale,
      event.clientX - rect.left,
      event.clientY - rect.top,
    )
  }

  function handleViewportKeydown(event: KeyboardEvent) {
    if (!preview.value || event.defaultPrevented || event.altKey) {
      return
    }

    const hasShortcutModifier = event.ctrlKey || event.metaKey
    const key = event.key

    if (key === '0' || key === ')') {
      event.preventDefault()
      setFitMode()
      return
    }

    if (key === '1' || key === '!') {
      event.preventDefault()
      setActualSize()
      return
    }

    if (key === '+' || key === '=' || key === 'Add') {
      if (hasShortcutModifier || !event.shiftKey || key === '+') {
        event.preventDefault()
        zoomIn()
      }
      return
    }

    if (key === '-' || key === '_' || key === 'Subtract') {
      event.preventDefault()
      zoomOut()
    }
  }

  return {
    viewportRef,
    frameRef,
    frameMeasured,
    isPanning,
    previewScaleLabel,
    viewportCanvasStyle,
    previewFrameStyle,
    isFitMode: computed(() => scaleMode.value === 'fit'),
    canZoomIn,
    canZoomOut,
    setFitMode,
    setActualSize,
    zoomIn,
    zoomOut,
    handleFrameLoad,
    focusViewport,
    handleViewportPointerDown,
    handleViewportPointerMove,
    handleViewportPointerEnd,
    handleViewportWheel,
    handleViewportKeydown,
  }
}

function normalizePreviewDocument(doc: Document) {
  doc.documentElement.style.overflow = 'hidden'
  doc.body.style.overflow = 'hidden'
  doc.body.style.background = '#ffffff'
}

async function waitForFrameFonts(doc: Document | null): Promise<void> {
  const fontSet = doc && 'fonts' in doc ? (doc.fonts as FontFaceSet) : null
  if (!fontSet) {
    return
  }

  try {
    await fontSet.ready
  } catch {
    // Ignore font loading failures and keep the preview measurable with available fallbacks.
  }
}
