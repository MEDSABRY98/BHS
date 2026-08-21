'use client';

import React from 'react';
import { Calendar, Clock, Database, MapPin, Users, CalendarDays, PieChart } from 'lucide-react';
import type { InsightsFilters } from '../../Utils/InsightsTypes';
import { formatGeneratedDate, formatPeriodLabel, formatSalesSourceLabel, PDF_PAGE_HEIGHT, PDF_PAGE_WIDTH } from '../PdfCaptureUtils';

interface CoverPageProps {
  filters: InsightsFilters;
  generatedAt?: string;
}

function ParamCard({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 20px',
        backgroundColor: '#F8FAFC',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div style={{ padding: '6px', backgroundColor: '#EFF6FF', borderRadius: '8px', color: '#3B82F6' }}>
          <Icon size={16} strokeWidth={2.5} />
        </div>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: '#64748B',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {label}
        </span>
      </div>
      <span
        style={{
          fontSize: '16px',
          fontWeight: 800,
          color: '#0F172A',
          lineHeight: 1.2,
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
  const customerParts: string[] = [];
  if (filters.customers.length > 0) {
    customerParts.push(
      `${filters.customers.length} customer${filters.customers.length === 1 ? '' : 's'}`
    );
  }
  if ((filters.customerTags?.length || 0) > 0) {
    customerParts.push(
      `${filters.customerTags.length} tag${filters.customerTags.length === 1 ? '' : 's'}`
    );
  }
  const customersLabel = customerParts.length > 0 ? customerParts.join(' · ') : 'All Customers';

  return (
    <div
      style={{
        width: `${PDF_PAGE_WIDTH}px`,
        height: `${PDF_PAGE_HEIGHT}px`,
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        backgroundColor: '#F1F5F9',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Premium Dark Header Background */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '360px',
          background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%)',
          overflow: 'hidden',
        }}
      >
        {/* Subtle SVG Grid Pattern */}
        <svg width="100%" height="100%" style={{ position: 'absolute', opacity: 0.04 }}>
          <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#ffffff" strokeWidth="1" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Header Content */}
        <div style={{ padding: '56px 60px', position: 'relative', zIndex: 1 }}>
          <h1
            style={{
              fontSize: '48px',
              fontWeight: 900,
              color: '#ffffff',
              letterSpacing: '-0.02em',
              margin: '0 0 8px',
            }}
          >
            Debit Insights
          </h1>
          <p style={{ fontSize: '18px', color: '#94A3B8', fontWeight: 500, margin: 0 }}>
            Portfolio Analytics Report
          </p>

          <div style={{ marginTop: '36px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '3px', backgroundColor: '#6366F1', borderRadius: '2px' }}></div>
            <p
              style={{
                fontSize: '13px',
                color: '#CBD5E1',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                margin: 0,
              }}
            >
              Generated {generated}
            </p>
          </div>
        </div>
      </div>

      {/* Overlapping Glass/White Card */}
      <div
        style={{
          position: 'absolute',
          top: '250px',
          left: '60px',
          right: '60px',
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          padding: '32px 40px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0,0,0,0.03)',
          zIndex: 10,
        }}
      >
        <h2
          style={{
            fontSize: '18px',
            fontWeight: 800,
            color: '#1E293B',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            margin: '0 0 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <div style={{ color: '#4F46E5', display: 'flex' }}>
            <PieChart size={20} strokeWidth={2.5} />
          </div>
          Report Parameters
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <ParamCard label="As-of Date" value={filters.asOfDate} icon={Calendar} />
          <ParamCard label="Period" value={formatPeriodLabel(filters)} icon={Clock} />
          <ParamCard label="Sales Source" value={formatSalesSourceLabel(filters.salesSource)} icon={Database} />
          {filters.periodPreset === 'custom' && (
            <ParamCard label="Date Range" value={`${filters.periodFrom} – ${filters.periodTo}`} icon={CalendarDays} />
          )}
          <ParamCard label="Cities" value={citiesLabel} icon={MapPin} />
          <ParamCard label="Customers" value={customersLabel} icon={Users} />
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          position: 'absolute',
          bottom: '30px',
          left: '60px',
          right: '60px',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}
      >
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8' }}>Page 1 of 6</div>
      </div>
    </div>
  );
}
