import React from 'react';

interface ReceiptDocumentProps {
  data: {
    receiptNumber?: string;
    date?: string;
    receivedFrom?: string;
    sendBy?: string;
    amount?: string | number | null;
    amountInWords?: string;
    reason?: string;
  };
  isCopy?: boolean;
  receivedBySignature?: string;
  mode?: 'print' | 'preview';
}

const C = {
  white: '#ffffff',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray900: '#111827',
  black: '#000000',
};

function IconHash({ size = 16, color = C.gray600 }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  );
}

function IconCalendar({ size = 16, color = C.gray600 }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconUser({ size = 20, color = C.gray700 }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconDollar({ size = 20, color = C.gray700 }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function IconFile({ size = 20, color = C.gray700 }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

export default function ReceiptDocument({
  data,
  isCopy = false,
  receivedBySignature,
  mode = 'print',
}: ReceiptDocumentProps) {
  const isPreview = mode === 'preview';

  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        width: isPreview ? '100%' : '210mm',
        maxWidth: '100%',
        minHeight: isPreview ? 'auto' : '297mm',
        backgroundColor: C.white,
        color: C.gray900,
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {isCopy && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.03,
            pointerEvents: 'none',
            zIndex: 0,
            transform: 'rotate(-45deg)',
            userSelect: 'none',
          }}
        >
          <span style={{ fontSize: '200px', fontWeight: 900, color: C.gray900, lineHeight: 1 }}>COPY</span>
        </div>
      )}

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div
          style={{
            backgroundColor: C.gray900,
            color: C.white,
            padding: isPreview ? '20px 24px' : '32px',
            width: '100%',
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px 16px',
              width: '100%',
            }}
          >
            <h1
              style={{
                fontSize: isPreview ? '15px' : '20px',
                fontWeight: 700,
                letterSpacing: '-0.025em',
                margin: 0,
                flex: '1 1 220px',
                minWidth: 0,
                lineHeight: 1.3,
              }}
            >
              Al Marai Al Arabia Trading Sole Proprietorship L.L.C
            </h1>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '12px',
                flexShrink: 0,
                flexWrap: 'nowrap',
                marginLeft: 'auto',
                whiteSpace: 'nowrap',
              }}
            >
              <div style={{ fontSize: isPreview ? '22px' : '30px', fontWeight: 700, lineHeight: 1 }}>RECEIPT</div>
              <div style={{ fontSize: '12px', letterSpacing: '0.1em', opacity: 0.75, lineHeight: 1 }}>CASH PAYMENT</div>
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: C.gray100,
            padding: '16px 32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: `2px solid ${C.gray900}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconHash />
            <span style={{ fontSize: '14px', fontWeight: 600, color: C.gray900 }}>Receipt No:</span>
            <span style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 700, color: C.gray900 }}>
              {data.receiptNumber || '---'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconCalendar />
            <span style={{ fontSize: '14px', fontWeight: 600, color: C.gray900 }}>Date:</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: C.gray900 }}>{data.date || '---'}</span>
          </div>
        </div>

        <div style={{ padding: '32px' }}>
          <Row label="Received From:" icon={<IconUser />} value={data.receivedFrom} />
          <Row label="Send By:" icon={<IconUser />} value={data.sendBy} />

          <div
            style={{
              backgroundColor: C.gray50,
              padding: '24px',
              borderRadius: '8px',
              border: `2px solid ${C.gray900}`,
              marginBottom: '24px',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: C.gray700 }}>
                <IconDollar />
                <span style={{ fontWeight: 600 }}>Amount:</span>
              </div>
              <div style={{ fontSize: '30px', fontWeight: 700, color: C.gray900 }}>
                {data.amount
                  ? `AED ${parseFloat(String(data.amount)).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                  : '0.00'}
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 2fr',
                gap: '16px',
                alignItems: 'center',
                paddingTop: '16px',
                borderTop: `1px solid ${C.gray300}`,
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 600, color: C.gray700 }}>Amount in Words:</div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: C.gray900, fontStyle: 'italic', minHeight: '24px' }}>
                {data.amountInWords}
              </div>
            </div>
          </div>

          <Row label="Payment For:" icon={<IconFile />} value={data.reason} valueSize="18px" />

          <div style={{ marginTop: '48px', paddingTop: '32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
            {!isCopy ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: '8px', fontSize: '14px', color: C.gray600, fontWeight: 600 }}>Payer&apos;s Signature</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: C.gray900, marginBottom: '16px' }}>{data.receivedFrom}</div>
              </div>
            ) : (
              <div />
            )}

            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ marginBottom: '8px', fontSize: '14px', color: C.gray600, fontWeight: 600 }}>Received By</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: C.gray900, marginBottom: '8px' }}>Mohamed Sabry</div>
              {receivedBySignature ? (
                <img src={receivedBySignature} alt="Received By Signature" style={{ height: '64px', objectFit: 'contain' }} />
              ) : (
                <div style={{ height: '64px' }} />
              )}
            </div>
          </div>

          {isCopy && (
            <div style={{ marginTop: '48px', paddingTop: '16px', borderTop: `1px solid ${C.gray200}`, textAlign: 'center' }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: C.gray500, margin: 0 }}>True Copy of Original</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  icon,
  value,
  valueSize = '20px',
}: {
  label: string;
  icon: React.ReactNode;
  value?: string;
  valueSize?: string;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 2fr',
        gap: '16px',
        alignItems: 'center',
        paddingBottom: '16px',
        marginBottom: '24px',
        borderBottom: `1px solid ${C.gray200}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: C.gray700 }}>
        {icon}
        <span style={{ fontWeight: 600 }}>{label}</span>
      </div>
      <div>
        <div
          style={{
            fontSize: valueSize,
            fontWeight: label === 'Payment For:' ? 500 : 700,
            color: C.gray900,
            borderBottom: `2px solid ${C.black}`,
            paddingBottom: '4px',
            minHeight: '32px',
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
