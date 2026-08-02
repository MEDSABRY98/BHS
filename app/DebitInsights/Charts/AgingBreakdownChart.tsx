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
import { AgingBreakdown } from '../Utils/InsightsTypes';

interface AgingBreakdownChartProps {
  breakdown: AgingBreakdown;
}

interface AgingChartPoint {
  bucket: string;
  amount: number;
  fill: string;
  stroke: string;
  hint: string;
}

const BUCKET_META = [
  { key: 'atDate' as const, label: 'Current', fill: '#86EFAC', stroke: '#4ADE80', hint: 'Not overdue' },
  { key: 'oneToThirty' as const, label: '1-30', fill: '#BEF264', stroke: '#A3E635', hint: 'Early overdue' },
  { key: 'thirtyOneToSixty' as const, label: '31-60', fill: '#FDE68A', stroke: '#FCD34D', hint: 'Moderate risk' },
  { key: 'sixtyOneToNinety' as const, label: '61-90', fill: '#FDBA74', stroke: '#FB923C', hint: 'High risk' },
  { key: 'ninetyOneToOneTwenty' as const, label: '91-120', fill: '#FCA5A5', stroke: '#F87171', hint: 'Critical' },
  { key: 'older' as const, label: 'Older', fill: '#F9A8D4', stroke: '#F472B6', hint: 'Severe overdue' },
];

function formatBarAmount(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function AmountBarLabel({
  x = 0,
  y = 0,
  width = 0,
  index,
  chartData,
}: {
  x?: number;
  y?: number;
  width?: number;
  index?: number;
  chartData?: AgingChartPoint[];
}) {
  if (index === undefined || !chartData?.[index]) return null;

  const amount = chartData[index].amount;
  if (amount <= 0.01) return null;

  return (
    <text x={x + width / 2} y={y - 10} textAnchor="middle" fill="#111827" fontSize={15} fontWeight={800}>
      {formatBarAmount(amount)}
    </text>
  );
}

export default function AgingBreakdownChart({ breakdown }: AgingBreakdownChartProps) {
  const chartData = useMemo<AgingChartPoint[]>(
    () =>
      BUCKET_META.map((bucket) => ({
        bucket: bucket.label,
        amount: breakdown[bucket.key],
        fill: bucket.fill,
        stroke: bucket.stroke,
        hint: bucket.hint,
      })),
    [breakdown]
  );

  const amountLabel = useMemo(
    () =>
      function AmountLabel(props: { x?: number; y?: number; width?: number; index?: number }) {
        return <AmountBarLabel {...props} chartData={chartData} />;
      },
    [chartData]
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 h-[500px]">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Aging Breakdown</h3>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData} margin={{ top: 36, right: 20, left: 10, bottom: 12 }}>
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
          <YAxis
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) =>
              new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(value)
            }
          />
          <Tooltip
            formatter={(value: number, _name: string, props: { payload?: { hint?: string; color?: string } }) => [
              value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
              props?.payload?.hint ?? 'Open Amount',
            ]}
            contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
          />
          <Bar dataKey="amount" name="Open Amount" radius={[6, 6, 0, 0]} strokeWidth={1} isAnimationActive={false}>
            {chartData.map((entry) => (
              <Cell key={entry.bucket} fill={entry.fill} stroke={entry.stroke} />
            ))}
            <LabelList dataKey="amount" content={amountLabel} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
