'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Props as RechartsLabelProps } from 'recharts/types/component/Label';
import { InsightsTrendPoint } from '../Utils/InsightsTypes';

interface CollectionRateChartProps {
  data: InsightsTrendPoint[];
  forPdf?: boolean;
}

interface CollectionRatePoint {
  month: string;
  monthLabel: string;
  netSales: number;
  collections: number;
  collectionRate: number;
  hasRate: boolean;
}

function formatAmount(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderMonthYearTick(props: { x?: number; y?: number; payload?: { value?: string } }) {
  const { x = 0, y = 0, payload } = props;
  const label = String(payload?.value ?? '');
  const parts = label.trim().split(' ');
  const year = parts.pop() ?? '';
  const month = parts.join(' ');

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={14} textAnchor="middle" fill="#374151" fontSize={13} fontWeight={600}>
        {month}
      </text>
      <text x={0} y={0} dy={30} textAnchor="middle" fill="#6B7280" fontSize={12} fontWeight={500}>
        {year}
      </text>
    </g>
  );
}

function CollectionRateTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload?: CollectionRatePoint }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-md text-sm">
      <p className="font-semibold text-slate-800 mb-2">{label}</p>
      <p className="flex items-center justify-between gap-4 text-slate-600">
        <span>Collections</span>
        <span className="font-medium text-slate-900">{formatAmount(point.collections)}</span>
      </p>
      <p className="mt-1 flex items-center justify-between gap-4 text-slate-600">
        <span>Net Sales</span>
        <span className="font-medium text-slate-900">{formatAmount(point.netSales)}</span>
      </p>
      <p className="mt-2 pt-2 border-t border-slate-100 text-slate-700">
        <span className="font-medium">Collection Rate: </span>
        <span className="font-semibold text-indigo-700">
          {point.hasRate ? `${point.collectionRate.toFixed(1)}%` : 'N/A'}
        </span>
      </p>
    </div>
  );
}

function toNumber(value: string | number | undefined, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function AmountAndRateLabel(props: RechartsLabelProps & { chartData?: CollectionRatePoint[] }) {
  const { x, y, width, index, chartData } = props;
  const posX = toNumber(x);
  const posY = toNumber(y);
  const barWidth = toNumber(width);
  if (index === undefined || !chartData?.[index]) return null;

  const point = chartData[index];
  if (Math.abs(point.collections) <= 0.01 && !point.hasRate) return null;

  const centerX = posX + barWidth / 2;

  return (
    <g>
      <text
        x={centerX}
        y={posY - 36}
        textAnchor="middle"
        fill="#B45309"
        fontSize={13}
        fontWeight={800}
      >
        {formatAmount(point.collections)}
      </text>
      <text
        x={centerX}
        y={posY - 10}
        textAnchor="middle"
        fill="#4338CA"
        fontSize={15}
        fontWeight={800}
      >
        {point.hasRate ? `${point.collectionRate.toFixed(1)}%` : 'N/A'}
      </text>
    </g>
  );
}

function resolveCollectionRate(
  netSales: number,
  collections: number
): Pick<CollectionRatePoint, 'collectionRate' | 'hasRate'> {
  if (netSales > 0.01) {
    return {
      collectionRate: (collections / netSales) * 100,
      hasRate: true,
    };
  }
  if (collections > 0.01) {
    return {
      collectionRate: 100,
      hasRate: true,
    };
  }
  return {
    collectionRate: 0,
    hasRate: false,
  };
}

export default function CollectionRateChart({ data, forPdf = false }: CollectionRateChartProps) {
  const chartData = useMemo<CollectionRatePoint[]>(
    () =>
      data.map((point) => ({
        month: point.month,
        monthLabel: point.monthLabel,
        netSales: point.netSales,
        collections: point.collections,
        ...resolveCollectionRate(point.netSales, point.collections),
      })),
    [data]
  );

  const amountRateLabel = useMemo(
    () =>
      function AmountRateLabel(props: RechartsLabelProps) {
        return <AmountAndRateLabel {...props} chartData={chartData} />;
      },
    [chartData]
  );

  const chart = (
    <ResponsiveContainer width="100%" height={forPdf ? 620 : 440}>
      <BarChart data={chartData} barCategoryGap="18%" margin={{ top: 56, right: 20, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
        <XAxis
          dataKey="monthLabel"
          tick={renderMonthYearTick}
          axisLine={false}
          tickLine={false}
          interval={0}
          height={72}
        />
        <YAxis
          tick={{ fill: '#9CA3AF', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) =>
            new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(value)
          }
        />
        {!forPdf && <Tooltip content={<CollectionRateTooltip />} />}
        <Bar
          dataKey="collections"
          name="Collections"
          radius={[6, 6, 0, 0]}
          isAnimationActive={false}
        >
          {chartData.map((point) => (
            <Cell
              key={point.month}
              fill={point.hasRate ? '#C7D2FE' : '#E5E7EB'}
              stroke={point.hasRate ? '#818CF8' : '#D1D5DB'}
              strokeWidth={1}
            />
          ))}
          <LabelList dataKey="collections" content={amountRateLabel} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );

  if (forPdf) {
    return <div style={{ width: '100%', height: 620, backgroundColor: '#ffffff' }}>{chart}</div>;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 h-[500px]">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Collections Amount & Rate (Monthly)</h3>
      {chart}
    </div>
  );
}
