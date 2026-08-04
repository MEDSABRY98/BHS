'use client';

import type { CSSProperties, ReactNode } from 'react';
import { PDF_PAGE_HEIGHT, PDF_PAGE_WIDTH } from './PdfCaptureUtils';

export const pdfPageStyle: CSSProperties = {
  width: `${PDF_PAGE_WIDTH}px`,
  height: `${PDF_PAGE_HEIGHT}px`,
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  backgroundColor: '#ffffff',
  padding: '28px 32px 24px',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

interface PdfPageShellProps {
  title: string;
  subtitle?: string;
  pageNumber: number;
  totalPages: number;
  generatedAt: string;
  children: ReactNode;
}

export default function PdfPageShell({
  title,
  subtitle,
  pageNumber,
  totalPages,
  generatedAt,
  children,
}: PdfPageShellProps) {
  return (
    <div style={pdfPageStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '18px',
          borderBottom: '2px solid #E5E7EB',
          paddingBottom: '14px',
          flexShrink: 0,
        }}
      >
        <div>
          <p
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#4F46E5',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              margin: '0 0 4px',
            }}
          >
            Debit Insights
          </p>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 800,
              color: '#111827',
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {title}
          </h1>
          {subtitle ? (
            <p
              style={{
                fontSize: '13px',
                color: '#6B7280',
                fontWeight: 500,
                margin: '6px 0 0',
              }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '12px', color: '#6B7280', fontWeight: 600, margin: 0 }}>
            Generated {generatedAt}
          </p>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '12px',
          paddingTop: '10px',
          borderTop: '1px solid #E5E7EB',
          flexShrink: 0,
        }}
      >
        <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0, fontWeight: 500 }}>
          Al Marai Al Arabia Trading
        </p>
        <p style={{ fontSize: '11px', color: '#6B7280', margin: 0, fontWeight: 600 }}>
          Page {pageNumber} of {totalPages}
        </p>
      </div>
    </div>
  );
}
