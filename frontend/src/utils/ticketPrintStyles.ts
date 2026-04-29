export const TICKET_PRINT_STYLES = `
  .ticket-sheet-print {
    width: 210mm;
    min-height: 297mm;
    margin: 0;
    padding: 6mm 8mm;
    box-sizing: border-box;
    color: #111111;
    background: #ffffff;
  }

  .ticket-sheet-print .report-page {
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 0;
  }

  .ticket-sheet-page {
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  .ticket-sheet-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12mm;
    margin: 0 0 2.2mm;
    padding: 0 1.8mm 2.6mm;
    border-bottom: 0.32mm solid #111111;
  }

  .ticket-sheet-title {
    margin: 0;
    color: #111111;
    font-size: 22px;
    font-weight: 800;
    line-height: 1.05;
    letter-spacing: -0.02em;
  }

  .ticket-sheet-period {
    margin: 0.6mm 0 0;
    color: #222222;
    font-size: 15px;
    font-weight: 400;
    line-height: 1.1;
  }

  .ticket-sheet-stats {
    display: grid;
    gap: 0.7mm;
    color: #111111;
    font-size: 15px;
    font-weight: 500;
    line-height: 1.1;
    text-align: right;
    white-space: nowrap;
  }

  .ticket-print-grid {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    border-spacing: 0;
    border: 0;
  }

  .ticket-print-row {
    height: 30mm;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .ticket-print-cell {
    width: 50%;
    padding: 0;
    border: 0;
    border-bottom: 0.2mm dashed #b8b8b8;
    vertical-align: top;
  }

  .ticket-print-cell:first-child {
    border-right: 0.2mm dashed #b8b8b8;
  }

  .ticket-print-row:last-child .ticket-print-cell {
    border-bottom: 0;
  }

  .ticket-print-card {
    display: block;
    height: 30mm;
    margin: 0;
    padding: 1.9mm 5.1mm 2.8mm;
    overflow: hidden;
    color: #111111;
    background: #ffffff;
    border: 0;
    box-sizing: border-box;
    break-inside: avoid;
    page-break-inside: avoid;
    -webkit-column-break-inside: avoid;
  }

  .ticket-print-card--large {
    height: 30mm;
    padding: 1.9mm 5.1mm 2.8mm;
  }

  .ticket-print-card-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 3mm;
    align-items: start;
    min-width: 0;
    margin-bottom: 0.75mm;
  }

  .ticket-print-card-head > div {
    min-width: 0;
  }

  .ticket-print-card-title {
    min-width: 0;
    color: #111111;
    font-size: 18.5px;
    font-weight: 800;
    line-height: 0.98;
    letter-spacing: -0.015em;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ticket-print-card-price {
    margin: 0.3mm 0 0;
    color: #111111;
    font-size: 12.5px;
    font-weight: 400;
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ticket-print-card-sequence {
    color: #111111;
    font-size: 11px;
    font-weight: 500;
    line-height: 1;
    white-space: nowrap;
    padding-top: 0.55mm;
  }

  .ticket-print-person {
    display: grid;
    gap: 0.25mm;
    min-width: 0;
    margin-bottom: 0.95mm;
  }

  .ticket-print-student {
    min-width: 0;
    max-height: 4.2mm;
    overflow: hidden;
    color: #111111;
    font-size: 13.2px;
    font-weight: 700;
    line-height: 1;
  }

  .ticket-print-group {
    min-width: 0;
    color: #111111;
    font-size: 11.5px;
    font-weight: 400;
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ticket-print-barcode-wrap {
    display: grid;
    align-items: center;
    width: 100%;
    min-width: 0;
    margin-bottom: 0.85mm;
  }

  .ticket-print-barcode {
    min-width: 0;
    margin: 0 -1mm;
    width: calc(100% + 2mm);
    overflow: hidden;
  }

  .ticket-print-barcode svg {
    display: block;
    width: 100%;
    height: 6.8mm;
  }

  .ticket-print-card--large .ticket-print-barcode svg {
    height: 6.8mm;
  }

  .ticket-print-period {
    color: #111111;
    font-size: 11px;
    font-weight: 400;
    line-height: 1;
    white-space: nowrap;
  }

  .ticket-print-empty {
    padding: 8mm;
    border: 0.2mm solid #d7dbe1;
    color: #4b5563;
    font-size: 12px;
  }

  @media print {
    .ticket-sheet-print {
      width: 210mm;
      min-height: 297mm;
      margin: 0;
      padding: 6mm 8mm;
    }

    .ticket-sheet-header {
      margin-bottom: 2.2mm;
    }
  }
`
