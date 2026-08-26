'use client';

import { useMemo } from 'react';
import {
  Bar,
  ComposedChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  Line,
} from 'recharts';
import type { Props as RechartsLabelProps } from 'recharts/types/component/Label';
import { YoYTrendPoint } from '../Utils/InsightsTypes';

interface DebtTrendChartProps {
  data: YoYTrendPoint[];
  forPdf?: boolean;
}

function renderMonthTick(props: { x?: number; y?: number; payload?: { value?: string } }) {
  const { x = 0, y = 0, payload } = props;
  const month = String(payload?.value ?? '');

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={14} textAnchor="middle" fill="#374151" fontSize={13} fontWeight={600}>
        {month}
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

function DebtTrendTooltip({
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
      {payload.map((item) => {
        let displayValue = formatBarAmount(item.value ?? 0);
        let nameColor = 'text-slate-500';
        let valColor = 'text-slate-500';
        let isChange = false;

        if (item.name === 'Current Year') {
          nameColor = 'text-slate-900 font-medium';
          valColor = 'text-slate-900 font-semibold';
        } else if (item.name === 'MoM Change') {
          isChange = true;
          nameColor = 'text-amber-600 font-medium';
          const val = item.value ?? 0;
          if (val > 0.01) {
            valColor = 'text-rose-600 font-semibold';
            displayValue = `+${displayValue}`;
          } else if (val < -0.01) {
            valColor = 'text-emerald-600 font-semibold';
          } else {
            valColor = 'text-slate-500 font-semibold';
          }
        }

        return (
          <p key={item.name} className="flex items-center justify-between gap-6 mt-1.5">
            <span className="inline-flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className={nameColor}>{item.name}</span>
            </span>
            <span className={valColor}>{displayValue}</span>
          </p>
        );
      })}
    </div>
  );
}

function createOpenDebtLabel(chartData: YoYTrendPoint[]) {
  return function OpenDebtBarLabel({ x, width, index }: RechartsLabelProps) {
    if (index === undefined || !chartData[index]) return null;

    const amount = chartData[index].cyOpenDebt;
    if (Math.abs(amount) <= 0.01) return null;

    const posX = toNumber(x);
    const barWidth = toNumber(width);
    // Center between the two bars: the first bar ends at posX + barWidth, 
    // we add a small offset to account for barGap.
    const centerX = posX + barWidth * 1.06;

    return (
      <text
        x={centerX}
        y={28}
        textAnchor="middle"
        fill="#1E40AF"
        fontSize={14}
        fontWeight={800}
      >
        {formatBarAmount(amount)}
      </text>
    );
  };
}

export default function DebtTrendChart({ data, forPdf = false }: DebtTrendChartProps) {
  const enrichedData = useMemo(() => {
    return data.map((point, i) => {
      const prevDebt = i > 0 ? data[i - 1].cyOpenDebt : point.cyOpenDebt;
      const momChange = i > 0 ? point.cyOpenDebt - prevDebt : 0;
      return {
        ...point,
        momChange,
      };
    });
  }, [data]);

  const openDebtLabel = useMemo(() => createOpenDebtLabel(enrichedData), [enrichedData]);

  const chart = (
    <ResponsiveContainer width="100%" height={forPdf ? 620 : 420}>
      <ComposedChart data={enrichedData} barGap="12%" barCategoryGap="18%" margin={{ top: 36, right: 30, left: 10, bottom: 8 }}>
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
          yAxisId="left"
          tick={{ fill: '#9CA3AF', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) =>
            new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(value)
          }
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: '#F59E0B', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) =>
            new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short', signDisplay: 'always' }).format(value)
          }
        />
        {!forPdf && <Tooltip content={<DebtTrendTooltip />} />}
        <Legend />
        <Bar
          yAxisId="left"
          dataKey="cyOpenDebt"
          name="Current Year"
          fill="#93C5FD"
          stroke="#60A5FA"
          strokeWidth={1}
          radius={[6, 6, 0, 0]}
          isAnimationActive={false}
        >
          <LabelList dataKey="cyOpenDebt" content={openDebtLabel} />
        </Bar>
        <Bar
          yAxisId="left"
          dataKey="pyOpenDebt"
          name="Previous Year"
          fill="#E2E8F0"
          stroke="#CBD5E1"
          strokeWidth={1}
          radius={[6, 6, 0, 0]}
          isAnimationActive={false}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="momChange"
          name="MoM Change"
          stroke="#F59E0B"
          strokeWidth={2}
          dot={{ r: 4, fill: '#F59E0B', stroke: '#fff', strokeWidth: 1 }}
          activeDot={{ r: 6 }}
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
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Debt Trend</h3>
      {chart}
    </div>
  );
}
