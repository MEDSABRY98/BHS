'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { InsightsTrendPoint } from '../Utils/InsightsTypes';

interface DebtTrendChartProps {
  data: InsightsTrendPoint[];
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

export default function DebtTrendChart({ data }: DebtTrendChartProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 h-[500px]">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Debt Trend (Monthly)</h3>
      <ResponsiveContainer width="100%" height={420}>
        <BarChart data={data} barCategoryGap="18%" margin={{ top: 10, right: 20, left: 10, bottom: 8 }}>
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
          <Tooltip
            formatter={(value: number) =>
              value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            }
            contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
          />
          <Bar
            dataKey="openDebt"
            name="Open Debt"
            fill="#93C5FD"
            stroke="#60A5FA"
            strokeWidth={1}
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
