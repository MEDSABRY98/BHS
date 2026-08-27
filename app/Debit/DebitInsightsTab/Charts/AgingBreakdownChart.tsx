'use client';

import { useMemo } from 'react';
import {
  ComposedChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AgingBreakdown } from '../Utils/InsightsTypes';

interface AgingBreakdownChartProps {
  breakdown: AgingBreakdown;
  totalDebt?: number;
  forPdf?: boolean;
}

interface AgingChartPoint {
  bucket: string;
  amount: number;
  pct: number;
  fill: string;
  stroke: string;
  hint: string;
}

const BUCKET_META = [
  { key: 'oneToThirty' as const, label: '1-30', fill: '#BEF264', stroke: '#A3E635', hint: 'Early overdue' },
  { key: 'thirtyOneToSixty' as const, label: '31-60', fill: '#FDE68A', stroke: '#FCD34D', hint: 'Moderate risk' },
  { key: 'sixtyOneToNinety' as const, label: '61-90', fill: '#FDBA74', stroke: '#FB923C', hint: 'High risk' },
  { key: 'ninetyOneToOneTwenty' as const, label: '91-120', fill: '#FCA5A5', stroke: '#F87171', hint: 'Critical' },
  { key: 'older' as const, label: 'Older', fill: '#F9A8D4', stroke: '#F472B6', hint: 'Severe overdue' },
];

function formatBarAmount(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


function toNumber(value: string | number | undefined, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function PctDotLabel({
  cx,
  cy,
  index,
  chartData,
}: { cx?: number; cy?: number; index?: number; chartData?: AgingChartPoint[] }) {
  if (index === undefined || !chartData?.[index]) return null;
  const { amount, pct } = chartData[index];
  if (amount <= 0.01) return null;
  const x = cx ?? 0;
  const y = cy ?? 0;
  return (
    <g>
      <text x={x} y={y - 22} textAnchor="middle" fill="#111827" fontSize={13} fontWeight={800}>
        {formatBarAmount(amount)}
      </text>
      <text x={x} y={y - 7} textAnchor="middle" fill="#6366F1" fontSize={12} fontWeight={700}>
        {pct.toFixed(1)}%
      </text>
    </g>
  );
}

export default function AgingBreakdownChart({ breakdown, totalDebt, forPdf = false }: AgingBreakdownChartProps) {
  const chartData = useMemo<AgingChartPoint[]>(() => {
    const total = BUCKET_META.reduce((sum, b) => sum + (breakdown[b.key] || 0), 0);
    return BUCKET_META.map((bucket) => {
      const amount = breakdown[bucket.key] || 0;
      return {
        bucket: bucket.label,
        amount,
        pct: total > 0.01 ? (amount / total) * 100 : 0,
        fill: bucket.fill,
        stroke: bucket.stroke,
        hint: bucket.hint,
      };
    });
  }, [breakdown]);

  const bucketsTotal = useMemo(
    () => chartData.reduce((sum, d) => sum + d.amount, 0),
    [chartData]
  );
  const total = totalDebt ?? bucketsTotal;

  const dotLabel = useMemo(
    () =>
      function DotLabel(props: { cx?: number; cy?: number; index?: number }) {
        return <PctDotLabel {...props} chartData={chartData} />;
      },
    [chartData]
  );

  const renderDot = useMemo(
    () =>
      (props: { cx?: number; cy?: number; index?: number }) => {
        const { cx = 0, cy = 0, index = 0 } = props;
        const point = chartData[index];
        if (!point || point.amount <= 0.01) return <g key={`dot-${index}`} />;
        return (
          <g key={`dot-${index}`}>
            {/* Labels above dot */}
            <text x={cx} y={cy - 50} textAnchor="middle" fill="#111827" fontSize={13} fontWeight={800}>
              {formatBarAmount(point.amount)}
            </text>
            <text x={cx} y={cy - 20} textAnchor="middle" fill="#6366F1" fontSize={14} fontWeight={700}>
              {point.pct.toFixed(1)}%
            </text>
            {/* Dot circle */}
            <circle cx={cx} cy={cy} r={6} fill={point.fill} stroke={point.stroke} strokeWidth={2} />
          </g>
        );
      },
    [chartData]
  );

  const chart = (
    <ResponsiveContainer width="100%" height={forPdf ? 620 : 400}>
      <ComposedChart data={chartData} margin={{ top: 80, right: 80, left: 60, bottom: 12 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
        <XAxis
          dataKey="bucket"
          tick={{ fill: '#374151', fontSize: 14, fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
          interval={0}
          height={56}
          dy={10}
        />
        <YAxis hide />
        {!forPdf && (
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const point = chartData.find((d) => d.bucket === label);
              return (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-md text-sm">
                  <p className="font-semibold text-slate-800 mb-2">{label} — {point?.hint}</p>
                  <p className="flex items-center justify-between gap-6 mt-1">
                    <span className="text-slate-600">Amount</span>
                    <span className="font-semibold text-slate-900">{formatBarAmount(point?.amount ?? 0)}</span>
                  </p>
                  <p className="flex items-center justify-between gap-6 mt-1">
                    <span className="text-slate-600">% of Total</span>
                    <span className="font-semibold text-indigo-600">{(point?.pct ?? 0).toFixed(1)}%</span>
                  </p>
                </div>
              );
            }}
          />
        )}
        <Line
          type="monotone"
          dataKey="pct"
          name="% of Total"
          stroke="#6366F1"
          strokeWidth={2.5}
          dot={renderDot}
          activeDot={{ r: 8, stroke: '#6366F1', strokeWidth: 2, fill: '#fff' }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );

  if (forPdf) {
    return <div style={{ width: '100%', height: 620, backgroundColor: '#ffffff' }}>{chart}</div>;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 h-[500px]">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        Aging Breakdown
        <span className="ml-2 text-gray-400 font-normal">({formatBarAmount(total)})</span>
      </h3>
      {chart}
    </div>
  );
}
