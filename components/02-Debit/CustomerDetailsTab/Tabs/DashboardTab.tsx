import React from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from 'recharts';
import NoData from '../../../01-Unified/NoDataTab';
import { SharedTabProps } from '../Types';
import { isPaymentTxn, getPaymentAmount } from '../Utils';

export default function DashboardTab(props: SharedTabProps) {
  const {
    filteredInvoices,
    totalNetDebt,
    dashboardMetrics,
    agingData,
    monthlyPaymentsTrendData,
    monthlySalesTrendData
  } = props;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {filteredInvoices.length === 0 ? (
        <NoData />
      ) : (
        <>
          {/* Section 0: Last Invoices */}
          <div>
            <h3 className="text-lg font-bold text-gray-700 mb-3 border-b pb-2">Last Invoices</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Last Sale Invoice */}
              {(() => {
                const sales = filteredInvoices.filter(inv => (inv.number || '').toString().toUpperCase().startsWith('SAL'));
                const latestSale = sales.length > 0 ? [...sales].sort((a, b) => {
                  const dateA = a.parsedDate || (a.date ? new Date(a.date) : new Date(0));
                  const dateB = b.parsedDate || (b.date ? new Date(b.date) : new Date(0));
                  return dateB.getTime() - dateA.getTime();
                })[0] : null;

                const latestDate = latestSale?.parsedDate;
                const sameDaySales = latestDate ? sales.filter(inv => {
                  const d = inv.parsedDate || (inv.date ? new Date(inv.date) : null);
                  return d?.getTime() === latestDate.getTime();
                }) : [];
                const totalAmount = sameDaySales.reduce((sum, inv) => sum + inv.debit, 0);

                return (
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-xl shadow-sm border border-blue-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-20">
                      <span className="text-5xl">🛒</span>
                    </div>
                    <h4 className="text-blue-700 text-xs font-bold uppercase tracking-wider mb-2">Last Sale</h4>
                    {latestSale ? (
                      <>
                        <p className="text-sm font-semibold text-blue-900 mb-1">
                          {sameDaySales.length > 1 ? `${sameDaySales.length} Invoices` : latestSale.number}
                        </p>
                        <p className="text-2xl font-bold text-blue-700 mb-1">{totalAmount.toLocaleString('en-US')}</p>
                        <p className="text-xs text-blue-600">
                          {latestDate?.toLocaleDateString('en-GB') || latestSale.date}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-blue-600 italic">No invoices</p>
                    )}
                  </div>
                );
              })()}

              {/* Last Return Invoice */}
              {(() => {
                const returns = filteredInvoices.filter(inv => (inv.number || '').toString().toUpperCase().startsWith('RSAL'));
                const latestReturn = returns.length > 0 ? [...returns].sort((a, b) => {
                  const dateA = a.parsedDate || (a.date ? new Date(a.date) : new Date(0));
                  const dateB = b.parsedDate || (b.date ? new Date(b.date) : new Date(0));
                  return dateB.getTime() - dateA.getTime();
                })[0] : null;

                const latestDate = latestReturn?.parsedDate;
                const sameDayReturns = latestDate ? returns.filter(inv => {
                  const d = inv.parsedDate || (inv.date ? new Date(inv.date) : null);
                  return d?.getTime() === latestDate.getTime();
                }) : [];
                const totalAmount = sameDayReturns.reduce((sum, inv) => sum + inv.credit, 0);

                return (
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-5 rounded-xl shadow-sm border border-orange-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-20">
                      <span className="text-5xl">↩️</span>
                    </div>
                    <h4 className="text-orange-700 text-xs font-bold uppercase tracking-wider mb-2">Last Return</h4>
                    {latestReturn ? (
                      <>
                        <p className="text-sm font-semibold text-orange-900 mb-1">
                          {sameDayReturns.length > 1 ? `${sameDayReturns.length} Returns` : latestReturn.number}
                        </p>
                        <p className="text-2xl font-bold text-orange-700 mb-1">{totalAmount.toLocaleString('en-US')}</p>
                        <p className="text-xs text-orange-600">
                          {latestDate?.toLocaleDateString('en-GB') || latestReturn.date}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-orange-600 italic">No returns</p>
                    )}
                  </div>
                );
              })()}

              {/* Last Payment */}
              {(() => {
                const payments = filteredInvoices.filter(inv => isPaymentTxn(inv));
                const latestPayment = payments.length > 0 ? [...payments].sort((a, b) => {
                  const dateA = a.parsedDate || (a.date ? new Date(a.date) : new Date(0));
                  const dateB = b.parsedDate || (b.date ? new Date(b.date) : new Date(0));
                  return dateB.getTime() - dateA.getTime();
                })[0] : null;

                const latestDate = latestPayment?.parsedDate;
                const sameDayPayments = latestDate ? payments.filter(inv => {
                  const d = inv.parsedDate || (inv.date ? new Date(inv.date) : null);
                  return d?.getTime() === latestDate.getTime();
                }) : [];
                const totalAmount = sameDayPayments.reduce((sum, inv) => sum + getPaymentAmount(inv), 0);

                return (
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-5 rounded-xl shadow-sm border border-green-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-20">
                      <span className="text-5xl">💸</span>
                    </div>
                    <h4 className="text-green-700 text-xs font-bold uppercase tracking-wider mb-2">Last Payment</h4>
                    {latestPayment ? (
                      <>
                        <p className="text-sm font-semibold text-green-900 mb-1">
                          {sameDayPayments.length > 1 ? `${sameDayPayments.length} Payments` : latestPayment.number}
                        </p>
                        <p className="text-2xl font-bold text-green-700 mb-1">{totalAmount.toLocaleString('en-US')}</p>
                        <p className="text-xs text-green-600">
                          {latestDate?.toLocaleDateString('en-GB') || latestPayment.date}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-green-600 italic">No payments</p>
                    )}
                  </div>
                );
              })()}

              {/* Last Discount (BIL) */}
              {(() => {
                const discounts = filteredInvoices.filter(inv => (inv.number || '').toString().toUpperCase().startsWith('BIL'));
                const latestDiscount = discounts.length > 0 ? [...discounts].sort((a, b) => {
                  const dateA = a.parsedDate || (a.date ? new Date(a.date) : new Date(0));
                  const dateB = b.parsedDate || (b.date ? new Date(b.date) : new Date(0));
                  return dateB.getTime() - dateA.getTime();
                })[0] : null;

                const latestDate = latestDiscount?.parsedDate;
                const sameDayDiscounts = latestDate ? discounts.filter(inv => {
                  const d = inv.parsedDate || (inv.date ? new Date(inv.date) : null);
                  return d?.getTime() === latestDate.getTime();
                }) : [];
                const totalAmount = sameDayDiscounts.reduce((sum, inv) => sum + (inv.credit - inv.debit), 0);

                return (
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-5 rounded-xl shadow-sm border border-purple-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-20">
                      <span className="text-5xl">🎁</span>
                    </div>
                    <h4 className="text-purple-700 text-xs font-bold uppercase tracking-wider mb-2">Last Discount</h4>
                    {latestDiscount ? (
                      <>
                        <p className="text-sm font-semibold text-purple-900 mb-1">
                          {sameDayDiscounts.length > 1 ? `${sameDayDiscounts.length} Discounts` : latestDiscount.number}
                        </p>
                        <p className="text-2xl font-bold text-purple-700 mb-1">{totalAmount.toLocaleString('en-US')}</p>
                        <p className="text-xs text-purple-600">
                          {latestDate?.toLocaleDateString('en-GB') || latestDiscount.date}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-purple-600 italic">No discounts</p>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Section 1: Debit Overview */}
          <div>
            <h3 className="text-lg font-bold text-gray-700 mb-3 border-b pb-2">Debit Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Net Outstanding Card */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <span className="text-6xl">💰</span>
                </div>
                <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Net Outstanding</h3>
                <p className={`text-3xl font-bold mt-2 ${totalNetDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {totalNetDebt.toLocaleString('en-US')}
                </p>
                <p className="text-sm text-gray-400 mt-1">Current Balance</p>
              </div>

              {/* Total Payments Card */}
              {(() => {
                const payments = filteredInvoices.filter(inv => isPaymentTxn(inv));
                const totalPayments = payments.reduce((sum, inv) => sum + getPaymentAmount(inv), 0);

                return (
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <span className="text-6xl">💸</span>
                    </div>
                    <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Total Payments</h3>
                    <p className="text-3xl font-bold mt-2 text-green-600">
                      {totalPayments.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">All Time</p>
                  </div>
                );
              })()}

              {/* Average Monthly Payment Card */}
              {(() => {
                const payments = filteredInvoices.filter(inv => isPaymentTxn(inv));
                const totalPayments = payments.reduce((sum, inv) => sum + getPaymentAmount(inv), 0);

                const paymentsByMonth = new Map<string, number>();
                payments.forEach(inv => {
                  if (!inv.date) return;
                  const d = inv.parsedDate || new Date(inv.date);
                  if (isNaN(d.getTime())) return;
                  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                  paymentsByMonth.set(key, (paymentsByMonth.get(key) || 0) + getPaymentAmount(inv));
                });
                const avgMonthlyPayment = paymentsByMonth.size > 0
                  ? totalPayments / paymentsByMonth.size
                  : 0;

                return (
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <span className="text-6xl">📅</span>
                    </div>
                    <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Avg Monthly Payment</h3>
                    <p className="text-3xl font-bold mt-2 text-blue-600">
                      {avgMonthlyPayment.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">{paymentsByMonth.size} Active Months</p>
                  </div>
                );
              })()}

              {/* Payment Frequency Card */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <span className="text-6xl">⏱️</span>
                </div>
                <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Payment Frequency</h3>
                <p className="text-3xl font-bold mt-2 text-purple-600">
                  {dashboardMetrics.avgPaymentInterval > 0
                    ? dashboardMetrics.avgPaymentInterval.toFixed(1)
                    : '-'
                  }
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  {dashboardMetrics.avgPaymentInterval > 0 ? 'Days Between Payments' : 'N/A'}
                </p>
              </div>
            </div>

            {/* Aging Analysis Section - New Requested UI */}
            <div className="bg-white p-8 rounded-xl shadow-md border border-gray-100 mt-6 relative overflow-hidden group">
              <div className="flex flex-col md:flex-row items-center gap-12">
                {/* Header Title */}
                <div className="absolute top-6 left-8 flex items-center gap-3">
                  <div className="w-1.5 h-5 bg-blue-500 rounded-full"></div>
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Aging Analysis</h3>
                </div>

                {/* Left Column: Donut Chart */}
                <div className="w-full md:w-[320px] h-[320px] flex items-center justify-center mt-12 md:mt-6">
                  <div className="relative w-full h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Due', value: agingData.atDate || 0, color: '#4285F4' },
                            { name: '1-30', value: agingData.oneToThirty || 0, color: '#9162E4' },
                            { name: '31-60', value: agingData.thirtyOneToSixty || 0, color: '#F4A100' },
                            { name: '61-90', value: agingData.sixtyOneToNinety || 0, color: '#F06536' },
                            { name: '91-120', value: agingData.ninetyOneToOneTwenty || 0, color: '#D9434E' },
                            { name: '120+', value: agingData.older || 0, color: '#991B1B' }
                          ].filter(d => d.value > 0.01)}
                          cx="50%"
                          cy="50%"
                          innerRadius={85}
                          outerRadius={125}
                          paddingAngle={4}
                          dataKey="value"
                          stroke="none"
                        >
                          {[
                            { color: '#4285F4' },
                            { color: '#9162E4' },
                            { color: '#F4A100' },
                            { color: '#F06536' },
                            { color: '#D9434E' },
                            { color: '#991B1B' }
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total</span>
                      <span className="text-3xl font-black text-slate-800 tabular-nums">
                        {Math.round(agingData.total).toLocaleString('en-US')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Bucket Details & Bars */}
                <div className="flex-1 w-full space-y-7 mt-6">
                  {[
                    { label: '0 - Due Date', value: agingData.atDate, color: '#4285F4' },
                    { label: '1 - 30 Days', value: agingData.oneToThirty, color: '#9162E4' },
                    { label: '31 - 60 Days', value: agingData.thirtyOneToSixty, color: '#F4A100' },
                    { label: '61 - 90 Days', value: agingData.sixtyOneToNinety, color: '#F06536' },
                    { label: '91 - 120 Days', value: agingData.ninetyOneToOneTwenty, color: '#D9434E' },
                    { label: 'Older (120+ Days)', value: agingData.older, color: '#991B1B' }
                  ].map((bucket, idx) => {
                    const percentage = agingData.total > 0 ? (bucket.value / agingData.total) * 100 : 0;
                    return (
                      <div key={idx} className="group/bar relative">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: bucket.color }}></div>
                            <span className="text-lg font-bold text-slate-600">{bucket.label}</span>
                          </div>
                          <div className="flex items-center gap-6">
                            <span className="text-lg font-bold text-sky-500">{percentage.toFixed(1)}%</span>
                            <span className="text-xl font-black tabular-nums text-slate-800 w-[140px] text-right">
                              {bucket.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                        <div className="relative h-2.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100 flex items-center">
                          <div
                            className="h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,0,0,0.05)]"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: bucket.color,
                              boxShadow: `0 0 10px ${bucket.color}20`
                            }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Monthly Payments Trend Chart */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Payments (Last 12 Months)</h3>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthlyPaymentsTrendData}
                    margin={{ top: 30, right: 30, left: 20, bottom: 5 }}
                    barCategoryGap="12%"
                  >
                    <defs>
                      <linearGradient id="colorPaymentsPositive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={1} />
                        <stop offset="50%" stopColor="#34D399" stopOpacity={1} />
                        <stop offset="100%" stopColor="#6EE7B7" stopOpacity={1} />
                      </linearGradient>
                      <linearGradient id="colorPaymentsNegative" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#EC4899" stopOpacity={1} />
                        <stop offset="50%" stopColor="#F472B6" stopOpacity={1} />
                        <stop offset="100%" stopColor="#F9A8D4" stopOpacity={1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.5} />
                    <XAxis
                      dataKey="monthLabel"
                      tick={{ fontSize: 14, fill: '#374151', fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#6B7280' }}
                      tickFormatter={(value) => `${value / 1000}k`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      formatter={(value: number) => value.toLocaleString('en-US')}
                      labelFormatter={(label) => `Month: ${label}`}
                      contentStyle={{
                        borderRadius: '12px',
                        border: 'none',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        padding: '12px',
                        backgroundColor: 'white'
                      }}
                      cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                    />
                    <Bar
                      dataKey="credit"
                      name="Payments"
                      radius={[10, 10, 0, 0]}
                      barSize={58}
                    >
                      {monthlyPaymentsTrendData.map((entry: any, index: number) => {
                        const isPositive = entry.credit >= 0;
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={isPositive ? "url(#colorPaymentsPositive)" : "url(#colorPaymentsNegative)"}
                            stroke="none"
                          />
                        );
                      })}
                      <LabelList
                        dataKey="credit"
                        position="top"
                        formatter={(value: any) => typeof value === 'number' ? value.toLocaleString('en-US') : String(value)}
                        style={{ fontSize: '14px', fill: '#1F2937', fontWeight: 700 }}
                        offset={10}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Section 2: Sales & Performance */}
          <div>
            <h3 className="text-lg font-bold text-gray-700 mb-3 border-b pb-2">Sales Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Sales Card */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <span className="text-6xl">🛒</span>
                </div>
                <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Total Sales</h3>
                <p className="text-2xl font-bold mt-2 text-blue-600">
                  {dashboardMetrics.totalSalesSum.toLocaleString('en-US')}
                </p>
                <p className="text-xs text-gray-400 mt-1">Gross (SAL)</p>
              </div>

              {/* Total Returns Card */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <span className="text-6xl">↩️</span>
                </div>
                <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Total Returns</h3>
                <p className="text-2xl font-bold mt-2 text-red-500">
                  {dashboardMetrics.totalReturnsSum.toLocaleString('en-US')}
                </p>
                <p className="text-xs text-gray-400 mt-1">Returns (RSAL)</p>
              </div>

              {/* Net Sales Card */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <span className="text-6xl">💵</span>
                </div>
                <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Net Sales</h3>
                <p className="text-2xl font-bold mt-2 text-indigo-600">
                  {dashboardMetrics.netSalesSum.toLocaleString('en-US')}
                </p>
                <p className="text-xs text-gray-400 mt-1">Sales - Returns</p>
              </div>

              {/* Avg Monthly Sales Card */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <span className="text-6xl">📅</span>
                </div>
                <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Avg. Monthly</h3>
                <p className="text-2xl font-bold mt-2 text-purple-600">
                  {dashboardMetrics.averageMonthlySales.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-gray-400 mt-1">Net / Active Months</p>
              </div>
            </div>

            {/* Monthly Sales Trend - Moved here */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Net Sales (Last 12 Months)</h3>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthlySalesTrendData}
                    margin={{ top: 30, right: 30, left: 20, bottom: 5 }}
                    barCategoryGap="12%"
                  >
                    <defs>
                      <linearGradient id="colorSalesPositive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={1} />
                        <stop offset="50%" stopColor="#34D399" stopOpacity={1} />
                        <stop offset="100%" stopColor="#6EE7B7" stopOpacity={1} />
                      </linearGradient>
                      <linearGradient id="colorSalesNegative" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#EC4899" stopOpacity={1} />
                        <stop offset="50%" stopColor="#F472B6" stopOpacity={1} />
                        <stop offset="100%" stopColor="#F9A8D4" stopOpacity={1} />
                      </linearGradient>
                      <linearGradient id="barGlowPositive" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
                        <stop offset="50%" stopColor="#34D399" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#10B981" stopOpacity="0.3" />
                      </linearGradient>
                      <linearGradient id="barGlowNegative" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#EC4899" stopOpacity="0.3" />
                        <stop offset="50%" stopColor="#F472B6" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#EC4899" stopOpacity="0.3" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.5} />
                    <XAxis
                      dataKey="monthLabel"
                      tick={{ fontSize: 14, fill: '#374151', fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#6B7280' }}
                      tickFormatter={(value) => `${value / 1000}k`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      formatter={(value: number, name: string, props: any) => {
                        // Always show the original value in tooltip
                        const originalValue = props.payload?.originalDebit ?? value;
                        return originalValue.toLocaleString('en-US');
                      }}
                      labelFormatter={(label) => `Month: ${label}`}
                      contentStyle={{
                        borderRadius: '12px',
                        border: 'none',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        padding: '12px',
                        backgroundColor: 'white'
                      }}
                      cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                    />
                    <Bar
                      dataKey="displayDebit"
                      name="Sales"
                      radius={[10, 10, 0, 0]}
                      barSize={58}
                    >
                      {monthlySalesTrendData.map((entry: any, index: number) => {
                        const isPositive = (entry.originalDebit ?? entry.debit ?? 0) >= 0;
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={isPositive ? "url(#colorSalesPositive)" : "url(#colorSalesNegative)"}
                            stroke="none"
                          />
                        );
                      })}
                      <LabelList
                        dataKey="originalDebit"
                        position="top"
                        formatter={(value: any) => typeof value === 'number' ? value.toLocaleString('en-US') : String(value)}
                        style={{ fontSize: '14px', fill: '#1F2937', fontWeight: 700 }}
                        offset={10}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

        </>
      )}
    </div>
  );
}
