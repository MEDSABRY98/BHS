'use client';

import { CustomerAnalysis } from '@/types';

const formatDmy = (date?: Date | null) => {
  if (!date) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const calculateDebtRating = (customer: CustomerAnalysis, closedCustomersSet: Set<string>, returnBreakdown: boolean = false): 'Good' | 'Medium' | 'Bad' | any => {
  const customerNameNormalized = customer.customerName.toLowerCase().trim().replace(/\s+/g, ' ');
  const isClosed = closedCustomersSet.has(customerNameNormalized);
  if (isClosed) {
    if (returnBreakdown) {
      return {
        rating: 'Bad',
        reason: 'Closed',
        isClosed: true,
        breakdown: null
      };
    }
    return 'Bad';
  }

  const netDebt = customer.netDebt;
  const collRate = customer.totalDebit > 0 ? (customer.totalCredit / customer.totalDebit) : 0;
  const lastPay = customer.lastPaymentDate;
  const payCount = (customer as any).paymentsCount3m || 0;
  const payments90d = (customer as any).payments3m || 0;
  const sales90d = (customer as any).sales3m || 0;
  const lastSale = customer.lastSalesDate;
  const salesCount = (customer as any).salesCount3m || 0;

  const riskFlag1 = sales90d < 0 && payCount === 0 ? 1 : 0;
  const riskFlag2 = payCount === 0 && salesCount === 0 && netDebt > 0 ? 1 : 0;

  let score1 = 0;
  if (netDebt < 0) {
    score1 = 2;
  } else if (netDebt <= 5000) {
    score1 = 2;
  } else if (netDebt <= 20000) {
    score1 = 1;
  } else {
    score1 = 0;
  }

  let score2 = 0;
  if (collRate >= 0.8) {
    score2 = 2;
  } else if (collRate >= 0.5) {
    score2 = 1;
  } else {
    score2 = 0;
  }

  let score3 = 0;
  if (lastPay) {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - lastPay.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 30) score3 = 2;
    else if (diffDays <= 60) score3 = 1;
    else score3 = 0;
  } else {
    score3 = 0;
  }

  let score4 = 0;
  if (payCount >= 3) score4 = 2;
  else if (payCount >= 1) score4 = 1;
  else score4 = 0;

  let score5 = 0;
  if (lastSale) {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - lastSale.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 30) score5 = 2;
    else if (diffDays <= 90) score5 = 1;
    else score5 = 0;
  } else {
    score5 = 0;
  }

  const totalPoints = score1 + score2 + score3 + score4 + score5;
  const riskPenalty = (riskFlag1 + riskFlag2) * 3;
  const finalScore = Math.max(0, totalPoints - riskPenalty);

  let rating: 'Good' | 'Medium' | 'Bad' = 'Bad';
  if (finalScore >= 8) rating = 'Good';
  else if (finalScore >= 5) rating = 'Medium';
  else rating = 'Bad';

  if (returnBreakdown) {
    return {
      rating,
      points: totalPoints,
      penalty: riskPenalty,
      finalScore,
      isClosed: false,
      breakdown: {
        netDebt: { score: score1, value: netDebt },
        collRate: { score: score2, value: collRate },
        lastPay: { score: score3, value: lastPay },
        payCount: { score: score4, value: payCount },
        lastSale: { score: score5, value: lastSale }
      }
    };
  }
  return rating;
};

