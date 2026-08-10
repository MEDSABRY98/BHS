export function applySalesCommonFilters(data: any[], filters: any): any[] {
  if (!filters) return data;

  const {
    invoiceType,
    year,
    month,
    dateFrom,
    dateTo,
    area,
    market,
    merchandiser,
    salesRep,
    productTag,
    customerTag,
    customerClass,
  } = filters;

  let result = data;

  if (invoiceType && invoiceType !== 'all') {
    result = result.filter((item) => {
      const num = item.invoiceNumber?.trim().toUpperCase() || '';
      if (invoiceType === 'sales') return num.startsWith('SAL');
      if (invoiceType === 'returns') return num.startsWith('RSAL');
      return true;
    });
  }

  if (productTag) result = result.filter((i) => i.productTag === productTag);
  if (customerTag) result = result.filter((i) => i.customerTag === customerTag);
  if (customerClass) result = result.filter((i) => i.customerClass === customerClass);
  if (area) result = result.filter((i) => i.area === area);
  if (market) result = result.filter((i) => i.market === market);
  if (merchandiser) result = result.filter((i) => i.merchandiser === merchandiser);
  if (salesRep) result = result.filter((i) => i.salesRep === salesRep);

  if (year) {
    const yearNum = parseInt(year, 10);
    result = result.filter((item) => {
      if (!item.invoiceDate) return false;
      const d = new Date(item.invoiceDate);
      return !isNaN(d.getTime()) && d.getFullYear() === yearNum;
    });
  }

  if (month) {
    const monthNum = parseInt(month, 10);
    result = result.filter((item) => {
      if (!item.invoiceDate) return false;
      const d = new Date(item.invoiceDate);
      return !isNaN(d.getTime()) && d.getMonth() + 1 === monthNum;
    });
  }

  if (dateFrom || dateTo) {
    result = result.filter((item) => {
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

  return result;
}
