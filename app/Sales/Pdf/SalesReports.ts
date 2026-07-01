'use client';

import { addArabicFont } from '@/app/Components/Pdf/shared';
import type {
  CustomerCompareBlock,
  CompareMode,
  ReportsPayload,
  ReportsTableSection,
  SalesReportsInput,
} from '@/app/Sales/Pdf/SalesReportsTypes';
import type { SalesCommonFilters } from '@/app/Sales/Model/SalesFilters';
import {
  getAmountTableSubtitle,
  getChartActualLabel,
  getChartTitle,
  getCustomersTableTitle,
  getKpiLabel,
  getKpiCompareLabel,
  getVisibleKpiKeys,
  resolveReportingMode,
  shouldInvertReturnKpiChange,
  shouldShowTargetInChart,
  REPORTING_MODE_LABELS,
  type KpiConfigKey,
} from '@/app/Sales/Utils/ReportingMode';

const MARGIN = 8;
const LANDSCAPE_W = 297;
const TABLE_W = LANDSCAPE_W - MARGIN * 2;

const C = {
  slate950: [2, 6, 23] as [number, number, number],
  slate900: [15, 23, 42] as [number, number, number],
  slate700: [51, 65, 85] as [number, number, number],
  slate500: [100, 116, 139] as [number, number, number],
  slate200: [226, 232, 240] as [number, number, number],
  slate100: [241, 245, 249] as [number, number, number],
  slate50: [248, 250, 252] as [number, number, number],
  emerald600: [5, 150, 105] as [number, number, number],
  emerald500: [16, 185, 129] as [number, number, number],
  emerald50: [236, 253, 245] as [number, number, number],
  blue500: [59, 130, 246] as [number, number, number],
  purple500: [168, 85, 247] as [number, number, number],
  amber500: [245, 158, 11] as [number, number, number],
  rose500: [244, 63, 94] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  grayBar: [203, 213, 225] as [number, number, number],
  violet500: [139, 92, 246] as [number, number, number],
};

function fmtNum(n: number) {
  return (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtInt(n: number) {
  return Math.round(Number(n) || 0).toLocaleString('en-US');
}

function fmtPct(n: number | undefined | null) {
  return `${(Number(n) || 0).toFixed(1)}%`;
}

function fmtBarLabel(val: number) {
  const n = Number(val) || 0;
  if (!n) return '';
  return n.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 });
}

function fmtCompact(n: number) {
  return fmtBarLabel(n) || '0';
}

