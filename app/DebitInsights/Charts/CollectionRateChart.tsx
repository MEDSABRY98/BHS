'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { YoYTrendPoint } from '../Utils/InsightsTypes';

interface CollectionRateChartProps {
  data: YoYTrendPoint[];
  forPdf?: boolean;
}

function renderMonthTick(props: { x?: number; y?: number; payload?: { value?: string } }) {
  const { x = 0, y = 0, payload } = props;
  const month = String(payload?.value ?? '');

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={16} dy={0} textAnchor="middle" fill="#374151" fontSize={13} fontWeight={600}>
        {month}
      </text>
    </g>
  );
}

function formatAmount(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function SalesCollectionsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-md text-sm">
      <p className="font-semibold text-slate-800 mb-2">{label}</p>
      {payload.map((item) => (
        <p key={item.name} className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-slate-900 font-medium">
              {item.name}
            </span>
          </span>
          <span className="font-semibold text-slate-900">
            {formatAmount(item.value ?? 0)}
          </span>
        </p>
      ))}
    </div>
  );
}

// Removed RateBarLabel

export default function CollectionRateChart({ data, forPdf = false }: CollectionRateChartProps) {
  const chart = (
    <ResponsiveContainer width="100%" height={forPdf ? 400 : 440}>
      <BarChart data={data} barGap="12%" barCategoryGap="18%" margin={{ top: 36, right: 20, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
        <XAxis
          dataKey="monthName"
          tick={renderMonthTick}
          axisLine={false}
          tickLine={false}
          interval={0}
          height={40}
        />
        <YAxis
          tick={{ fill: '#9CA3AF', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) =>
            new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(value)
          }
        />
        {!forPdf && <Tooltip content={<SalesCollectionsTooltip />} />}
        <Legend />
        <Bar
          dataKey="cyNetSales"
          name="Net Sales"
          fill="#6EE7B7"
          stroke="#34D399"
          strokeWidth={1}
          radius={[6, 6, 0, 0]}
          isAnimationActive={false}
        />
        <Bar
          dataKey="cyCollections"
          name="Collections"
          fill="#C4B5FD"
          stroke="#A78BFA"
          strokeWidth={1}
          radius={[6, 6, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );

  if (forPdf) {
    return <div style={{ width: '100%', height: 400, backgroundColor: '#ffffff' }}>{chart}</div>;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 h-[500px]">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Sales & Collections (Current Year)</h3>
      {chart}
    </div>
  );
}
