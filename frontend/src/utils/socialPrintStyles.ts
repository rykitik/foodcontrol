export const SOCIAL_PRINT_STYLES = `
  .student-list-page {
    width: 100%;
  }

  .student-list-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin: 14px 0 10px;
  }

  .student-list-summary-card {
    padding: 10px 12px;
    border: 1px solid #dbe3ee;
    border-radius: 12px;
    background: #f8fbff;
  }

  .student-list-summary-card span,
  .student-list-summary-card strong {
    display: block;
  }

  .student-list-summary-card span {
    margin-bottom: 4px;
    color: #64748b;
    font-size: 11px;
  }

  .student-list-summary-card strong {
    color: #0f172a;
    font-size: 13px;
    line-height: 1.35;
  }

  .student-list-table {
    table-layout: fixed;
  }

  .student-list-table th {
    background: #f8fafc;
    font-weight: 700;
  }

  .student-list-table th:nth-child(1),
  .student-list-table td:nth-child(1) {
    width: 36px;
    text-align: center;
  }

  .student-list-table th:nth-child(2),
  .student-list-table td:nth-child(2) {
    width: 32%;
  }

  .student-list-table th:nth-child(3),
  .student-list-table td:nth-child(3) {
    width: 16%;
  }

  .student-list-table th:nth-child(4),
  .student-list-table td:nth-child(4) {
    width: 20%;
  }

  .student-list-table th:nth-child(5),
  .student-list-table td:nth-child(5) {
    width: 24%;
  }

  .student-list-table .student-list-student-col strong,
  .student-list-table .student-list-student-col span {
    display: block;
  }

  .student-list-table .student-list-student-col strong {
    margin-bottom: 4px;
    color: #0f172a;
    font-size: 13px;
  }

  .student-list-table .student-list-student-col span {
    color: #64748b;
    font-size: 11px;
  }

  .social-meal-sheet-page {
    width: 100%;
  }

  .social-meal-sheet-page .doc-inline-meta {
    margin: 6px 0;
    align-items: center;
    font-size: 11px;
  }

  .social-meal-sheet-table {
    width: 100%;
    table-layout: fixed;
  }

  .social-meal-sheet-table col.social-meal-sheet-index-column { width: 24px; }
  .social-meal-sheet-table col.social-meal-sheet-student-column { width: 148px; }
  .social-meal-sheet-table col.social-meal-sheet-day-column { width: 15px; }
  .social-meal-sheet-table col.social-meal-sheet-total-column { width: 42px; }
  .social-meal-sheet-table col.social-meal-sheet-amount-column { width: 56px; }

  .social-meal-sheet-table th,
  .social-meal-sheet-table td {
    padding: 2px 1px;
    font-size: 9px;
    line-height: 1.1;
    text-align: center;
    word-break: break-word;
  }

  .social-meal-sheet-table .student-col {
    width: auto;
    min-width: 0;
    text-align: left;
    font-size: 9px;
  }

  .social-meal-sheet-table .student-col span {
    color: #475569;
    font-size: 8px;
  }

  .social-meal-sheet-table .day-col,
  .social-meal-sheet-table .day-cell,
  .social-meal-sheet-table .day-total {
    width: auto;
    padding: 1px 0;
    font-size: 7.5px;
  }

  .social-meal-sheet-table .day-cell {
    font-weight: 700;
    line-height: 1;
  }

  .social-meal-sheet-table .totals-row td {
    font-size: 8.5px;
  }

  .social-meal-sheet-page .report-footer {
    margin-top: 10px;
  }

  .social-meal-sheet-page .totals {
    margin-top: 6px;
    font-size: 11px;
  }

  .social-meal-sheet-page .signatures {
    gap: 8px;
    margin-top: 12px;
  }

  .social-meal-sheet-page .signature-line {
    grid-template-columns: minmax(90px, 1fr) 110px minmax(110px, 1fr);
    gap: 10px;
    font-size: 11px;
  }

  @media print {
    .student-list-summary {
      gap: 8px;
      margin: 10px 0 8px;
    }

    .student-list-summary-card {
      padding: 8px 10px;
    }

    .student-list-table th,
    .student-list-table td {
      font-size: 11px;
    }

    .social-meal-sheet-page .doc-title {
      font-size: 20px;
      margin-bottom: 4px;
    }

    .social-meal-sheet-page .doc-subtitle,
    .social-meal-sheet-page .doc-org {
      margin-bottom: 4px;
    }
  }

  @media (max-width: 720px) {
    .student-list-summary {
      grid-template-columns: 1fr;
    }
  }
`
