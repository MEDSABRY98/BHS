import { InvoiceRow } from '@/types';

export interface OpenInvoiceRow {
  rowKey: string;
  customerName: string;
  date: string;
  dueDate?: string;
  number: string;
  debit: number;
  credit: number;
  openAmount: number;
  matching: string;
  daysOverdue: number;
}

function normalizeCustomer(name: string): string {
  return name.toLowerCase().trim();
}

export function buildOpenInvoiceRows(
  data: InvoiceRow[],
  customerNames: string[],
  options?: { includeAll?: boolean },
): OpenInvoiceRow[] {
  const list: OpenInvoiceRow[] = [];
  if (customerNames.length === 0) return list;

  const includeAll = options?.includeAll ?? false;

  customerNames.forEach((custName) => {
    const invoices = data.filter(
      (inv) => normalizeCustomer(inv.customerName || '') === normalizeCustomer(custName),
    );

    const invoicesWithNet = invoices.map((invoice, index) => {
      let residual: number | undefined;
      const parsedDate = invoice.date ? new Date(invoice.date) : null;
      if (
        invoice.matching &&
        invoice.residualAmount !== undefined &&
        Math.abs(invoice.residualAmount) > 0.01
      ) {
        residual = invoice.residualAmount;
      }
      return {
        ...invoice,
        netDebt: invoice.debit - invoice.credit,
        residual,
        originalIndex: index,
        parsedDate,
      };
    });

    const targetInvoices = includeAll
      ? invoicesWithNet
      : invoicesWithNet.filter((inv) => {
          if (!inv.matching) return Math.abs(inv.netDebt) > 0.01;
          return inv.residual !== undefined && Math.abs(inv.residual) > 0.01;
        });

    targetInvoices.forEach((inv, index) => {
      let openAmount = inv.netDebt;
      if (inv.matching) {
        openAmount = inv.residual !== undefined ? inv.residual : 0;
      }

      if (!includeAll && Math.abs(openAmount) <= 0.01) return;

      let daysOverdue = 0;
      let targetDate = inv.dueDate ? new Date(inv.dueDate) : inv.parsedDate || null;
      if (targetDate && !Number.isNaN(targetDate.getTime()) && Math.abs(openAmount) > 0.01) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        targetDate.setHours(0, 0, 0, 0);
        daysOverdue = Math.max(
          0,
          Math.ceil((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24)),
        );
      }

      list.push({
        rowKey: `${custName}::${inv.number || ''}::${inv.date || ''}::${index}`,
        customerName: custName,
        date: inv.date || '',
        dueDate: inv.dueDate || '',
        number: inv.number || '',
        debit: inv.debit,
        credit: inv.debit - openAmount,
        openAmount: Math.round(openAmount * 100) / 100,
        matching: inv.matching || '',
        daysOverdue,
      });
    });
  });

  return list.sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateA - dateB;
  });
}

export function getUniqueCustomerNames(data: InvoiceRow[]): string[] {
  const names = new Set<string>();
  data.forEach((item) => {
    if (item.customerName?.trim()) names.add(item.customerName.trim());
  });
  return Array.from(names).sort();
}
