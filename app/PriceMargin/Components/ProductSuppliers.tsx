'use client';

// Product details → Suppliers: the product by supplier — first and last purchase price, range, quantity share,
// and the margin of the chosen selling price on each supplier's last price.

import NoData from '@/app/Components/DataState/NoDataTab';
import { UsePriceMargin } from '../Context/PriceMarginContext';
import { FormatDate, Money, PRICE_MODES, PassProfit, SalePrice, type ProductSupplierRow } from '../Utils/Types';

const th = 'px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-center whitespace-nowrap';

function PriceDate({ price, date }: { price: number; date: string }) {
  return (
    <div className="leading-tight">
      <div className="font-mono font-bold text-slate-800 tabular-nums">{Money(price, 3)}</div>
      <div className="text-[11px] text-slate-400">{FormatDate(date)}</div>
    </div>
  );
}

/** rows are loaded by ProductDetails together with the customers (one loading screen for both tabs) */
export default function ProductSuppliers({ rows }: { rows: ProductSupplierRow[] }) {
  const { selected, priceMode, profitFilter } = UsePriceMargin();

  if (!selected) return null;
  if (!rows.length) return <NoData message="No purchase invoices for this product" />;

  const sale = SalePrice(selected, priceMode);
  // Profit filter: the selling price on each supplier's last price
  const list = rows.filter((r) => PassProfit(sale === null ? null : sale - r.last.price, profitFilter));
  if (!list.length) return <NoData message="No suppliers match the Profit filter" />;
  const modeLabel = PRICE_MODES.find((x) => x.id === priceMode)?.label || 'Highest';

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-900 text-white text-center">
            <th className={th}>#</th>
            <th className={th}>Supplier</th>
            <th className={th}>Last Price</th>
            <th className={th}>First Price</th>
            <th className={th}>Change</th>
            <th className={th}>Lowest</th>
            <th className={th}>Highest</th>
            <th className={th}>Purchases</th>
            <th className={th}>Qty</th>
            <th className={th}>Share of Qty</th>
            <th className={th}>Margin ({modeLabel} Price)</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r, i) => {
            const change = r.first.price ? ((r.last.price - r.first.price) / r.first.price) * 100 : null;
            const pct = sale === null || !(sale > 0) ? null : ((sale - r.last.price) / sale) * 100;
            return (
              <tr key={r.supplierId || i} className="border-b border-slate-100 odd:bg-white even:bg-slate-50/60 hover:bg-amber-50/40 text-center">
                <td className="px-3 py-2.5 text-slate-400 tabular-nums">{i + 1}</td>
                <td className="px-3 py-2.5 font-semibold text-slate-800">{r.name}</td>
                <td className="px-3 py-2.5">
                  <PriceDate price={r.last.price} date={r.last.date} />
                </td>
                <td className="px-3 py-2.5">
                  <PriceDate price={r.first.price} date={r.first.date} />
                </td>
                <td
                  className={`px-3 py-2.5 font-mono tabular-nums ${
                    change === null || Math.abs(change) < 0.05 ? 'text-slate-400' : change > 0 ? 'text-red-600' : 'text-emerald-600'
                  }`}
                >
                  {change === null ? '-' : `${change > 0 ? '+' : ''}${change.toFixed(1)}%`}
                </td>
                <td className="px-3 py-2.5 font-mono tabular-nums text-slate-700">{Money(r.min, 3)}</td>
                <td className="px-3 py-2.5 font-mono tabular-nums text-slate-700">{Money(r.max, 3)}</td>
                <td className="px-3 py-2.5 tabular-nums text-slate-700">{r.purchases.toLocaleString()}</td>
                <td className="px-3 py-2.5 tabular-nums text-slate-700">{r.qty.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-24 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B]" style={{ width: `${Math.min(100, r.share)}%` }} />
                    </div>
                    <span className="font-bold tabular-nums text-slate-700 w-14 text-left">{r.share.toFixed(1)}%</span>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  {pct === null ? (
                    <span className="text-slate-300">-</span>
                  ) : (
                    <span
                      className={`inline-block min-w-[64px] px-2 py-1 rounded-lg text-xs font-black tabular-nums ${
                        pct < 0 ? 'bg-red-100 text-red-700' : pct < 15 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {pct.toFixed(1)}%
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
