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
  averageCollectionDays: any;
  dateFrom: string;
  dateTo: string;
}

const PaymentTDashboardTab: React.FC<PaymentTDashboardTabProps> = ({
  dashboardData,
  chartPeriodType,
  setChartPeriodType,
  chartYear,
  setChartYear,
  chartMonth,
  setChartMonth,
  averageCollections,
  averageCollectionDays,
  dateFrom,
  dateTo,
}) => {
  return (
    <div className="space-y-6 animate-fadeIn pb-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="bg-white/90 backdrop-blur-md p-6 rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white hover:shadow-md transition-all duration-300">
          <h3 className="text-gray-500 font-medium mb-2 text-sm uppercase tracking-wider">Total Collections</h3>
          <div className="text-2xl font-bold text-green-600">
            {dashboardData.totals.totalCollections.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md p-6 rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white hover:shadow-md transition-all duration-300">
          <h3 className="text-gray-500 font-medium mb-2 text-sm uppercase tracking-wider">Net Payment Count</h3>
          <div className="text-2xl font-bold text-blue-600">
            {dashboardData.totals.netPaymentCount.toLocaleString('en-US')}
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md p-6 rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white hover:shadow-md transition-all duration-300">
          <h3 className="text-gray-500 font-medium mb-2 text-sm uppercase tracking-wider">Avg Monthly</h3>
          <div className="text-2xl font-bold text-teal-600">
            {averageCollections.averageMonthly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md p-6 rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white hover:shadow-md transition-all duration-300">
          <h3 className="text-gray-500 font-medium mb-2 text-sm uppercase tracking-wider">Avg Weekly</h3>
          <div className="text-2xl font-bold text-cyan-600">
            {averageCollections.averageWeekly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md p-6 rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white hover:shadow-md transition-all duration-300">
          <h3 className="text-gray-500 font-medium mb-2 text-sm uppercase tracking-wider">Avg Coll. Days</h3>
          <div className="text-2xl font-bold text-orange-600">
            {averageCollectionDays.averageDays > 0 ? averageCollectionDays.averageDays.toFixed(1) : '0.0'} days
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white/90 backdrop-blur-md p-8 rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white h-[760px]">
        <div className="flex flex-col items-center gap-4 mb-8">
          <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">
            Collections - {
              chartPeriodType === 'weekly' ? 'Weekly Trend' : 'Monthly Trend'
            }
          </h3>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="flex gap-1 p-1 bg-gray-100/50 rounded-2xl border border-gray-100 shadow-inner">
              <button
                onClick={() => setChartPeriodType('monthly')}
                className={`px-5 py-2 rounded-xl font-bold transition-all text-xs uppercase tracking-widest ${chartPeriodType === 'monthly'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-400 hover:text-gray-500 hover:bg-white/40'
                  }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setChartPeriodType('weekly')}
                className={`px-5 py-2 rounded-xl font-bold transition-all text-xs uppercase tracking-widest ${chartPeriodType === 'weekly'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-400 hover:text-gray-500 hover:bg-white/40'
                  }`}
              >
                Weekly
              </button>
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={560}>
          <BarChart
            data={dashboardData.chartData.slice(-12)}
            barGap="15%"
            barCategoryGap="15%"
            margin={{
              top: 40,
              right: 30,
              left: 20,
              bottom: 60,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" strokeOpacity={0.6} />
            <XAxis
              dataKey="periodLabel"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#6B7280', fontSize: 13, fontWeight: '700' }}
              height={70}
              interval={0}
              textAnchor="middle"
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
              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)' }}
              itemStyle={{ fontWeight: 'bold' }}
              formatter={(value: number, name: string, props: any) => {
                const rowData = props?.payload || {};
                if (name === 'Net Collections') {
                  return [
                    <div key="custom-tooltip">
                      <div className="text-green-600 text-lg">{new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}</div>
                      <div className="text-[11px] mt-1 text-gray-400 font-medium">
                        {rowData.paymentCount || 0} Payments / {rowData.customerCount || 0} Customers
                      </div>
                    </div>,
                    'Current Year'
                  ];
                }
                if (name === 'Last Year') {
                  return [
                    <div key="custom-tooltip-ly" className="text-blue-600 text-lg">
                      {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}
                    </div>,
                    'Last Year'
                  ];
                }
                return value;
              }}
            />
            <Legend verticalAlign="top" height={36} />

            <Bar
              dataKey="displayCollections"
              name="Net Collections"
              fill="#10B981"
              radius={[6, 6, 0, 0]}
              label={{
                position: 'top',
                fill: '#10B981',
                fontSize: 11,
                fontWeight: 'bold',
                dy: -10,
                formatter: (val: any) => val > 0 ? new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(Number(val)) : ''
              }}
            />
            <Bar
              dataKey="lastYearCollections"
              name="Last Year"
              fill="#3B82F6"
              radius={[6, 6, 0, 0]}
              label={{
                position: 'top',
                fill: '#3B82F6',
                fontSize: 11,
                fontWeight: 'bold',
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
