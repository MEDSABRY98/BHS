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
import { InsightsTrendPoint } from '../Utils/InsightsTypes';

interface SalesCollectionsChartProps {
  data: InsightsTrendPoint[];
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

function createNetSalesLabel(chartData: InsightsTrendPoint[]) {
  const boxWidth = Math.max(
    72,
    ...chartData.map((point) => formatNetSalesBoxAmount(point.netSales).length * 7.5 + 18)
  );

  return function NetSalesLabel({ x, width, index }: NetSalesLabelProps) {
    if (index === undefined || !chartData[index]) return null;

    const posX = toNumber(x);
    const barWidth = toNumber(width);
    const netSales = chartData[index].netSales;
    const centerX = posX + barWidth * 1.56;
    const boxX = centerX - boxWidth / 2;

    return (
      <g>
        <rect
          x={boxX}
          y={NET_SALES_BOX_Y}
          width={boxWidth}
          height={NET_SALES_BOX_HEIGHT}
          rx={6}
          fill="#ECFDF5"
          stroke="#34D399"
          strokeWidth={1.25}
        />
        <text
          x={centerX}
          y={NET_SALES_BOX_Y + NET_SALES_BOX_HEIGHT / 2 + 5}
          textAnchor="middle"
          fill="#065F46"
          fontSize={13}
          fontWeight={700}
        >
          {formatNetSalesBoxAmount(netSales)}
        </text>
      </g>
    );
  };
}

function SalesCollectionsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; payload?: InsightsTrendPoint }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;
  const netSales = point?.netSales ?? 0;
  const collections = point?.collections ?? 0;
  const collectionRate =
    netSales > 0.01 ? (collections / netSales) * 100 : null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-md text-sm">
      <p className="font-semibold text-slate-800 mb-2">{label}</p>
      {payload.map((item) => (
        <p key={item.name} className="flex items-center justify-between gap-4 text-slate-600">
          <span className="inline-flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.name}
          </span>
          <span className="font-medium text-slate-900">{formatAmount(item.value ?? 0)}</span>
        </p>
      ))}
      <p className="mt-2 pt-2 border-t border-slate-100 text-slate-700">
        <span className="font-medium">Collection Rate: </span>
        <span className="font-semibold text-indigo-700">
          {collectionRate === null ? 'N/A' : `${collectionRate.toFixed(1)}%`}
        </span>
      </p>
    </div>
  );
}

export default function SalesCollectionsChart({ data, forPdf = false }: SalesCollectionsChartProps) {
  const netSalesLabel = useMemo(() => createNetSalesLabel(data), [data]);

  const chart = (
    <ResponsiveContainer width="100%" height={forPdf ? 620 : 440}>
      <BarChart data={data} barGap="12%" barCategoryGap="18%" margin={{ top: 56, right: 20, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
        <XAxis
          dataKey="monthLabel"
          tick={{ fill: '#374151', fontSize: 13, fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
          interval={0}
          height={64}
          dy={10}
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
          dataKey="netSales"
          name="Net Sales"
          fill="#6EE7B7"
          stroke="#34D399"
          strokeWidth={1}
          radius={[6, 6, 0, 0]}
          isAnimationActive={false}
        >
          <LabelList dataKey="netSales" content={netSalesLabel} />
        </Bar>
        <Bar
          dataKey="collections"
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
    return <div style={{ width: '100%', height: 620, backgroundColor: '#ffffff' }}>{chart}</div>;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 h-[500px]">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Net Sales vs Collections</h3>
      {chart}
    </div>
  );
}
