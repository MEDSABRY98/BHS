'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Props as RechartsLabelProps } from 'recharts/types/component/Label';
import { InsightsTrendPoint } from '../Utils/InsightsTypes';

interface DebtTrendChartProps {
  data: InsightsTrendPoint[];
  forPdf?: boolean;
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

function toNumber(value: string | number | undefined, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function formatBarAmount(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function OpenDebtBarLabel({ x, y, width, value }: RechartsLabelProps) {
  const amount = toNumber(value as string | number | undefined);
  if (Math.abs(amount) <= 0.01) return null;

  const posX = toNumber(x);
  const posY = toNumber(y);
  const barWidth = toNumber(width);

  return (
    <text
      x={posX + barWidth / 2}
      y={posY - 10}
      textAnchor="middle"
      fill="#1E40AF"
      fontSize={14}
      fontWeight={800}
    >
      {formatBarAmount(amount)}
    </text>
  );
}

export default function DebtTrendChart({ data, forPdf = false }: DebtTrendChartProps) {
  const chart = (
    <ResponsiveContainer width="100%" height={forPdf ? 620 : 420}>
      <BarChart data={data} barCategoryGap="18%" margin={{ top: 36, right: 20, left: 10, bottom: 8 }}>
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
        {!forPdf && (
          <Tooltip
            formatter={(value: number) =>
              value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            }
            contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
          />
        )}
        <Bar
          dataKey="openDebt"
          name="Open Debt"
          fill="#93C5FD"
          stroke="#60A5FA"
          strokeWidth={1}
          radius={[6, 6, 0, 0]}
          isAnimationActive={false}
        >
          <LabelList dataKey="openDebt" content={OpenDebtBarLabel} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );

  if (forPdf) {
    return <div style={{ width: '100%', height: 620, backgroundColor: '#ffffff' }}>{chart}</div>;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 h-[500px]">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Debt Trend (Monthly)</h3>
      {chart}
    </div>
  );
}
