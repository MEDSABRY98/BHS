'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Props as RechartsLabelProps } from 'recharts/types/component/Label';
import { YoYTrendPoint } from '../Utils/InsightsTypes';

interface CollectionsTrendChartProps {
  data: YoYTrendPoint[];
  title?: string;
  forPdf?: boolean;
}

type NetSalesLabelProps = RechartsLabelProps;

function toNumber(value: string | number | undefined, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function formatAmount(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatNetSalesBoxAmount(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toFixed(1)}K`;
  }

  return `${sign}${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

const NET_SALES_BOX_HEIGHT = 30;
const NET_SALES_BOX_Y = 6;

function createCollectionsLabel(chartData: YoYTrendPoint[]) {
  const boxWidth = Math.max(
    72,
    ...chartData.map((point) => formatNetSalesBoxAmount(point.cyCollections).length * 7.5 + 18)
  );

  return function CollectionsLabel({ x, width, index }: NetSalesLabelProps) {
    if (index === undefined || !chartData[index]) return null;

    const posX = toNumber(x);
    const barWidth = toNumber(width);
    const collections = chartData[index].cyCollections;
    const centerX = posX + barWidth / 2;
    const boxX = centerX - boxWidth / 2;

    return (
      <g>
        <rect
          x={boxX}
          y={NET_SALES_BOX_Y}
          width={boxWidth}
          height={NET_SALES_BOX_HEIGHT}
          rx={6}
          fill="#F3F4F6"
          stroke="#9CA3AF"
          strokeWidth={1.25}
        />
        <text
          x={centerX}
          y={NET_SALES_BOX_Y + NET_SALES_BOX_HEIGHT / 2 + 5}
          textAnchor="middle"
          fill="#4B5563"
          fontSize={13}
          fontWeight={700}
        >
          {formatNetSalesBoxAmount(collections)}
        </text>
      </g>
    );
  };
}

function CollectionsTrendTooltip({
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
            <span className={item.name === 'Current Year' ? 'text-slate-900 font-medium' : 'text-slate-500'}>
              {item.name}
            </span>
          </span>
          <span className={`font-semibold ${item.name === 'Current Year' ? 'text-slate-900' : 'text-slate-500'}`}>
            {formatAmount(item.value ?? 0)}
          </span>
        </p>
      ))}
    </div>
  );
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

export default function CollectionsTrendChart({ data, title = 'Collections Trend', forPdf = false }: CollectionsTrendChartProps) {
  const collectionsLabel = useMemo(() => createCollectionsLabel(data), [data]);

  const chart = (
    <ResponsiveContainer width="100%" height={forPdf ? '100%' : 440}>
      <BarChart data={data} barGap="12%" barCategoryGap="18%" margin={{ top: 56, right: 20, left: 10, bottom: 20 }}>
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
        {!forPdf && <Tooltip content={<CollectionsTrendTooltip />} />}
        <Legend />
        <Bar
          dataKey="cyCollections"
          name="Current Year"
          fill="#C4B5FD"
          stroke="#A78BFA"
          strokeWidth={1}
          radius={[6, 6, 0, 0]}
          isAnimationActive={false}
        >
          <LabelList dataKey="cyCollections" content={collectionsLabel} />
        </Bar>
        <Bar
          dataKey="pyCollections"
          name="Previous Year"
          fill="#E2E8F0"
          stroke="#CBD5E1"
          strokeWidth={1}
          radius={[6, 6, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );

  if (forPdf) {
    return (
      <div style={{ width: '100%', height: '100%', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '16px' }}>{title}</h3>
        <div style={{ flex: 1, minHeight: 0 }}>
          {chart}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 h-[500px]">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      {chart}
    </div>
  );
}