function pdfCellText(text: string, maxChars = 50): string {
  const t = String(text || '—').trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars - 1)}…`;
}

function formatKpiChange(
  kpi: { changePct?: number; changeAbs?: number },
  compareMode: CompareMode,
  comparePeriodLabel?: string,
  short = false
): { text: string; up: boolean } {
  const change = kpi.changePct ?? kpi.changeAbs ?? 0;
  const isPct = kpi.changePct !== undefined;
  const up = change >= 0;
  const sign = up ? '+' : '-';
  const val = isPct
    ? `${Math.abs(Number(change) || 0).toFixed(1)}%`
    : fmtInt(Math.abs(Number(change) || 0));
  const suffix = short
    ? compareMode === 'sameMonthLastYear'
      ? ' vs LY'
      : ' vs LM'
    : ` ${getKpiCompareLabel(compareMode, comparePeriodLabel)}`;
  return { text: `${sign}${val}${suffix}`, up };
}

function totalReturnSub(kpi: { value?: number }) {
  return fmtPct(kpi.value);
}

function buildScopeLabel(filters: SalesCommonFilters, repDisplayName: string): string {
  if (filters.salesRep) return filters.salesRep;
  if (filters.merchandiser) return filters.merchandiser;
  return repDisplayName;
}

function buildScopeType(filters: SalesCommonFilters): string {
  if (filters.salesRep) return 'Sales Rep';
  if (filters.merchandiser) return 'Merchandiser';
  return 'Scope';
}

function columnStylesFromWidths(widths: number[]) {
  const styles: Record<number, { cellWidth: number; halign: 'center' }> = {};
  widths.forEach((w, i) => {
    styles[i] = { cellWidth: w, halign: 'center' };
  });
  return styles;
}

function normalizeColumnWidths(widths: number[], target = TABLE_W): number[] {
  const sum = widths.reduce((a, b) => a + b, 0);
  if (sum <= 0) return widths;
  const scaled = widths.map((w) => (w / sum) * target);
  const rounded = scaled.map((w) => Math.round(w * 10) / 10);
  const drift = Math.round((target - rounded.reduce((a, b) => a + b, 0)) * 10) / 10;
  rounded[rounded.length - 1] = Math.round((rounded[rounded.length - 1] + drift) * 10) / 10;
  return rounded;
}

function drawTablePageHeader(doc: any, title: string, subtitle?: string): number {
  drawContentPageHeader(doc, title, subtitle);
  return 28;
}

function computeSinglePageTableStyles(rowCount: number, pageHeight: number, tableStartY: number) {
  const bottomReserve = 16;
  const availableH = pageHeight - tableStartY - bottomReserve;
  const bodyRows = Math.max(rowCount, 1);

  let fontSize = 10;
  let bodyPad = 4.5;
  let headPad = 5;

  const estimateHeight = () => {
    const tableHeadH = headPad * 2 + fontSize * 0.45;
    const rowH = bodyPad * 2 + fontSize * 0.5;
    return tableHeadH + bodyRows * rowH;
  };

  while (estimateHeight() > availableH && fontSize > 7) {
    fontSize -= 0.5;
    bodyPad = Math.max(3, bodyPad - 0.3);
    headPad = Math.max(3.5, headPad - 0.25);
  }

  return { fontSize, bodyPad, headPad };
}

function drawPageFooter(doc: any, pageNum: number, totalPages: number, periodLabel: string) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(C.slate200[0], C.slate200[1], C.slate200[2]);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, h - 14, w - MARGIN, h - 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(C.slate500[0], C.slate500[1], C.slate500[2]);
  doc.text(periodLabel, MARGIN, h - 8);
  doc.text(`Page ${pageNum} / ${totalPages}`, w - MARGIN, h - 8, { align: 'right' });
}

function drawContentPageHeader(doc: any, title: string, subtitle?: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(C.slate950[0], C.slate950[1], C.slate950[2]);
  doc.rect(0, 0, w, 22, 'F');
  doc.setFillColor(C.emerald500[0], C.emerald500[1], C.emerald500[2]);
  doc.rect(0, 0, 4, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(C.white[0], C.white[1], C.white[2]);
  doc.text(title, MARGIN + 4, 10);
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text(subtitle, MARGIN + 4, 16);
  }
}

function computeCoverPanelY(pageHeight: number, itemCount: number): number {
  const pad = 12;
  const rowH = itemCount > 7 ? 9 : 10;
  const headerH = 16;
  const footerReserve = 22;
  const contentTop = 76;
  const contentBottom = pageHeight - footerReserve;
  const panelH = pad * 2 + headerH + itemCount * rowH;
  const availableH = contentBottom - contentTop;
  const centeredY = contentTop + (availableH - panelH) / 2;
  const minY = contentTop;
  const maxY = contentBottom - panelH;
  return Math.max(minY, Math.min(maxY, centeredY));
}

function drawCoverParameterList(
  doc: any,
  x: number,
  y: number,
  width: number,
  items: { label: string; value: string }[]
): number {
  const pad = 12;
  const labelW = 50;
  const valueX = x + pad + labelW;
  const valueW = width - pad * 2 - labelW;
  const rowH = items.length > 7 ? 9 : 10;
  const headerH = 16;
  const panelH = pad * 2 + headerH + items.length * rowH;

  doc.setFillColor(C.white[0], C.white[1], C.white[2]);
  doc.setDrawColor(C.slate200[0], C.slate200[1], C.slate200[2]);
  doc.setLineWidth(0.15);
  doc.roundedRect(x, y, width, panelH, 6, 6, 'FD');

  let cursorY = y + pad + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(C.slate500[0], C.slate500[1], C.slate500[2]);
  doc.text('REPORT PARAMETERS', x + pad, cursorY);

  doc.setFillColor(C.emerald500[0], C.emerald500[1], C.emerald500[2]);
  doc.rect(x + pad, cursorY + 2.5, 28, 0.7, 'F');

  cursorY += headerH;

  items.forEach((item, index) => {
    if (index > 0) {
      doc.setDrawColor(C.slate100[0], C.slate100[1], C.slate100[2]);
      doc.setLineWidth(0.12);
      doc.line(x + pad, cursorY - 5, x + width - pad, cursorY - 5);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(C.slate500[0], C.slate500[1], C.slate500[2]);
    doc.text(item.label.toUpperCase(), x + pad, cursorY);

    const hasArabic = /[\u0600-\u06FF]/.test(item.value);
    doc.setFont(hasArabic ? 'Amiri' : 'helvetica', 'normal');
    doc.setFontSize(hasArabic ? 11 : 10);
    doc.setTextColor(C.slate900[0], C.slate900[1], C.slate900[2]);
    doc.text(item.value, valueX, cursorY, { maxWidth: valueW });

    cursorY += rowH;
  });

  return y + panelH;
}

function formatReportGeneratedDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function drawCoverPage(doc: any, data: ReportsPayload, input: SalesReportsInput) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentW = pageWidth - MARGIN * 2;

  doc.setFillColor(C.slate50[0], C.slate50[1], C.slate50[2]);
  doc.rect(0, 74, pageWidth, pageHeight - 74, 'F');

  doc.setFillColor(C.slate950[0], C.slate950[1], C.slate950[2]);
  doc.rect(0, 0, pageWidth, 74, 'F');
  doc.setFillColor(C.emerald600[0], C.emerald600[1], C.emerald600[2]);
  doc.rect(0, 0, 5, 74, 'F');
  doc.setFillColor(C.emerald500[0], C.emerald500[1], C.emerald500[2]);
  doc.rect(0, 74, pageWidth, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('AL MARAI AL ARABIA TRADING SOLE PROPRIETORSHIP L.L.C', MARGIN + 8, 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(C.white[0], C.white[1], C.white[2]);
  doc.text('Sales Performance Report', MARGIN + 8, 40);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(C.emerald500[0], C.emerald500[1], C.emerald500[2]);
  doc.text(`Generated ${formatReportGeneratedDate()}`, MARGIN + 8, 56);

  const scope = buildScopeLabel(input.filters, data.repDisplayName);
  const scopeType = buildScopeType(input.filters);
  const customerViewLabel = input.customerView === 'main' ? 'Main Customer' : 'Sub Customer';
  const dateRange =
    input.dateFrom && input.dateTo
      ? `${input.dateFrom} - ${input.dateTo}`
      : data.periodLabel;

  const reportingMode = resolveReportingMode(input.filters.invoiceType ?? data.reportingMode);
  const reportingModeLabel = data.reportingModeLabel || REPORTING_MODE_LABELS[reportingMode];

  const paramItems: { label: string; value: string }[] = [
    { label: scopeType, value: scope },
    { label: 'Reporting Mode', value: reportingModeLabel },
    { label: 'Date Range', value: dateRange },
    { label: 'Compare Against', value: input.compareLabel },
    { label: 'Customer View', value: customerViewLabel },
  ];
  if (input.filters.area) paramItems.push({ label: 'Area', value: input.filters.area });
  if (input.filters.market) paramItems.push({ label: 'Market', value: input.filters.market });
  if (input.filters.productTag) paramItems.push({ label: 'Product Tag', value: input.filters.productTag });

  const panelY = computeCoverPanelY(pageHeight, paramItems.length);
  drawCoverParameterList(doc, MARGIN, panelY, contentW, paramItems);
}

function drawKpiCard(
  doc: any,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  accent: [number, number, number],
  kpi: { changePct?: number; changeAbs?: number; sparkline?: number[] },
  sub?: string,
  invertChangeColor?: boolean,
  compareMode: CompareMode = 'prevMonth',
  comparePeriodLabel?: string
) {
  const headerH = 12;
  const badgeZoneH = 14;
  const radius = 4;
  const bodyTop = y + headerH;
  const bodyBottom = y + h - badgeZoneH;

  doc.setFillColor(C.white[0], C.white[1], C.white[2]);
  doc.setDrawColor(C.slate200[0], C.slate200[1], C.slate200[2]);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, h, radius, radius, 'FD');

  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.roundedRect(x, y, w, headerH, radius, radius, 'F');
  doc.rect(x, y + headerH - radius, w, radius, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(C.white[0], C.white[1], C.white[2]);
  doc.text(label.toUpperCase(), x + w / 2, y + 8.5, { align: 'center', maxWidth: w - 8 });

  const bodyH = bodyBottom - bodyTop;
  const valueSize = 17;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(valueSize);
  doc.setTextColor(C.slate900[0], C.slate900[1], C.slate900[2]);

  if (sub) {
    const valueY = bodyTop + bodyH / 2 + valueSize * 0.12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(valueSize);
    doc.setTextColor(C.slate900[0], C.slate900[1], C.slate900[2]);
    const valueW = doc.getTextWidth(value);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(C.slate500[0], C.slate500[1], C.slate500[2]);
    const subW = doc.getTextWidth(sub);
    const inlineGap = 2.5;
    const totalW = valueW + inlineGap + subW;
    let cursorX = x + (w - totalW) / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(valueSize);
    doc.setTextColor(C.slate900[0], C.slate900[1], C.slate900[2]);
    doc.text(value, cursorX, valueY);
    cursorX += valueW + inlineGap;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(C.slate500[0], C.slate500[1], C.slate500[2]);
    doc.text(sub, cursorX, valueY);
  } else {
    const valueY = bodyTop + bodyH / 2 + valueSize * 0.12;
    doc.text(value, x + w / 2, valueY, { align: 'center' });
  }

  const { text: changeText, up } = formatKpiChange(kpi, compareMode, comparePeriodLabel, false);
  const isGood = invertChangeColor ? !up : up;
  const badgePadX = 8;
  const badgeH = 11;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  const badgeTextW = doc.getTextWidth(changeText);
  const badgeW = Math.min(badgeTextW + badgePadX * 2, w - 10);
  const badgeX = x + (w - badgeW) / 2;
  const badgeY = y + h - badgeH - 5;

  if (isGood) {
    doc.setFillColor(C.emerald50[0], C.emerald50[1], C.emerald50[2]);
    doc.setDrawColor(110, 231, 183);
    doc.setTextColor(C.emerald600[0], C.emerald600[1], C.emerald600[2]);
  } else {
    doc.setFillColor(255, 241, 242);
    doc.setDrawColor(254, 205, 211);
    doc.setTextColor(225, 29, 72);
  }
  doc.setLineWidth(0.2);
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 4, 4, 'FD');
  doc.text(changeText, x + w / 2, badgeY + 7.5, { align: 'center' });
}

function layoutKpiGrid(
  cardCount: number,
  cols: number
): { row: number; col: number; rowCount: number }[] {
  const positions: { row: number; col: number; rowCount: number }[] = [];
  for (let i = 0; i < cardCount; i++) {
    const row = Math.floor(i / cols);
    const rowStart = row * cols;
    const rowCount = Math.min(cols, cardCount - rowStart);
    const col = i - rowStart;
    positions.push({ row, col, rowCount });
  }
  return positions;
}

type KpiCardDef = {
  label: string;
  value: string;
  sub?: string;
  accent: [number, number, number];
  kpi: { changePct?: number; changeAbs?: number; sparkline?: number[] };
  invertChangeColor?: boolean;
};

const KPI_ACCENTS: Record<KpiConfigKey, [number, number, number]> = {
  totalSales: C.emerald500,
  targetAchievement: C.emerald600,
  returnsRate: C.rose500,
  invoices: C.blue500,
  avgInvoiceValue: C.purple500,
  returnInvoices: C.rose500,
  avgReturnValue: C.rose500,
  activeCustomers: C.slate700,
  newCustomers: C.amber500,
};

function drawKpiPage(doc: any, data: ReportsPayload, input: SalesReportsInput) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const reportingMode = resolveReportingMode(input.filters.invoiceType ?? data.reportingMode);
  const modeLabel = data.reportingModeLabel || REPORTING_MODE_LABELS[reportingMode];
  const compareMode = input.compareMode;
  const comparePeriodLabel = data.compareModes?.[compareMode]?.label;

  drawContentPageHeader(
    doc,
    'Key Performance Indicators',
    `${modeLabel}  ·  ${data.periodLabel}`
  );

  const kpis = data.kpiViews?.[compareMode] ?? data.kpis;
  const visibleKeys = getVisibleKpiKeys(reportingMode);

  const cards: KpiCardDef[] = visibleKeys.map((key) => {
    const kpi = kpis[key] ?? {};
    switch (key) {
      case 'totalSales':
        return {
          label: getKpiLabel(key, reportingMode),
          value: fmtNum(kpis.totalSales?.value ?? 0),
          accent: KPI_ACCENTS[key],
          kpi: kpis.totalSales ?? {},
        };
      case 'targetAchievement':
        return {
          label: getKpiLabel(key, reportingMode),
          value: fmtPct(kpis.targetAchievement?.value),
          sub: fmtNum(Number(kpis.targetAchievement?.targetAmount) || 0),
          accent: KPI_ACCENTS[key],
          kpi: kpis.targetAchievement ?? {},
        };
      case 'returnsRate':
        return {
          label: getKpiLabel(key, reportingMode),
          value: fmtNum(Number(kpis.returnsRate?.grvAmount ?? kpis.totalSales?.returnsAmount ?? 0)),
          sub: totalReturnSub(kpis.returnsRate ?? {}),
          accent: KPI_ACCENTS[key],
          kpi: kpis.returnsRate ?? {},
          invertChangeColor: true,
        };
      case 'invoices':
        return {
          label: getKpiLabel(key, reportingMode),
          value: fmtInt(kpis.invoices?.value ?? 0),
          accent: KPI_ACCENTS[key],
          kpi: kpis.invoices ?? {},
        };
      case 'avgInvoiceValue':
        return {
          label: getKpiLabel(key, reportingMode),
          value: fmtNum(kpis.avgInvoiceValue?.value ?? 0),
          accent: KPI_ACCENTS[key],
          kpi: kpis.avgInvoiceValue ?? {},
        };
      case 'returnInvoices':
        return {
          label: getKpiLabel(key, reportingMode),
          value: fmtInt(kpis.returnInvoices?.value ?? 0),
          accent: KPI_ACCENTS[key],
          kpi: kpis.returnInvoices ?? {},
          invertChangeColor: shouldInvertReturnKpiChange(key),
        };
      case 'avgReturnValue':
        return {
          label: getKpiLabel(key, reportingMode),
          value: fmtNum(kpis.avgReturnValue?.value ?? 0),
          accent: KPI_ACCENTS[key],
          kpi: kpis.avgReturnValue ?? {},
          invertChangeColor: shouldInvertReturnKpiChange(key),
        };
      case 'activeCustomers':
        return {
          label: getKpiLabel(key, reportingMode),
          value: fmtInt(kpis.activeCustomers?.value ?? 0),
          accent: KPI_ACCENTS[key],
          kpi: kpis.activeCustomers ?? {},
        };
      case 'newCustomers':
        return {
          label: getKpiLabel(key, reportingMode),
          value: fmtInt(kpis.newCustomers?.value ?? 0),
          accent: KPI_ACCENTS[key],
          kpi: kpis.newCustomers ?? {},
        };
      default:
        return {
          label: key,
          value: '—',
          accent: C.slate700,
          kpi: {},
        };
    }
  });

  const COLS = 3;
  const gap = 10;
  const startY = 30;
  const usableW = pageWidth - MARGIN * 2;
  const cardW = ((usableW - gap * (COLS - 1)) / COLS) * 0.92;
  const gridW = cardW * COLS + gap * (COLS - 1);
  const gridX = MARGIN + (usableW - gridW) / 2;
  const cardH = 42;

  const positions = layoutKpiGrid(cards.length, COLS);
  cards.forEach((card, i) => {
    const { row, col, rowCount } = positions[i];
    const rowTotalW = rowCount * cardW + (rowCount - 1) * gap;
    const rowX = gridX + (gridW - rowTotalW) / 2;
    const x = rowX + col * (cardW + gap);
    const y = startY + row * (cardH + gap);

    drawKpiCard(
      doc,
      x,
      y,
      cardW,
      cardH,
      card.label,
      card.value,
      card.accent,
      card.kpi,
      card.sub,
      card.invertChangeColor,
      compareMode,
      comparePeriodLabel
    );
  });
}

function getChartCompareConfig(compareMode: CompareMode, reportingMode: ReturnType<typeof resolveReportingMode>) {
  const title = getChartTitle(reportingMode, compareMode);
  if (compareMode === 'prevMonth') {
    return {
      key: 'prevMonth' as const,
      legendLabel: 'Previous Month',
      title,
      subtitle: reportingMode === 'returns'
        ? 'Last 3 months — Actual GRV and Previous Month'
        : 'Last 3 months — Actual, Target, and Previous Month',
      showTarget: shouldShowTargetInChart(reportingMode),
      actualLabel: getChartActualLabel(reportingMode),
    };
  }
  return {
    key: 'lastYear' as const,
    legendLabel: 'Same Period Last Year',
    title,
    subtitle: reportingMode === 'returns'
      ? 'Last 3 months — Actual GRV and Same Period Last Year'
      : 'Last 3 months — Actual, Target, and Same Period Last Year',
    showTarget: shouldShowTargetInChart(reportingMode),
    actualLabel: getChartActualLabel(reportingMode),
  };
}

function drawMonthlyChartPage(doc: any, data: ReportsPayload, compareMode: CompareMode, input: SalesReportsInput) {
  const reportingMode = resolveReportingMode(input.filters.invoiceType ?? data.reportingMode);
  const chartCfg = getChartCompareConfig(compareMode, reportingMode);
  drawContentPageHeader(doc, chartCfg.title, chartCfg.subtitle);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const chartBoxY = 30;
  const chartBoxH = pageHeight - chartBoxY - 22;
  const chartBoxX = MARGIN;
  const chartBoxW = pageWidth - MARGIN * 2;

  doc.setFillColor(C.white[0], C.white[1], C.white[2]);
  doc.setDrawColor(C.slate200[0], C.slate200[1], C.slate200[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(chartBoxX, chartBoxY, chartBoxW, chartBoxH, 5, 5, 'FD');

  const legendY = chartBoxY + 12;
  const legendItems: { label: string; color: [number, number, number] }[] = [
    { label: chartCfg.actualLabel, color: C.emerald500 },
    ...(chartCfg.showTarget ? [{ label: 'Target', color: C.grayBar }] : []),
    { label: chartCfg.legendLabel, color: C.violet500 },
  ];
  let lx = chartBoxX + 14;
  legendItems.forEach((item) => {
    doc.setFillColor(item.color[0], item.color[1], item.color[2]);
    doc.roundedRect(lx, legendY - 4, 10, 10, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(C.slate700[0], C.slate700[1], C.slate700[2]);
    doc.text(item.label, lx + 14, legendY + 2);
    lx += 52;
  });

  const chartData = data.monthlyComparison.slice(-3);
  const monthCount = Math.max(chartData.length, 1);
  const yAxisW = 14;
  const chartLeft = chartBoxX + yAxisW + 4;
  const chartW = chartBoxW - yAxisW - 12;
  const monthLabelH = 10;
  const valueLabelH = 22;
  const plotTop = chartBoxY + 28 + valueLabelH;
  const plotH = chartBoxH - 28 - valueLabelH - monthLabelH - 24;
  const barBaseY = plotTop + plotH;

  const maxVal = Math.max(
    ...chartData.flatMap((d) => [
      d.actual,
      ...(chartCfg.showTarget ? [d.target] : []),
      d[chartCfg.key],
    ]),
    1
  );

  doc.setDrawColor(C.slate100[0], C.slate100[1], C.slate100[2]);
  doc.setLineWidth(0.15);
  for (let i = 0; i <= 5; i++) {
    const gy = plotTop + (plotH / 5) * i;
    doc.line(chartLeft, gy, chartLeft + chartW, gy);
    if (i < 5) {
      const val = maxVal * (1 - i / 5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(C.slate500[0], C.slate500[1], C.slate500[2]);
      doc.text(fmtCompact(val), chartLeft - 2, gy + 2, { align: 'right' });
    }
  }

  const groupW = chartW / monthCount;
  const barsPerGroup = chartCfg.showTarget ? 3 : 2;
  const barW = 16;
  const barGap = 4;
  const clusterW = barW * barsPerGroup + barGap * Math.max(barsPerGroup - 1, 0);

  chartData.forEach((d, i) => {
    const groupCenter = chartLeft + i * groupW + groupW / 2;
    const totalBarsW = barW * barsPerGroup + barGap * (barsPerGroup - 1);
    const gx = groupCenter - totalBarsW / 2;
    const series: { val: number; color: [number, number, number] }[] = [
      { val: d.actual, color: C.emerald500 },
      ...(chartCfg.showTarget ? [{ val: d.target, color: C.grayBar }] : []),
      { val: d[chartCfg.key], color: C.violet500 },
    ];
    series.forEach((s, si) => {
      const bx = gx + si * (barW + barGap);
      if (s.val > 0) {
        const h = Math.max((s.val / maxVal) * plotH, 2);
        const barTop = barBaseY - h;
        doc.setFillColor(s.color[0], s.color[1], s.color[2]);
        doc.roundedRect(bx, barTop, barW, h, 2, 2, 'F');

        const label = fmtBarLabel(s.val);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(C.slate900[0], C.slate900[1], C.slate900[2]);
        doc.text(label, bx + barW / 2, barTop - 4, { align: 'center' });
      }
    });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(C.slate700[0], C.slate700[1], C.slate700[2]);
    doc.text(String(d.month), groupCenter, barBaseY + 8, { align: 'center' });
  });
}

function buildInvoiceTableSections(
  data: ReportsPayload,
  reportingMode: ReturnType<typeof resolveReportingMode>
): ReportsTableSection[] {
  const sections: ReportsTableSection[] = [];

  if (reportingMode !== 'returns') {
    sections.push({
      title: 'Top 10 Invoices by Value',
      subtitle: 'Sales invoices ranked by amount this period',
      head: ['#', 'Date', 'Invoice No.', 'Customer', 'Amount'],
      columnWidths: [16, 40, 54, 116, 55],
      body: (data.topSalesInvoices ?? []).map((r) => [
        String(r.rank),
        r.date,
        r.invoiceNumber,
        pdfCellText(r.customerName),
        fmtNum(r.amount),
      ]),
      textColumnIndexes: [3],
      amountColumnIndexes: [4],
    });
  }

  if (reportingMode !== 'sales') {
    sections.push({
      title: 'Top 10 Returns by Value',
      subtitle: 'Return invoices ranked by amount this period',
      head: ['#', 'Date', 'Invoice No.', 'Customer', 'Amount'],
      columnWidths: [16, 40, 54, 116, 55],
      body: (data.topReturnInvoices ?? []).map((r) => [
        String(r.rank),
        r.date,
        r.invoiceNumber,
        pdfCellText(r.customerName),
        fmtNum(r.amount),
      ]),
      textColumnIndexes: [3],
      amountColumnIndexes: [4],
    });
  }

  return sections;
}

function buildTableSections(
  data: ReportsPayload,
  compareBlock: CustomerCompareBlock,
  compareLabel: string,
  customerViewLabel: string,
  reportingMode: ReturnType<typeof resolveReportingMode>
): ReportsTableSection[] {
  const customerSubtitle = `${customerViewLabel} · compared to ${compareLabel}`;
  const amountSubtitle = getAmountTableSubtitle(reportingMode);

  return [
    ...buildInvoiceTableSections(data, reportingMode),
    {
      title: getCustomersTableTitle(reportingMode),
      subtitle: customerSubtitle,
      head: ['#', 'Customer', 'Invoices', 'Amount', 'vs Compare', 'Share'],
      columnWidths: [16, 110, 30, 45, 35, 45],
      body: compareBlock.topCustomers.map((r) => [
        String(r.rank),
        r.name || '—',
        String(r.invoices ?? 0),
        fmtNum(r.amount),
        `${(r.comparePct ?? 0) >= 0 ? '+' : ''}${fmtPct(r.comparePct)}`,
        fmtPct(r.sharePct),
      ]),
      textColumnIndexes: [1],
      amountColumnIndexes: [3],
    },
    ...(reportingMode !== 'returns' && compareBlock.topReturnCustomers.length > 0
      ? [{
          title: 'Top 10 Customers by Returns',
          subtitle: `${customerViewLabel} · ranked by return amount vs ${compareLabel}`,
          head: ['#', 'Customer', 'Invoices', 'Amount', 'vs Compare', 'Share'],
          columnWidths: [16, 110, 30, 45, 35, 45],
          body: compareBlock.topReturnCustomers.map((r) => [
            String(r.rank),
            r.name || '—',
            String(r.invoices ?? 0),
            fmtNum(r.amount),
            `${(r.comparePct ?? 0) >= 0 ? '+' : ''}${fmtPct(r.comparePct)}`,
            fmtPct(r.sharePct),
          ]),
          textColumnIndexes: [1],
          amountColumnIndexes: [3],
        }]
      : []),
    {
      title: 'Top 10 Growing Customers',
      subtitle: `${customerViewLabel} · largest growth vs ${compareLabel}`,
      head: ['#', 'Customer', 'Current', 'Compare', 'Change', 'Change %'],
      columnWidths: [16, 100, 42, 42, 42, 39],
      body: compareBlock.topGrowing.map((r) => [
        String(r.rank),
        r.name || '—',
        fmtNum(r.currentAmount),
        fmtNum(r.compareAmount),
        fmtNum(r.changeAmount),
        `+${fmtPct(r.changePct)}`,
      ]),
      textColumnIndexes: [1],
      amountColumnIndexes: [2, 3, 4],
    },
    {
      title: 'Top 10 Most Declining Customers',
      subtitle: `${customerViewLabel} · largest drop vs ${compareLabel}`,
      head: ['#', 'Customer', 'Current', 'Compare', 'Change', 'Change %'],
      columnWidths: [16, 100, 42, 42, 42, 39],
      body: compareBlock.topDeclining.map((r) => [
        String(r.rank),
        r.name || '—',
        fmtNum(r.currentAmount),
        fmtNum(r.compareAmount),
        fmtNum(r.changeAmount),
        fmtPct(r.changePct),
      ]),
      negativeColumns: [4, 5],
      textColumnIndexes: [1],
      amountColumnIndexes: [2, 3, 4],
    },
    {
      title: 'At-Risk Customers',
      subtitle: `${customerViewLabel} · had sales in compare period, zero this period`,
      head: ['#', 'Customer', 'Last Period', 'Current Period'],
      columnWidths: [18, 130, 66, 67],
      body: compareBlock.atRisk.map((r) => [
        String(r.rank),
        r.name || '—',
        fmtNum(r.compareAmount),
        fmtNum(r.currentAmount),
      ]),
      textColumnIndexes: [1],
      amountColumnIndexes: [2, 3],
    },
    {
      title: 'Top 10 Products',
      subtitle: amountSubtitle,
      head: ['#', 'Barcode', 'Product', 'QTY', 'Amount', 'Share'],
      columnWidths: [16, 38, 112, 32, 45, 38],
      body: data.topProducts.map((r) => [
        String(r.rank),
        r.barcode || '—',
        r.name || '—',
        fmtInt(r.qty),
        fmtNum(r.amount),
        fmtPct(r.sharePct),
      ]),
      textColumnIndexes: [2],
      amountColumnIndexes: [4],
    },
    {
      title: 'Top 10 Categories',
      subtitle: amountSubtitle,
      head: ['#', 'Category', 'QTY', 'Amount', 'Share'],
      columnWidths: [18, 130, 38, 52, 43],
      body: data.topCategories.map((r) => [
        String(r.rank),
        r.category || '—',
        fmtInt(r.qty),
        fmtNum(r.amount),
        fmtPct(r.sharePct),
      ]),
      textColumnIndexes: [1],
      amountColumnIndexes: [3],
    },
  ];
}

function drawTablePage(doc: any, autoTable: any, section: ReportsTableSection) {
  const tableStartY = drawTablePageHeader(doc, section.title, section.subtitle);

  const negativeCols = new Set(section.negativeColumns ?? []);
  const textCols = new Set(section.textColumnIndexes ?? []);
  const amountCols = new Set(section.amountColumnIndexes ?? []);
  const pageH = doc.internal.pageSize.getHeight();
  const rowCount = section.body.length || 1;
  const { fontSize, bodyPad, headPad } = computeSinglePageTableStyles(rowCount, pageH, tableStartY);
  const columnWidths = normalizeColumnWidths(section.columnWidths);

  const tableOptions = {
    startY: tableStartY,
    head: [section.head],
    body: section.body.length
      ? section.body
      : [section.head.map((_, i) => (i === 1 ? 'No data for this period' : '—'))],
    theme: 'plain' as const,
    tableWidth: TABLE_W,
    pageBreak: 'avoid' as const,
    rowPageBreak: 'avoid' as const,
    showHead: 'firstPage' as const,
    headStyles: {
      fillColor: C.slate900,
      textColor: C.white,
      fontStyle: 'bold' as const,
      fontSize,
      halign: 'center' as const,
      cellPadding: { top: headPad, bottom: headPad, left: 4, right: 4 },
    },
    bodyStyles: {
      fontSize,
      cellPadding: { top: bodyPad, bottom: bodyPad, left: 4, right: 4 },
      halign: 'center' as const,
      textColor: C.slate900,
      lineColor: C.slate200,
      lineWidth: 0.15,
      overflow: 'ellipsize' as const,
    },
    columnStyles: columnStylesFromWidths(columnWidths),
    margin: { left: MARGIN, right: MARGIN, bottom: 16 },
    alternateRowStyles: { fillColor: C.slate50 },
    styles: {
      font: 'helvetica',
      overflow: 'ellipsize' as const,
      valign: 'middle' as const,
      halign: 'center' as const,
    },
    didParseCell: (cellData: {
      section: string;
      column: { index: number };
      row: { index: number };
      cell: { raw: unknown; styles: Record<string, unknown> };
    }) => {
      cellData.cell.styles.halign = 'center';
      cellData.cell.styles.overflow = 'ellipsize';
      cellData.cell.styles.valign = 'middle';

      if (cellData.section === 'head') {
        cellData.cell.styles.halign = 'center';
        return;
      }

      cellData.cell.styles.cellPadding = { top: bodyPad, bottom: bodyPad, left: 4, right: 4 };

      if (textCols.has(cellData.column.index)) {
        cellData.cell.styles.font = 'Amiri';
      }

      if (amountCols.has(cellData.column.index)) {
        cellData.cell.styles.font = 'helvetica';
        cellData.cell.styles.fontStyle = 'bold';
        cellData.cell.styles.textColor = C.emerald600;
      }

      if (cellData.column.index === 0) {
        const rank = parseInt(String(cellData.cell.raw), 10);
        cellData.cell.styles.font = 'helvetica';
        cellData.cell.styles.fontStyle = 'bold';
        if (rank === 1) {
          cellData.cell.styles.fillColor = [254, 243, 199];
          cellData.cell.styles.textColor = [146, 64, 14];
        } else if (rank === 2) {
          cellData.cell.styles.fillColor = [241, 245, 249];
          cellData.cell.styles.textColor = [71, 85, 105];
        } else if (rank === 3) {
          cellData.cell.styles.fillColor = [255, 237, 213];
          cellData.cell.styles.textColor = [154, 52, 18];
        }
      }

      if (negativeCols.has(cellData.column.index)) {
        const raw = String(cellData.cell.raw ?? '');
        const num = parseFloat(raw.replace(/[^0-9.-]/g, ''));
        if (num < 0 || raw.startsWith('-')) {
          cellData.cell.styles.fillColor = [254, 226, 226];
          cellData.cell.styles.textColor = [185, 28, 28];
          cellData.cell.styles.fontStyle = 'bold';
        }
      }

      const compareCol = section.head[cellData.column.index];
      if (compareCol === 'vs Compare' || compareCol === 'Change %') {
        const raw = String(cellData.cell.raw ?? '');
        if (raw.startsWith('+')) {
          cellData.cell.styles.textColor = C.emerald600;
          cellData.cell.styles.fontStyle = 'bold';
        }
      }
    },
  };

  if (typeof (doc as { autoTable?: (opts: unknown) => void }).autoTable === 'function') {
    (doc as { autoTable: (opts: unknown) => void }).autoTable(tableOptions);
  } else {
    autoTable(doc, tableOptions);
  }
}

export async function generateSalesReports(input: SalesReportsInput): Promise<Blob> {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  const { data, compareBlock, compareLabel, customerView, filters } = input;
  const customerViewLabel = customerView === 'main' ? 'Main Customer' : 'Sub Customer';
  const reportingMode = resolveReportingMode(filters.invoiceType ?? data.reportingMode);
  const tableSections = buildTableSections(
    data,
    compareBlock,
    compareLabel,
    customerViewLabel,
    reportingMode
  );
  const totalPages = 3 + tableSections.length;

  const doc = new jsPDF('l', 'mm', 'a4');
  await addArabicFont(doc);

  drawCoverPage(doc, data, input);
  drawPageFooter(doc, 1, totalPages, data.periodLabel);

  doc.addPage('a4', 'landscape');
  drawKpiPage(doc, data, input);
  drawPageFooter(doc, 2, totalPages, data.periodLabel);

  doc.addPage('a4', 'landscape');
  drawMonthlyChartPage(doc, data, input.compareMode, input);
  drawPageFooter(doc, 3, totalPages, data.periodLabel);

  tableSections.forEach((section, i) => {
    doc.addPage('a4', 'landscape');
    drawTablePage(doc, autoTable, section);
    drawPageFooter(doc, 4 + i, totalPages, data.periodLabel);
  });

  return doc.output('blob');
}
