'use client';

import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  LabelList 
} from 'recharts';

// Helper to identify payment transactions consistently
const isPaymentTxn = (inv: { number?: string | null; credit?: number | null }): boolean => {
  const num = (inv.number?.toString() || '').toUpperCase();
  if (num.startsWith('BNK')) return true;
  if (num.startsWith('PBNK')) {
    return (inv.credit || 0) > 0.01;
  }
  if ((inv.credit || 0) <= 0.01) return false;
  return (
    !num.startsWith('SAL') &&
    !num.startsWith('RSAL') &&
    !num.startsWith('JV') &&
    !num.startsWith('OB')
  );
};

const getPaymentAmount = (inv: { credit?: number | null; debit?: number | null }): number => {
  return (inv.credit || 0) - (inv.debit || 0);
};

export async function generateAnalyticalPDF({
  customerName,
  filteredInvoices,
  totalNetDebt,
  dashboardMetrics,
  monthlyPaymentsTrendData,
  monthlySalesTrendData,
  filteredOverdueInvoices
}: {
  customerName: string;
  filteredInvoices: any[];
  totalNetDebt: number;
  dashboardMetrics: any;
  monthlyPaymentsTrendData: any[];
  monthlySalesTrendData: any[];
  filteredOverdueInvoices: any[];
}) {
  try {
    const html2canvas = (await import('html2canvas')).default;
    const jsPDF = (await import('jspdf')).default;
    const ReactDOM = (await import('react-dom/client')).default;
    const React = (await import('react')).default;

    // Create a temporary container
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '-9999px';
    container.style.left = '-9999px';
    container.style.width = '1122px'; // A4 Landscape width at 96 DPI
    container.style.height = '793px';
    container.style.zIndex = '-1000';
    document.body.appendChild(container);

    // Common Style for Report Pages
    const pageStyle: React.CSSProperties = {
      width: '1122px',
      height: '793px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: '#ffffff',
      padding: '30px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column'
    };

    const headerStyle: React.CSSProperties = {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '20px',
      borderBottom: '2px solid #f3f4f6',
      paddingBottom: '15px'
    };

    // PAGE 1 COMPONENT
    const AnalyticalReportPage1 = () => {
      // Calculate date range
      const dates = filteredInvoices
        .map(inv => inv.date ? new Date(inv.date).getTime() : 0)
        .filter(t => t > 0);
      const minDate = dates.length > 0 ? new Date(Math.min(...dates)) : null;
      const maxDate = dates.length > 0 ? new Date(Math.max(...dates)) : null;
      const periodString = minDate && maxDate
        ? `${minDate.toLocaleDateString('en-GB')} - ${maxDate.toLocaleDateString('en-GB')}`
        : 'All Time';

      return (
        <div style={pageStyle}>
          {/* Header */}
          <div style={headerStyle}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#111827', marginBottom: '4px' }}>{customerName}</h1>
              <p style={{ fontSize: '18px', color: '#6b7280', fontWeight: '500' }}>Customer Analysis Report</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ color: '#6b7280', marginTop: '4px', fontWeight: '600', fontSize: '14px' }}>Date: {new Date().toLocaleDateString('en-GB')}</p>
              <p style={{ color: '#6b7280', marginTop: '2px', fontWeight: '600', fontSize: '14px' }}>Period: {periodString}</p>
            </div>
          </div>

          {/* Top Cards: Last Transactions */}
          <div className="grid grid-cols-3 gap-5 mb-6">
            {/* Last Sale */}
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
                <div style={{ backgroundColor: '#eff6ff', padding: '16px', borderRadius: '12px', border: '1px solid #dbeafe' }}>
                  <p style={{ color: '#2563eb', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Last Sale</p>
                  <p style={{ fontSize: '26px', fontWeight: '900', color: '#1d4ed8', marginBottom: '2px' }}>
                    {totalAmount > 0 ? totalAmount.toLocaleString('en-US') : '0'}
                  </p>
                  <p style={{ fontSize: '13px', color: '#3b82f6', fontWeight: '700' }}>
                    {latestDate?.toLocaleDateString('en-GB') || '—'}
                  </p>
                </div>
              );
            })()}

            {/* Last Return */}
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
                <div style={{ backgroundColor: '#fff7ed', padding: '16px', borderRadius: '12px', border: '1px solid #ffedd5' }}>
                  <p style={{ color: '#ea580c', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Last Return</p>
                  <p style={{ fontSize: '26px', fontWeight: '900', color: '#c2410c', marginBottom: '2px' }}>
                    {totalAmount > 0 ? totalAmount.toLocaleString('en-US') : '0'}
                  </p>
                  <p style={{ fontSize: '13px', color: '#f97316', fontWeight: '700' }}>
                    {latestDate?.toLocaleDateString('en-GB') || '—'}
                  </p>
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
                <div style={{ backgroundColor: '#f0fdf4', padding: '16px', borderRadius: '12px', border: '1px solid #dcfce7' }}>
                  <p style={{ color: '#16a34a', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Last Payment</p>
                  <p style={{ fontSize: '26px', fontWeight: '900', color: '#15803d', marginBottom: '2px' }}>
                    {totalAmount > 0 ? totalAmount.toLocaleString('en-US') : '0'}
                  </p>
                  <p style={{ fontSize: '13px', color: '#22c55e', fontWeight: '700' }}>
                    {latestDate?.toLocaleDateString('en-GB') || '—'}
                  </p>
                </div>
              );
            })()}
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-6 gap-5 mb-6">
            <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p style={{ color: '#000000', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Net Outstanding</p>
              <p style={{ fontSize: '20px', fontWeight: '900', color: totalNetDebt > 0 ? '#dc2626' : '#16a34a', wordBreak: 'break-all', lineHeight: '1.2' }}>
                {totalNetDebt.toLocaleString('en-US')}
              </p>
            </div>
            <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p style={{ color: '#000000', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Collection Rate</p>
              <p style={{ fontSize: '20px', fontWeight: '900', color: '#2563eb', wordBreak: 'break-all', lineHeight: '1.2' }}>{dashboardMetrics.collectionRate.toFixed(1)}%</p>
            </div>
            <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p style={{ color: '#000000', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Total Payments</p>
              <p style={{ fontSize: '20px', fontWeight: '900', color: '#16a34a', wordBreak: 'break-all', lineHeight: '1.2' }}>
                {filteredInvoices.filter(inv => isPaymentTxn(inv)).reduce((sum, inv) => sum + (inv.credit || 0), 0).toLocaleString('en-US')}
              </p>
            </div>
            <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p style={{ color: '#000000', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Avg Payment Cycle</p>
              <p style={{ fontSize: '20px', fontWeight: '900', color: '#8b5cf6', wordBreak: 'break-all', lineHeight: '1.2' }}>
                {dashboardMetrics.avgPaymentInterval > 0
                  ? `${dashboardMetrics.avgPaymentInterval.toFixed(1)} Days`
                  : '-'}
              </p>
            </div>
            <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p style={{ color: '#000000', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Net Sales</p>
              <p style={{ fontSize: '20px', fontWeight: '900', color: '#111827', wordBreak: 'break-all', lineHeight: '1.2' }}>
                {filteredInvoices.reduce((sum, inv) => {
                  const num = (inv.number || '').toString().toUpperCase();
                  if (num.startsWith('SAL')) return sum + inv.debit;
                  if (num.startsWith('RSAL')) return sum - inv.credit;
                  return sum;
                }, 0).toLocaleString('en-US')}
              </p>
            </div>
            <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p style={{ color: '#000000', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Avg Monthly Net Sales</p>
              <p style={{ fontSize: '20px', fontWeight: '900', color: '#0891b2', wordBreak: 'break-all', lineHeight: '1.2' }}>
                {dashboardMetrics.averageMonthlySales.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <h3 style={{ fontSize: '12px', fontWeight: '900', color: '#4b5563', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Payments Trend (12M)</h3>
              <div style={{ flex: 1, minHeight: 0, backgroundColor: 'rgba(249, 250, 251, 0.3)', borderRadius: '12px', border: '1px solid #f3f4f6', padding: '12px', maxHeight: '340px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyPaymentsTrendData} margin={{ top: 25, right: 5, left: 5, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis
                      dataKey="monthLabel"
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      tick={(props: any) => {
                        const { x, y, payload } = props;
                        const label = payload.value || '';
                        const month = label.replace(/[0-9]/g, '');
                        const year = label.replace(/[^0-9]/g, '');
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text x={0} y={0} dy={12} textAnchor="middle" fill="#6B7280" fontSize={10} fontWeight={700}>
                              {month}
                            </text>
                            <text x={0} y={0} dy={22} textAnchor="middle" fill="#9CA3AF" fontSize={9} fontWeight={500}>
                              {year}
                            </text>
                          </g>
                        );
                      }}
                    />
                    <YAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                    <Bar dataKey="credit" fill="#10B981" radius={[4, 4, 0, 0]} barSize={24}>
                      <LabelList
                        dataKey="credit"
                        position="top"
                        formatter={(value: any) => Number(value) > 0 ? Math.round(Number(value)).toLocaleString() : ''}
                        style={{ fontSize: '9px', fontWeight: '700', fill: '#374151' }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <h3 style={{ fontSize: '12px', fontWeight: '900', color: '#4b5563', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Net Sales Trend (12M)</h3>
              <div style={{ flex: 1, minHeight: 0, backgroundColor: 'rgba(249, 250, 251, 0.3)', borderRadius: '12px', border: '1px solid #f3f4f6', padding: '12px', maxHeight: '340px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlySalesTrendData} margin={{ top: 25, right: 5, left: 5, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis
                      dataKey="monthLabel"
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      tick={(props: any) => {
                        const { x, y, payload } = props;
                        const label = payload.value || '';
                        const month = label.replace(/[0-9]/g, '');
                        const year = label.replace(/[^0-9]/g, '');
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text x={0} y={0} dy={12} textAnchor="middle" fill="#6B7280" fontSize={10} fontWeight={700}>
                              {month}
                            </text>
                            <text x={0} y={0} dy={22} textAnchor="middle" fill="#9CA3AF" fontSize={9} fontWeight={500}>
                              {year}
                            </text>
                          </g>
                        );
                      }}
                    />
                    <YAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                    <Bar dataKey="originalDebit" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={24}>
                      <LabelList
                        dataKey="originalDebit"
                        position="top"
                        formatter={(value: any) => Number(value) > 0 ? Math.round(Number(value)).toLocaleString() : ''}
                        style={{ fontSize: '9px', fontWeight: '700', fill: '#374151' }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

        </div>
      );
    };

    // PAGE 2 COMPONENT (Aging & Monthly Debt)
    const AnalyticalReportPage2 = () => {
      const groupedDebt: { [key: string]: { amount: number; orderDate: number; label: string; isOB: boolean } } = {};

      filteredOverdueInvoices.forEach(inv => {
        const debt = inv.difference || inv.netDebt || 0;
        if (debt <= 0.01) return;

        let key = '';
        let label = '';
        let orderDate = 0;
        let isOB = false;

        if ((inv.number || '').toString().toUpperCase().startsWith('OB')) {
          key = 'OB';
          label = 'OB';
          orderDate = -9999999999999; 
          isOB = true;
        } else if (inv.date) {
          const d = new Date(inv.date);
          if (!isNaN(d.getTime())) {
            const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
            const m = monthNames[d.getMonth()];
            const y = d.getFullYear().toString().substring(2);
            key = `${d.getFullYear()}-${d.getMonth()}`; 
            label = `${m}${y}`;
            orderDate = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
          } else {
            key = 'Unknown';
            label = '??';
            orderDate = 0;
          }
        } else {
          key = 'Unknown';
          label = '??';
          orderDate = 0;
        }

        if (!groupedDebt[key]) {
          groupedDebt[key] = { amount: 0, orderDate, label, isOB };
        }
        groupedDebt[key].amount += debt;
      });

      return (
        <div style={pageStyle}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '32px', minHeight: 0, justifyContent: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '900', color: '#4b5563', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.1em', borderLeft: '4px solid #3B82F6', paddingLeft: '10px' }}>
                Aging Analysis (Debt Age)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '80px' }}>
                <div style={{ position: 'relative', width: '400px', height: '400px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dashboardMetrics.pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={120}
                        outerRadius={180}
                        paddingAngle={2}
                        dataKey="value"
                        cornerRadius={6}
                        isAnimationActive={false}
                        labelLine={false}
                        label={false}
                      >
                        {dashboardMetrics.pieData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none'
                  }}>
                    <span style={{ fontSize: '18px', fontWeight: '500', color: '#9ca3af', letterSpacing: '0.05em' }}>TOTAL</span>
                    <span style={{ fontSize: '32px', fontWeight: '500', color: '#1f2937' }}>
                      {dashboardMetrics.pieData.reduce((acc: any, curr: any) => acc + curr.value, 0).toLocaleString('en-US')}
                    </span>
                  </div>
                </div>

                <div style={{ minWidth: '350px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '30px' }}>
                  {dashboardMetrics.pieData.map((entry: any, index: number) => {
                    const total = dashboardMetrics.pieData.reduce((acc: any, curr: any) => acc + curr.value, 0);
                    const percent = total > 0 ? (entry.value / total * 100).toFixed(1) : '0.0';

                    return (
                      <div key={index} style={{ borderBottom: index !== dashboardMetrics.pieData.length - 1 ? '1px solid #f3f4f6' : 'none', paddingBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                          <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: entry.color }}></div>
                          <span style={{ fontSize: '28px', fontWeight: '500', color: entry.color, lineHeight: 1 }}>
                            {entry.value.toLocaleString('en-US')}
                          </span>
                        </div>
                        <div style={{ paddingLeft: '32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '18px', fontWeight: '500', color: '#6b7280' }}>{percent}%</span>
                          <span style={{ fontSize: '18px', fontWeight: '400', color: '#374151' }}>{entry.name}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    };

    const root = ReactDOM.createRoot(container);
    root.render(<AnalyticalReportPage1 />);
    await new Promise(r => setTimeout(r, 1500));

    const canvas1 = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: 1122,
      height: 793,
      windowWidth: 1122,
      windowHeight: 793
    });
    const imgData1 = canvas1.toDataURL('image/jpeg', 0.95);

    root.unmount();

    const root2 = ReactDOM.createRoot(container);
    root2.render(<AnalyticalReportPage2 />);
    await new Promise(r => setTimeout(r, 1500));

    const canvas2 = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: 1122,
      height: 793,
      windowWidth: 1122,
      windowHeight: 793
    });
    const imgData2 = canvas2.toDataURL('image/jpeg', 0.95);

    root2.unmount();
    document.body.removeChild(container);

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const imgProps1 = (pdf as any).getImageProperties(imgData1);
    const pdfHeight1 = (imgProps1.height * pdfWidth) / imgProps1.width;

    pdf.addImage(imgData1, 'JPEG', 0, 0, pdfWidth, pdfHeight1);
    pdf.addPage();

    const imgProps2 = (pdf as any).getImageProperties(imgData2);
    const pdfHeight2 = (imgProps2.height * pdfWidth) / imgProps2.width;

    pdf.addImage(imgData2, 'JPEG', 0, 0, pdfWidth, pdfHeight2);

    pdf.save(`${customerName.replace(/\s+/g, '_')}_Analysis.pdf`);
  } catch (error) {
    console.error('Error generating analytical PDF:', error);
    throw error;
  }
}
