import { NextResponse } from 'next/server';
import { getFilteredSalesData } from '@/app/Sales/Utils/SalesMappingCache';

export async function POST(request: Request) {
  try {
    const { userId, filters } = await request.json();

    const augmentedData = await getFilteredSalesData(userId);

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

    // Grouping Products & Customers
    const productMap = new Map<string, any>();
    const mainCustomerMap = new Map<string, any>();
    const subCustomerMap = new Map<string, any>();

    globallyFilteredData.forEach(item => {
      // Product
      const pKey = item.productId || item.product;
      const exP = productMap.get(pKey) || { productId: item.productId || '', barcodes: new Set(), products: new Set(), totalAmount: 0, totalQty: 0, invoiceNumbers: new Set() };
      if (item.barcode) exP.barcodes.add(item.barcode);
      if (item.product) exP.products.add(item.product);
      exP.totalAmount += Number(item.amount) || 0;
      exP.totalQty += Number(item.qty) || 0;
      if (item.invoiceNumber) exP.invoiceNumbers.add(item.invoiceNumber);
      productMap.set(pKey, exP);

      // Main Customer
      const mainKey = item.customerMainName || item.customerName || 'Unknown';
      const mainDisplay = item.customerMainName || item.customerName || 'Unknown';
      const exMain = mainCustomerMap.get(mainKey) || { customer: mainDisplay, totalAmount: 0, totalQty: 0, invoiceNumbers: new Set() };
      exMain.totalAmount += Number(item.amount) || 0;
      exMain.totalQty += Number(item.qty) || 0;
      if (item.invoiceNumber) exMain.invoiceNumbers.add(item.invoiceNumber);
      mainCustomerMap.set(mainKey, exMain);

      // Sub Customer
      const subKey = item.customerId || item.customerName || 'Unknown';
      const subDisplay = item.customerName || 'Unknown';
      const exSub = subCustomerMap.get(subKey) || { customer: subDisplay, totalAmount: 0, totalQty: 0, invoiceNumbers: new Set() };
      exSub.totalAmount += Number(item.amount) || 0;
      exSub.totalQty += Number(item.qty) || 0;
      if (item.invoiceNumber) exSub.invoiceNumbers.add(item.invoiceNumber);
      subCustomerMap.set(subKey, exSub);
    });

    const productsData = Array.from(productMap.values()).map(p => ({
      productId: p.productId,
      barcode: Array.from(p.barcodes).join(', ') || '-',
      products: Array.from(p.products),
      totalAmount: p.totalAmount,
      totalQty: p.totalQty,
      transactions: p.invoiceNumbers.size
    }));

    const mapCustomers = (map: Map<string, any>) =>
      Array.from(map.values()).map(c => ({
        customer: c.customer,
        totalAmount: c.totalAmount,
        totalQty: c.totalQty,
        transactions: c.invoiceNumbers.size
      }));

    const mainCustomersData = mapCustomers(mainCustomerMap);
    const subCustomersData = mapCustomers(subCustomerMap);

    return NextResponse.json({ productsData, mainCustomersData, subCustomersData });

  } catch (error: any) {
    console.error('API Error Top10:', error);
    return NextResponse.json({ error: 'Failed to fetch top 10 data', details: error.message || error }, { status: 500 });
  }
}
