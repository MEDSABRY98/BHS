'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface PaymentTDashboardTabProps {
  dashboardData: any;
  chartPeriodType: 'weekly' | 'monthly';
  setChartPeriodType: (type: 'weekly' | 'monthly') => void;
  chartYear: string;
  setChartYear: (year: string) => void;
  chartMonth: string;
  setChartMonth: (month: string) => void;
  averageCollections: any;

  dateFrom: string;
  dateTo: string;
}

const statCards = [
  { label: 'Total Collections', key: 'totalCollections', format: 'currency' },
  { label: 'Net Payment Count', key: 'netPaymentCount', format: 'number' },
  { label: 'Avg Monthly', key: 'averageMonthly', source: 'avg', format: 'currency' },
  { label: 'Avg Weekly', key: 'averageWeekly', source: 'avg', format: 'currency' },
] as const;

const PaymentTDashboardTab: React.FC<PaymentTDashboardTabProps> = ({
  dashboardData,
  averageCollections,
}) => {
  const currentYear = dashboardData.currentYear ?? new Date().getFullYear();
  const previousYear = dashboardData.previousYear ?? currentYear - 1;

  const getValue = (card: typeof statCards[number]) => {
    if ('source' in card && card.source === 'avg') {
      return averageCollections[card.key];
    }
    return dashboardData.totals[card.key];
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{card.label}</p>
            <p className="text-xl font-bold text-gray-900">
              {getValue(card).toLocaleString('en-US', {
                minimumFractionDigits: card.format === 'currency' ? 2 : 0,
                maximumFractionDigits: card.format === 'currency' ? 2 : 0,
              })}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 h-[680px]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-gray-900">
            Collections — Monthly ({currentYear} vs {previousYear})
          </h3>
        </div>

        <ResponsiveContainer width="100%" height={580}>
          <BarChart
            data={dashboardData.chartData}
            barGap="15%"
            barCategoryGap="15%"
            margin={{ top: 40, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis
              dataKey="periodLabel"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#6B7280', fontSize: 12 }}
              height={70}
              interval={0}
              dy={15}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              tickFormatter={(value) =>
                new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(value)
              }
            />
            <Tooltip
              cursor={{ fill: '#F9FAFB' }}
              contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              formatter={(value: number, name: string, props: any) => {
                const rowData = props?.payload || {};
                if (name === String(currentYear)) {
                  return [
                    <div key="custom-tooltip">
                      <div className="text-gray-900 text-base font-bold">{new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}</div>
                      <div className="text-xs mt-1 text-gray-500">
                        {rowData.paymentCount || 0} Payments / {rowData.customerCount || 0} Customers
                      </div>
                    </div>,
                    String(currentYear)
                  ];
                }
                if (name === String(previousYear)) {
                  return [
                    new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value),
                    String(previousYear)
                  ];
                }
                return value;
              }}
            />
            <Legend verticalAlign="top" height={36} />
            <Bar
              dataKey="displayCollections"
              name={String(currentYear)}
              fill="#374151"
              radius={[4, 4, 0, 0]}
              barSize={32}
              label={{
                position: 'top',
                fill: '#374151',
                fontSize: 12,
                fontWeight: 600,
                dy: -10,
                formatter: (val: any) => val > 0 ? new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(Number(val)) : ''
              }}
            />
            <Bar
              dataKey="lastYearCollections"
              name={String(previousYear)}
              fill="#D1D5DB"
              radius={[4, 4, 0, 0]}
              barSize={32}
              label={{
                position: 'top',
                fill: '#6B7280',
                fontSize: 11,
                fontWeight: 500,
                dy: -10,
                formatter: (val: any) => val > 0 ? new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(Number(val)) : ''
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PaymentTDashboardTab;
