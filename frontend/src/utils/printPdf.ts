export function printPdfBlob(blob: Blob): boolean {
  const objectUrl = URL.createObjectURL(blob)
  const printWindow = window.open(objectUrl, '_blank', 'width=1180,height=820')
  if (!printWindow) {
    URL.revokeObjectURL(objectUrl)
    return false
  }

  printWindow.focus()
  const print = () => {
    try {
      printWindow.print()
    } catch {
      // Browser PDF viewers may block programmatic print; opening the PDF tab is still useful.
    }
  }

  printWindow.addEventListener?.('load', print, { once: true })
  window.setTimeout(print, 500)
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  return true
}