export const exportToPDF = async (data: CustomerAnalysis[], filename: string = 'customers_report', closedCustomersSet: Set<string> = new Set()) => {
  try {
    const jsPDF = (await import('jspdf')).default;
    const autoTable = (await import('jspdf-autotable')).default;
    const JSZip = (await import('jszip')).default;

    // Helper to generate a PDF Blob from a subset of data
    const generatePDFBlob = (pdfData: CustomerAnalysis[]): Blob => {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // 1. Group Data by Sales Rep (first one if multiple)
      const groupedData: Record<string, CustomerAnalysis[]> = {};
      pdfData.forEach(customer => {
        let rep = 'Unassigned';
        if (customer.salesReps && customer.salesReps.size > 0) {
          const reps = Array.from(customer.salesReps).sort();
          rep = reps[0];
        }
        if (!groupedData[rep]) {
          groupedData[rep] = [];
        }
        groupedData[rep].push(customer);
      });

      // 2. Sort Reps
      const sortedReps = Object.keys(groupedData).sort();

      const tableColumn = [
        'Customer Name',
        'City / Rep',
        'Total Debt',
        'Last Pay Date',
        'Last Pay Amt',
        'Pay (90d)',
        '# Pay (90d)',
        'Coll Rate (Pay)',
        'Last Sale Date',
        'Last Sale Amt',
        'Sales (90d)',
        '# Sales (90d)',
        'Rating'
      ];

      let isFirstPage = true;
      const ratingOrder = ['Good', 'Medium', 'Bad'];

      // 3. Iterate and Generate Pages
      for (const rep of sortedReps) {
        const groupData = groupedData[rep];

        // Pre-calculate ratings and group by rating
        const byRating: Record<string, CustomerAnalysis[]> = {
          'Good': [],
          'Medium': [],
          'Bad': []
        };

        groupData.forEach(customer => {
          const ratingInfo = calculateDebtRating(customer, closedCustomersSet, true);
          const rating = typeof ratingInfo === 'string' ? ratingInfo : ratingInfo.rating;
          if (byRating[rating]) {
            byRating[rating].push(customer);
          } else {
            byRating['Bad'].push(customer);
          }
        });

        for (const ratingLabel of ratingOrder) {
          const customersInRating = byRating[ratingLabel];
          if (customersInRating.length === 0) continue;

          if (!isFirstPage) {
            doc.addPage();
          }
          isFirstPage = false;

          // Header
          doc.setFontSize(16);
          const totalDebt = customersInRating.reduce((sum, c) => sum + c.netDebt, 0);
          const formattedDebt = totalDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          doc.text(`Customers Analysis Report - ${rep} (${ratingLabel}) - ${customersInRating.length} Customers - Total Debt: ${formattedDebt}`, 14, 15);
          doc.setFontSize(10);
          doc.text(`Date: ${formatDmy(new Date())}`, 14, 22);
          doc.setFontSize(8);
          doc.setTextColor(100);
          doc.text('Tip: Ctrl+Click (Cmd+Click) on customer names to open in a new tab', 14, 26);
          doc.setTextColor(0);

          const tableRows = customersInRating.map(customer => {
            const ratingInfo = calculateDebtRating(customer, closedCustomersSet, true);
            const rating = typeof ratingInfo === 'string' ? ratingInfo : ratingInfo.rating;

            const payments = customer.creditPayments || 0;
            const totalSales = customer.totalDebit || 0;
            const collRatePay = totalSales > 0 ? ((payments / totalSales) * 100).toFixed(1) + '%' : '0.0%';

            const salesReps = customer.salesReps ? Array.from(customer.salesReps).join(', ') : '';

            return [
              customer.customerName,
              salesReps,
              customer.netDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
              customer.lastPaymentDate ? formatDmy(customer.lastPaymentDate) : '-',
              customer.lastPaymentAmount ? customer.lastPaymentAmount.toLocaleString('en-US') : '-',
              (customer.payments3m || 0).toLocaleString('en-US'),
              customer.paymentsCount3m || 0,
              collRatePay,
              customer.lastSalesDate ? formatDmy(customer.lastSalesDate) : '-',
              customer.lastSalesAmount ? customer.lastSalesAmount.toLocaleString('en-US') : '-',
              (customer.sales3m || 0).toLocaleString('en-US'),
              customer.salesCount3m || 0,
              rating
            ];
          });

          autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 30,
            styles: { fontSize: 9, cellPadding: 1.5, halign: 'center', textColor: 0, fontStyle: 'normal' },
            headStyles: { fillColor: [75, 85, 99], halign: 'center', valign: 'middle', textColor: 255 },
            alternateRowStyles: { fillColor: [229, 231, 235] },
            margin: { left: 5, right: 5 },
            columnStyles: {
              0: { cellWidth: 70, halign: 'center' },
            },
            didParseCell: (data) => {
              if (data.section === 'head') {
                const index = data.column.index;
                if (index >= 3 && index <= 7) data.cell.styles.fillColor = [37, 99, 235];
                else if (index >= 8 && index <= 11) data.cell.styles.fillColor = [234, 88, 12];
                else if (index === 12) data.cell.styles.fillColor = [147, 51, 234];
                else data.cell.styles.fillColor = [22, 163, 74];
              }
            },
            didDrawCell: (data) => {
              if (data.section === 'body' && data.column.index === 0 && data.row.index < customersInRating.length) {
                const customer = customersInRating[data.row.index];
                if (customer && customer.customerName) {
                  const url = `${window.location.origin}/debit?customer=${encodeURIComponent(customer.customerName)}&action=download_report`;
                  doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url });
                }
              }
            }
          });
        }
      }
      return doc.output('blob');
    };

    const zip = new JSZip();

    // 1. Generate Combined PDF
    const combinedBlob = generatePDFBlob(data);
    zip.file(`${filename}_Combined.pdf`, combinedBlob);

    // 2. Generate Individual PDFs per Rep
    const groupedData: Record<string, CustomerAnalysis[]> = {};
    data.forEach(customer => {
      let rep = 'Unassigned';
      if (customer.salesReps && customer.salesReps.size > 0) {
        const reps = Array.from(customer.salesReps).sort();
        rep = reps[0];
      }
      if (!groupedData[rep]) {
        groupedData[rep] = [];
      }
      groupedData[rep].push(customer);
    });

    for (const rep of Object.keys(groupedData)) {
      const repData = groupedData[rep];
      const repBlob = generatePDFBlob(repData);
      // Clean filename
      const safeRepName = rep.replace(/[^a-z0-9]/gi, '_').trim();
      zip.file(`${safeRepName}.pdf`, repBlob);
    }

    // 3. Generate and Save Zip
    const content = await zip.generateAsync({ type: 'blob' });
    const { saveAs } = await import('file-saver');
    saveAs(content, `${filename}.zip`);

  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};
