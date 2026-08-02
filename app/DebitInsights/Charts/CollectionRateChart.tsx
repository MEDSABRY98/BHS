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
import { InsightsTrendPoint } from '../Utils/InsightsTypes';

interface CollectionRateChartProps {
  data: InsightsTrendPoint[];
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
        <span>Net Sales</span>
        <span className="font-medium text-slate-900">{formatAmount(point.netSales)}</span>
      </p>
      <p className="mt-1 flex items-center justify-between gap-4 text-slate-600">
        <span>Collections</span>
        <span className="font-medium text-slate-900">{formatAmount(point.collections)}</span>
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

function RateBarLabel(props: { x?: number; y?: number; width?: number; value?: number; index?: number; chartData?: CollectionRatePoint[] }) {
  const { x = 0, y = 0, width = 0, index, chartData } = props;
  if (index === undefined || !chartData?.[index]) return null;

  const point = chartData[index];
  if (!point.hasRate) return null;

  return (
    <text x={x + width / 2} y={y - 10} textAnchor="middle" fill="#4338CA" fontSize={15} fontWeight={800}>
      {`${point.collectionRate.toFixed(1)}%`}
    </text>
  );
}

function resolveCollectionRate(netSales: number, collections: number): Pick<CollectionRatePoint, 'collectionRate' | 'hasRate'> {
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

export default function CollectionRateChart({ data }: CollectionRateChartProps) {
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

  const rateLabel = useMemo(
    () =>
      function RateLabel(props: { x?: number; y?: number; width?: number; value?: number; index?: number }) {
        return <RateBarLabel {...props} chartData={chartData} />;
      },
    [chartData]
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 h-[500px]">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Collection Rate (Monthly)</h3>
      <ResponsiveContainer width="100%" height={440}>
        <BarChart data={chartData} barCategoryGap="18%" margin={{ top: 36, right: 20, left: 10, bottom: 20 }}>
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
            tickFormatter={(value) => `${value}%`}
            domain={[0, 'auto']}
          />
          <Tooltip content={<CollectionRateTooltip />} />
          <Bar
            dataKey="collectionRate"
            name="Collection Rate"
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
            <LabelList dataKey="collectionRate" content={rateLabel} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
