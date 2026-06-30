import { NextResponse } from 'next/server';
import { bhs_supabase } from '@/lib/supabase';
import { getFilteredSalesData } from '@/app/Sales/Utils/SalesMappingCache';

function normCustomerId(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  return String(value).trim().toUpperCase();
}

async function getCustomerNameMap() {
  const { data, error } = await bhs_supabase
    .from('bhs_CUSTOMERS')
    .select('"CUSTOMER ID", "CUSTOMER MAIN NAME", "CUSTOMER SUB NAME"');

  if (error) throw error;

  const map = new Map<string, { mainName: string; subName: string }>();
  (data || []).forEach((row) => {
    const id = normCustomerId(row['CUSTOMER ID']);
    if (!id) return;
    map.set(id, {
      mainName: row['CUSTOMER MAIN NAME'] || '',
      subName: row['CUSTOMER SUB NAME'] || '',
    });
  });
  return map;
}

export async function POST(request: Request) {
  try {
    const { userId, filters, activeTab } = await request.json();

    const augmentedData = await getFilteredSalesData(userId);
    const customerNameMap = await getCustomerNameMap();

    // Apply Global Filters
    let globallyFilteredData = augmentedData;
    if (filters) {
      const { invoiceType, year, month, dateFrom, dateTo, area, market, merchandiser, salesRep, productTag } = filters;

      if (invoiceType && invoiceType !== 'all') {
        globallyFilteredData = globallyFilteredData.filter(item => {
          const num = item.invoiceNumber?.trim().toUpperCase() || '';
          if (invoiceType === 'sales') return num.startsWith('SAL');
          if (invoiceType === 'returns') return num.startsWith('RSAL');
          return true;
        });
      }
      if (productTag) globallyFilteredData = globallyFilteredData.filter(i => i.productTag === productTag);
      if (area) globallyFilteredData = globallyFilteredData.filter(i => i.area === area);
      if (market) globallyFilteredData = globallyFilteredData.filter(i => i.market === market);
      if (merchandiser) globallyFilteredData = globallyFilteredData.filter(i => i.merchandiser === merchandiser);
      if (salesRep) globallyFilteredData = globallyFilteredData.filter(i => i.salesRep === salesRep);
      if (year) {
        const yearNum = parseInt(year, 10);
        globallyFilteredData = globallyFilteredData.filter(item => {
          if (!item.invoiceDate) return false;
          const d = new Date(item.invoiceDate);
          return !isNaN(d.getTime()) && d.getFullYear() === yearNum;
        });
      }
      if (month) {
        const monthNum = parseInt(month, 10);
        globallyFilteredData = globallyFilteredData.filter(item => {
          if (!item.invoiceDate) return false;
          const d = new Date(item.invoiceDate);
          return !isNaN(d.getTime()) && d.getMonth() + 1 === monthNum;
        });
      }
      if (dateFrom || dateTo) {
        globallyFilteredData = globallyFilteredData.filter(item => {
          if (!item.invoiceDate) return false;
          const itemDate = new Date(item.invoiceDate);
          if (isNaN(itemDate.getTime())) return false;
          if (dateFrom && itemDate < new Date(dateFrom)) return false;
          if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            if (itemDate > toDate) return false;
          }
          return true;
        });
      }
    }

    const customerMap = new Map<string, any>();
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    // Grouping
    for (let i = 0; i < globallyFilteredData.length; i++) {
      const item = globallyFilteredData[i];

      const normalizedId = normCustomerId(item.customerId);
      const freshNames = normalizedId ? customerNameMap.get(normalizedId) : undefined;

      let key: string;
      let displayName: string;

      if (activeTab === 'main') {
        displayName =
          freshNames?.mainName ||
          item.customerMainName ||
          item.customerName ||
          'Unknown';
        key = displayName;
      } else {
        key = normalizedId || item.customerName || 'Unknown';
        displayName =
          freshNames?.subName ||
          item.customerName ||
          item.customerMainName ||
          'Unknown';
      }

      let existing = customerMap.get(key);

      if (!existing) {
        existing = {
          customerId: normalizedId || key,
          customer: displayName,
          area: item.area || '',
          market: item.market || '',
          totalAmount: 0,
          totalQty: 0,
          barcodes: new Set<string>(),
          months: new Set<string>(),
          invoiceNumbers: new Set<string>(),
          monthlyData: {} // For Excel export
        };
        customerMap.set(key, existing);
      } else if (displayName && existing.customer !== displayName && freshNames?.subName) {
        existing.customer = displayName;
      }

      existing.totalAmount += Number(item.amount) || 0;
      existing.totalQty += Number(item.qty) || 0;

      if (item.invoiceNumber && item.invoiceNumber.trim().toUpperCase().startsWith('SAL')) {
        existing.invoiceNumbers.add(item.invoiceNumber);
        const productKey = item.productId || item.barcode || item.product;
        existing.barcodes.add(productKey);
      }

      if (item.invoiceDate) {
        const date = new Date(item.invoiceDate);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          const monthKey = `${year}-${month < 10 ? '0' : ''}${month}`;
          existing.months.add(monthKey);

          if (!existing.monthlyData[monthKey]) {
            existing.monthlyData[monthKey] = { amount: 0, qty: 0 };
          }
          existing.monthlyData[monthKey].amount += Number(item.amount) || 0;
          existing.monthlyData[monthKey].qty += Number(item.qty) || 0;
        }
      }
    }

    const customersData = Array.from(customerMap.values()).map(item => {
      let totalMonths = 1;
      if (item.months.size > 0) {
        const sortedMonths = Array.from(item.months as Set<string>).sort();
        const firstMonthKey = sortedMonths[0];
        const [firstYear, firstMonth] = firstMonthKey.split('-').map(Number);
        const firstDate = new Date(firstYear, firstMonth - 1, 1);
        const lastDate = new Date(currentYear, currentMonth, 1);
        const yearsDiff = lastDate.getFullYear() - firstDate.getFullYear();
        const monthsDiff = lastDate.getMonth() - firstDate.getMonth();
        totalMonths = (yearsDiff * 12) + monthsDiff + 1;
        if (totalMonths < 1) totalMonths = 1;
      }

      return {
        customerId: item.customerId,
        customer: item.customer,
        area: item.area,
        market: item.market,
        totalAmount: item.totalAmount,
        totalQty: item.totalQty,
        averageAmount: item.totalAmount / totalMonths,
        averageQty: item.totalQty / totalMonths,
        productsCount: item.barcodes.size,
        transactions: item.invoiceNumbers.size,
        monthlyData: item.monthlyData
      };
    });

    return NextResponse.json({ customersData });

  } catch (error: any) {
    console.error('API Error Customers:', error);
    return NextResponse.json({ error: 'Failed to fetch customers data', details: error.message || error }, { status: 500 });
  }
}
