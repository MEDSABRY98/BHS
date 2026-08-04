'use client';

import type { DebitInsightsMetrics, InsightsFilters } from '../../Utils/InsightsTypes';
import { formatGeneratedDate, formatPeriodLabel } from '../PdfCaptureUtils';
import PdfPageShell from '../PdfPageShell';

interface KpiPageProps {
  metrics: DebitInsightsMetrics;
  filters: InsightsFilters;
  pageNumber?: number;
  totalPages?: number;
  generatedAt?: string;
}

function formatCurrency(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function KpiCard({
  label,
  value,
  hint,
  accent,
  badge,
}: {
  label: string;
  value: string;
  hint: string;
  accent: string;
  badge?: { text: string; good: boolean } | null;
}) {
  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #E5E7EB',
        borderRadius: '14px',
        padding: '20px 18px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '160px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '4px',
          borderRadius: '2px',
          backgroundColor: accent,
          marginBottom: '14px',
        }}
      />
      <p
        style={{
          fontSize: '11px',
          fontWeight: 700,
          color: '#6B7280',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          margin: '0 0 10px',
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: '26px',
          fontWeight: 800,
          color: '#111827',
          margin: 0,
          lineHeight: 1.15,
          wordBreak: 'break-word',
        }}
      >
        {value}
      </p>
      {badge ? (
        <p
          style={{
            display: 'inline-block',
            marginTop: '10px',
            padding: '4px 10px',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: 700,
            backgroundColor: badge.good ? '#ECFDF5' : '#FFF1F2',
            color: badge.good ? '#059669' : '#E11D48',
            alignSelf: 'flex-start',
          }}
        >
          {badge.text}
        </p>
      ) : null}
      <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 'auto 0 0', paddingTop: '12px' }}>
        {hint}
      </p>
    </div>
  );
}

export default function KpiPage({
  metrics,
  filters,
  pageNumber = 2,
  totalPages = 6,
  generatedAt,
}: KpiPageProps) {
  const generated = generatedAt ?? formatGeneratedDate();
  const monthCount = metrics.trendSeries.length;
  const avgMonthlyNetSales = monthCount > 0 ? metrics.period.netSales / monthCount : 0;
  const avgMonthlyCollections = monthCount > 0 ? metrics.period.collections / monthCount : 0;
  const periodMonthsLabel = monthCount === 1 ? '1 month in period' : `${monthCount} months in period`;

  const yoy = metrics.period.netSalesYoYChange;
  const yoyBadge =
    yoy === null
      ? null
      : {
          text: `${yoy >= 0 ? '+' : ''}${yoy.toFixed(1)}% vs same period LY`,
          good: yoy >= 0,
        };

  const cards = [
    {
      label: 'Open Debt (as-of)',
      value: formatCurrency(metrics.totalOpenDebt),
      hint: 'Open balances with aging logic',
      accent: '#3B82F6',
      badge: null as { text: string; good: boolean } | null,
    },
    {
      label: 'Net Sales (period)',
      value: formatCurrency(metrics.period.netSales),
      hint: 'SAL − RSAL only',
      accent: '#10B981',
      badge: yoyBadge,
    },
    {
      label: 'Avg Monthly Net Sales',
      value: formatCurrency(avgMonthlyNetSales),
      hint: periodMonthsLabel,
      accent: '#14B8A6',
      badge: null,
    },
    {
      label: 'Collections (period)',
      value: formatCurrency(metrics.period.collections),
      hint: 'Payment / R-Payment net',
      accent: '#8B5CF6',
      badge: null,
    },
    {
      label: 'Avg Monthly Collections',
      value: formatCurrency(avgMonthlyCollections),
      hint: periodMonthsLabel,
      accent: '#A855F7',
      badge: null,
    },
    {
      label: 'Collection Rate',
      value:
        metrics.period.collectionRate === null
          ? 'N/A'
          : `${metrics.period.collectionRate.toFixed(1)}%`,
      hint: 'Collections / Net Sales',
      accent: '#6366F1',
      badge: null,
    },
  ];

  return (
    <PdfPageShell
      title="Key Performance Indicators"
      subtitle={`${formatPeriodLabel(filters)}  ·  As of ${filters.asOfDate}`}
      pageNumber={pageNumber}
      totalPages={totalPages}
      generatedAt={generated}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '18px',
          flex: 1,
          alignContent: 'center',
        }}
      >
        {cards.map((card) => (
          <KpiCard key={card.label} {...card} />
        ))}
      </div>
    </PdfPageShell>
  );
}
