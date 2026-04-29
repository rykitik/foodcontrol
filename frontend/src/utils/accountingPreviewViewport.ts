import { clampAccountantPreviewScale } from '@/utils/accountingPreviewLayout'

export interface AccountantPreviewAnchor {
  contentXPx: number
  contentYPx: number
  viewportXPx: number
  viewportYPx: number
}

interface CaptureAccountantPreviewAnchorOptions {
  scrollLeft: number
  scrollTop: number
  clientWidth: number
  clientHeight: number
  scale: number
  viewportXPx?: number
  viewportYPx?: number
}

interface ResolveAccountantPreviewScrollOptions {
  anchor: AccountantPreviewAnchor
  clientWidth: number
  clientHeight: number
  scale: number
}

export function captureAccountantPreviewAnchor({
  scrollLeft,
  scrollTop,
  clientWidth,
  clientHeight,
  scale,
  viewportXPx,
  viewportYPx,
}: CaptureAccountantPreviewAnchorOptions): AccountantPreviewAnchor | null {
  if (clientWidth <= 0 || clientHeight <= 0) {
    return null
  }

  const normalizedScale = clampAccountantPreviewScale(scale)
  const anchorViewportXPx = normalizeViewportCoordinate(viewportXPx, clientWidth)
  const anchorViewportYPx = normalizeViewportCoordinate(viewportYPx, clientHeight)

  return {
    contentXPx: (Math.max(scrollLeft, 0) + anchorViewportXPx) / normalizedScale,
    contentYPx: (Math.max(scrollTop, 0) + anchorViewportYPx) / normalizedScale,
    viewportXPx: anchorViewportXPx,
    viewportYPx: anchorViewportYPx,
  }
}

export function resolveAccountantPreviewScroll({
  anchor,
  clientWidth,
  clientHeight,
  scale,
}: ResolveAccountantPreviewScrollOptions): { scrollLeft: number; scrollTop: number } {
  const normalizedScale = clampAccountantPreviewScale(scale)

  return {
    scrollLeft: Math.max(anchor.contentXPx * normalizedScale - anchor.viewportXPx, 0),
    scrollTop: Math.max(anchor.contentYPx * normalizedScale - anchor.viewportYPx, 0),
  }
}

function normalizeViewportCoordinate(value: number | undefined, dimension: number): number {
  if (!Number.isFinite(value)) {
    return dimension / 2
  }

  return Math.min(Math.max(value ?? 0, 0), dimension)
}
