import { describe, expect, it } from 'vitest'

import {
  captureAccountantPreviewAnchor,
  resolveAccountantPreviewScroll,
} from '@/utils/accountingPreviewViewport'

describe('accountingPreviewViewport', () => {
  it('captures the visible center in document coordinates', () => {
    const anchor = captureAccountantPreviewAnchor({
      scrollLeft: 360,
      scrollTop: 180,
      clientWidth: 800,
      clientHeight: 600,
      scale: 1.2,
    })

    expect(anchor).toEqual({
      contentXPx: 633.3333333333334,
      contentYPx: 400,
      viewportXPx: 400,
      viewportYPx: 300,
    })
  })

  it('restores viewport scroll around the same content center after zoom changes', () => {
    const nextScroll = resolveAccountantPreviewScroll({
      anchor: {
        contentXPx: 633.3333333333334,
        contentYPx: 400,
        viewportXPx: 400,
        viewportYPx: 300,
      },
      clientWidth: 800,
      clientHeight: 600,
      scale: 1.8,
    })

    expect(nextScroll.scrollLeft).toBeCloseTo(740, 5)
    expect(nextScroll.scrollTop).toBeCloseTo(420, 5)
  })
})
