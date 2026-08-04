'use client';

import type { InsightsFilters } from '../../Utils/InsightsTypes';
import { formatGeneratedDate, formatPeriodLabel, formatSalesSourceLabel, PDF_PAGE_HEIGHT, PDF_PAGE_WIDTH } from '../PdfCaptureUtils';

interface CoverPageProps {
  filters: InsightsFilters;
  generatedAt?: string;
}

function ParamRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 0',
        borderBottom: '1px solid #E5E7EB',
      }}
    >
      <span
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: '#6B7280',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: '15px',
          fontWeight: 700,
          color: '#111827',
          textAlign: 'right',
          maxWidth: '60%',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function summarizeList(items: string[], emptyLabel: string): string {
  if (items.length === 0) return emptyLabel;
  if (items.length <= 3) return items.join(', ');
  return `${items.slice(0, 3).join(', ')} +${items.length - 3} more`;
}

export default function CoverPage({ filters, generatedAt }: CoverPageProps) {
  const generated = generatedAt ?? formatGeneratedDate();
  const citiesLabel = summarizeList(filters.salesRep, 'All Cities');
  const customersLabel =
    filters.customers.length === 0
      ? 'All Customers'
      : `${filters.customers.length} customer${filters.customers.length === 1 ? '' : 's'} selected`;

  return (
    <div
      style={{
        width: `${PDF_PAGE_WIDTH}px`,
        height: `${PDF_PAGE_HEIGHT}px`,
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        backgroundColor: '#ffffff',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #4F46E5 0%, #1D4ED8 100%)',
          padding: '48px 48px 40px',
          color: '#ffffff',
          flexShrink: 0,
        }}
      >
        <p
          style={{
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            opacity: 0.85,
            margin: '0 0 12px',
          }}
        >
          Al Marai Al Arabia Trading
        </p>
        <h1
          style={{
            fontSize: '36px',
            fontWeight: 900,
            margin: '0 0 10px',
            lineHeight: 1.15,
          }}
        >
          Debit Insights
        </h1>
        <p style={{ fontSize: '16px', fontWeight: 500, margin: 0, opacity: 0.9 }}>
          Portfolio analytics report
        </p>
        <p style={{ fontSize: '13px', fontWeight: 600, margin: '18px 0 0', color: '#A5B4FC' }}>
          Generated {generated}
        </p>
      </div>

      <div
        style={{
          flex: 1,
          padding: '36px 48px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <h2
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: '#4F46E5',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            margin: '0 0 8px',
          }}
        >
          Report Parameters
        </h2>
        <div
          style={{
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '16px',
            padding: '8px 28px',
          }}
        >
          <ParamRow label="As-of Date" value={filters.asOfDate} />
          <ParamRow label="Period" value={formatPeriodLabel(filters)} />
          <ParamRow label="Sales Source" value={formatSalesSourceLabel(filters.salesSource)} />
          {filters.periodPreset === 'custom' && (
            <ParamRow label="Date Range" value={`${filters.periodFrom} – ${filters.periodTo}`} />
          )}
          <ParamRow label="Cities" value={citiesLabel} />
          <ParamRow label="Customers" value={customersLabel} />
        </div>
      </div>

      <div
        style={{
          padding: '16px 48px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          borderTop: '1px solid #E5E7EB',
        }}
      >
        <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0, fontWeight: 500 }}>
          Confidential — Internal use only
        </p>
        <p style={{ fontSize: '11px', color: '#6B7280', margin: 0, fontWeight: 600 }}>
          Page 1 of 6
        </p>
      </div>
    </div>
  );
}
