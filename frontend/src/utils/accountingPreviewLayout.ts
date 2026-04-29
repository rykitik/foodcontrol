export type AccountantPreviewScaleMode = 'fit' | 'manual'

export const MIN_ACCOUNTANT_PREVIEW_SCALE = 0.45
export const MAX_ACCOUNTANT_PREVIEW_SCALE = 3
export const ACCOUNTANT_PREVIEW_SCALE_STEP = 0.15

interface ResolveScaleOptions {
  mode: AccountantPreviewScaleMode
  manualScale: number
  containerWidthPx: number
  contentWidthPx: number
}

interface PreviewViewportLayoutOptions {
  scale: number
  contentWidthPx: number
  contentHeightPx: number
}

export interface AccountantPreviewViewportLayout {
  iframeWidthPx: number
  iframeHeightPx: number
  scaledWidthPx: number
  scaledHeightPx: number
}

export function clampAccountantPreviewScale(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) {
    return 1
  }

  return Math.min(Math.max(scale, MIN_ACCOUNTANT_PREVIEW_SCALE), MAX_ACCOUNTANT_PREVIEW_SCALE)
}

export function resolveFitAccountantPreviewScale(
  containerWidthPx: number,
  contentWidthPx: number,
): number {
  if (!Number.isFinite(containerWidthPx) || containerWidthPx <= 0) {
    return 1
  }
  if (!Number.isFinite(contentWidthPx) || contentWidthPx <= 0) {
    return 1
  }

  return clampAccountantPreviewScale(Math.min(1, containerWidthPx / contentWidthPx))
}

export function resolveAccountantPreviewScale({
  mode,
  manualScale,
  containerWidthPx,
  contentWidthPx,
}: ResolveScaleOptions): number {
  if (mode === 'fit') {
    return resolveFitAccountantPreviewScale(containerWidthPx, contentWidthPx)
  }

  return clampAccountantPreviewScale(manualScale)
}

export function buildAccountantPreviewViewportLayout({
  scale,
  contentWidthPx,
  contentHeightPx,
}: PreviewViewportLayoutOptions): AccountantPreviewViewportLayout {
  const normalizedScale = clampAccountantPreviewScale(scale)
  const iframeWidthPx = normalizePreviewDimension(contentWidthPx)
  const iframeHeightPx = normalizePreviewDimension(contentHeightPx)

  return {
    iframeWidthPx,
    iframeHeightPx,
    scaledWidthPx: Math.round(iframeWidthPx * normalizedScale),
    scaledHeightPx: Math.round(iframeHeightPx * normalizedScale),
  }
}

export function formatAccountantPreviewScale(scale: number): string {
  return `${Math.round(clampAccountantPreviewScale(scale) * 100)}%`
}

function normalizePreviewDimension(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0
  }

  return Math.max(Math.round(value), 0)
}
