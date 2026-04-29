import { describe, expect, it } from 'vitest'

import {
  ACCOUNTANT_PREVIEW_SCALE_STEP,
  buildAccountantPreviewViewportLayout,
  clampAccountantPreviewScale,
  formatAccountantPreviewScale,
  resolveAccountantPreviewScale,
  resolveFitAccountantPreviewScale,
} from '@/utils/accountingPreviewLayout'

describe('accountingPreviewLayout', () => {
  it('fits oversized previews into the available viewport width', () => {
    const fitScale = resolveFitAccountantPreviewScale(960, 2400)

    expect(fitScale).toBeCloseTo(0.45, 2)
    expect(
      resolveAccountantPreviewScale({
        mode: 'fit',
        manualScale: 1.2,
        containerWidthPx: 960,
        contentWidthPx: 2400,
      }),
    ).toBeCloseTo(fitScale, 4)
  })

  it('keeps manual zoom independent from fit mode and clamps it', () => {
    expect(
      resolveAccountantPreviewScale({
        mode: 'manual',
        manualScale: 1 + ACCOUNTANT_PREVIEW_SCALE_STEP,
        containerWidthPx: 960,
        contentWidthPx: 2400,
      }),
    ).toBeCloseTo(1.15, 4)
    expect(clampAccountantPreviewScale(4)).toBe(3)
    expect(clampAccountantPreviewScale(0.1)).toBe(0.45)
  })

  it('builds scaled iframe and canvas dimensions from natural document size', () => {
    const layout = buildAccountantPreviewViewportLayout({
      scale: 0.75,
      contentWidthPx: 2000,
      contentHeightPx: 1200,
    })

    expect(layout).toEqual({
      iframeWidthPx: 2000,
      iframeHeightPx: 1200,
      scaledWidthPx: 1500,
      scaledHeightPx: 900,
    })
    expect(formatAccountantPreviewScale(0.751)).toBe('75%')
  })
})
