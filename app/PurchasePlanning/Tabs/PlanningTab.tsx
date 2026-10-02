'use client';

import React, { useMemo, useState } from 'react';
import { usePurchaseData } from '../Context/PurchaseDataContext';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, Search, Download, Package, Upload, X } from 'lucide-react';
import { exportStyledExcel } from '@/app/Components/Export/ExcelExport';

const OrderQuantityCell = ({ productId, qtyInBox, showInBoxes }: { productId: string, qtyInBox: number, showInBoxes: boolean }) => {
  const { orderQuantities, setOrderQuantity } = usePurchaseData();
  const rawVal = orderQuantities.get(productId) || 0;
  
  if (showInBoxes && (!qtyInBox || qtyInBox <= 0)) {
    return <span className="text-xs font-bold text-red-500 uppercase whitespace-nowrap">No Box Qty</span>;
  }

  const displayVal = showInBoxes && rawVal ? Number((rawVal / qtyInBox).toFixed(1)) : rawVal;

  return (
    <input
      type="number"
      min="0"
      step={showInBoxes ? "0.1" : "1"}
      className="w-20 px-2 py-1 text-sm font-bold font-mono bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      value={displayVal || ''}
      onChange={(e) => {
        const val = Number(e.target.value);
        setOrderQuantity(productId, showInBoxes ? val * qtyInBox : val);
      }}
    />
  );
};

export function PlanningTab() {
  const { products, months, orderQuantities, setOrderQuantity, loading, globalFilters } = usePurchaseData();
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInBoxes, setShowInBoxes] = useState(false);

  const [showOrderedOnly, setShowOrderedOnly] = useState(false);
  const [barcodeFilter, setBarcodeFilter] = useState<Set<string>>(new Set());

  const filteredProducts = useMemo(() => {
    let result = products;

    if (barcodeFilter.size > 0) {
      result = result.filter(p => barcodeFilter.has((p.barcode || '').trim()));
    }

    if (showOrderedOnly) {
      result = result.filter(p => (orderQuantities.get(p.productId) || 0) > 0);
    }

    if (globalFilters.categories.length > 0) {
      result = result.filter(p => globalFilters.categories.includes(p.category));
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(p => 
        (p.name?.toLowerCase() || '').includes(lower) || 
        (p.barcode?.toLowerCase() || '').includes(lower) || 
        (p.productId?.toLowerCase() || '').includes(lower)
      );
    }

    return result;
  }, [products, searchTerm, globalFilters.categories, showOrderedOnly, orderQuantities, barcodeFilter]);

  const columns = useMemo(() => {
    const baseCols = [
      {
        header: 'Barcode',
        accessorKey: 'barcode',
        cell: (info: any) => <span className="font-mono text-xs">{info.getValue() || '-'}</span>
      },
      {
        header: 'Product Name',
        accessorKey: 'name',
        cell: (info: any) => (
          <div className="min-w-[200px] whitespace-normal font-bold text-sm leading-tight text-center" title={info.getValue()}>
            {info.getValue()}
          </div>
        )
      },
      {
        header: 'Unit',
        accessorKey: 'unit',
        cell: (info: any) => <span className="text-xs font-bold text-gray-500 uppercase">{info.getValue() || '-'}</span>
      },
      {
        header: 'Qty in Box',
        accessorKey: 'qtyInBox',
        cell: (info: any) => <span className="font-mono text-gray-500">{info.getValue() || '-'}</span>
      },
      {
        header: 'Stock',
        accessorKey: 'stockQuantity',
        cell: (info: any) => {
          const product = info.row.original;
          if (showInBoxes && (!product.qtyInBox || product.qtyInBox <= 0)) {
            return <span className="font-mono font-bold text-red-500 text-xs">N/A</span>;
          }
          const val = info.getValue() || 0;
          return <span className="font-mono font-bold text-indigo-600">{showInBoxes ? (val / product.qtyInBox).toFixed(1) : val}</span>;
        }
      }
    ];

    const monthCols = months.map(m => ({
      header: m.label,
      accessorFn: (row: any) => row.monthlySales[m.key] || 0,
      id: m.key,
      cell: (info: any) => {
        const product = info.row.original;
        if (showInBoxes && (!product.qtyInBox || product.qtyInBox <= 0)) {
          return <span className="font-mono text-red-400 text-xs">N/A</span>;
        }
        const val = info.getValue() || 0;
        return <span className="font-mono">{showInBoxes ? (val / product.qtyInBox).toFixed(1) : val}</span>;
      }
    }));

    const finalCols = [
      ...baseCols,
      ...monthCols,
      {
        header: 'Average',
        accessorKey: 'monthlyAverage',
        cell: (info: any) => {
          const product = info.row.original;
          if (showInBoxes && (!product.qtyInBox || product.qtyInBox <= 0)) {
            return <span className="font-mono font-bold text-red-500 text-xs">N/A</span>;
          }
          const val = info.getValue() || 0;
          return (
            <span className="font-mono font-bold text-green-600">
              {showInBoxes ? (val / product.qtyInBox).toFixed(1) : Number(val).toFixed(1)}
            </span>
          );
        }
      },
      {
        header: 'Order Qty',
        id: 'orderQty',
        cell: (info: any) => {
          const product = info.row.original;
          return <OrderQuantityCell productId={product.productId} qtyInBox={product.qtyInBox} showInBoxes={showInBoxes} />;
        }
      }
    ];
    return finalCols;
  }, [months, showInBoxes]);

  const table = useReactTable({
    data: filteredProducts,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const totals = useMemo(() => {
    let stock = 0;
    const monthlyTotals: Record<string, number> = {};
    let average = 0;
    let orderQty = 0;

    months.forEach(m => monthlyTotals[m.key] = 0);

    filteredProducts.forEach(p => {
      stock += p.stockQuantity || 0;
      months.forEach(m => {
        monthlyTotals[m.key] += (p.monthlySales[m.key] || 0);
      });
      average += p.monthlyAverage || 0;
      orderQty += (orderQuantities.get(p.productId) || 0);
    });

    return { stock, monthlyTotals, average, orderQty };
  }, [filteredProducts, months, orderQuantities]);

  const handleExport = async () => {
    const dataToExport = table.getRowModel().rows.map((r, index) => {
      const p = r.original;
      const noBox = showInBoxes && (!p.qtyInBox || p.qtyInBox <= 0);
      const row: any = {
        '#': index + 1,
        'Product ID': p.productId,
        'Barcode': p.barcode || '-',
        'Product Name': p.name,
        'Unit': p.unit || '-',
        'Qty in Box': p.qtyInBox || '-',
        'Stock': noBox ? 'No Box Qty' : (showInBoxes ? Number(((p.stockQuantity || 0) / p.qtyInBox).toFixed(1)) : (p.stockQuantity || 0)),
      };
      months.forEach(m => {
        row[m.label] = noBox ? 'No Box Qty' : (showInBoxes ? Number((((p.monthlySales[m.key] || 0)) / p.qtyInBox).toFixed(1)) : (p.monthlySales[m.key] || 0));
      });
      row['Average'] = noBox ? 'No Box Qty' : (showInBoxes ? Number(((p.monthlyAverage || 0) / p.qtyInBox).toFixed(1)) : Number((p.monthlyAverage || 0).toFixed(1)));
      const oq = orderQuantities.get(p.productId) || 0;
      row['Order Qty'] = noBox ? 'No Box Qty' : (showInBoxes ? Number((oq / p.qtyInBox).toFixed(1)) : oq);
      return row;
    });

    await exportStyledExcel(dataToExport, `Purchase_Planning_${new Date().toISOString().split('T')[0]}.xlsx`, {
      sheetName: 'Planning',
      numericColumns: ['Stock', ...months.map(m => m.label), 'Average', 'Order Qty'],
      columnWidth: 15
    });
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-400 font-bold tracking-widest text-sm uppercase">Loading Planning Data...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col">
      <div className="flex items-center justify-between mb-6 shrink-0 gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-black text-gray-800">Purchase Planner</h2>
          <button
            onClick={() => setShowInBoxes(!showInBoxes)}
            title="Toggle Box View"
            className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 border shadow-sm ml-auto ${
              showInBoxes 
                ? 'bg-purple-600 text-white border-purple-700 shadow-purple-200' 
                : 'bg-white text-slate-400 border-slate-200 hover:text-purple-600 hover:border-purple-200 hover:bg-purple-50'
            }`}
          >
            <Package className="w-5 h-5" />
          </button>

          <button
            onClick={handleExport}
            title="Export to Excel"
            className="flex items-center justify-center w-10 h-10 bg-green-50 hover:bg-green-100 text-green-600 rounded-xl transition-colors border border-green-200 shadow-sm"
          >
            <Download className="w-5 h-5" />
          </button>

          <label 
            title="Filter by Barcodes File (.txt)"
            className="flex items-center justify-center w-10 h-10 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-colors border border-indigo-200 shadow-sm cursor-pointer"
          >
            <Upload className="w-5 h-5" />
            <input 
              type="file" 
              accept=".txt" 
              className="hidden" 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                  const text = event.target?.result as string;
                  if (text) {
                    const codes = text.split(/[\r\n,]+/).map(c => c.trim()).filter(c => c.length > 0);
                    setBarcodeFilter(new Set(codes));
                  }
                };
                reader.readAsText(file);
                e.target.value = '';
              }}
            />
          </label>

          {barcodeFilter.size > 0 && (
            <button
              onClick={() => setBarcodeFilter(new Set())}
              title="Clear File Filter"
              className="flex items-center gap-1.5 px-3 h-10 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl transition-colors border border-red-200 shadow-sm"
            >
              <span>{barcodeFilter.size}</span>
              <X className="w-4 h-4" />
            </button>
          )}
          
          <label className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl shadow-sm hover:bg-slate-100 transition-colors">
            <input 
              type="checkbox" 
              className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer" 
              checked={showOrderedOnly} 
              onChange={e => setShowOrderedOnly(e.target.checked)} 
            />
            <span className="text-sm font-bold text-slate-700 select-none">Ordered Only</span>
          </label>
        </div>
        
        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm font-semibold transition-all"
          />
        </div>
      </div>

      <div className="flex-1 rounded-xl border border-gray-100 relative">
        <table className="w-full text-center border-separate border-spacing-0">
          <thead className="sticky top-0 z-30">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="sticky top-0 z-30 bg-[#0a0f1d] px-4 py-4 text-xs font-black text-white uppercase tracking-wider whitespace-nowrap border-b border-white/10 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)]"
                  >
                    <div className="flex items-center justify-center gap-2">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-50">
            {table.getRowModel().rows.map(row => {
              const hasNoBoxQty = showInBoxes && (!row.original.qtyInBox || row.original.qtyInBox <= 0);
              return (
                <tr key={row.id} className={`transition-colors ${hasNoBoxQty ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-indigo-50/30'}`}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className={`px-4 py-3 text-sm text-center border-r last:border-r-0 align-middle ${hasNoBoxQty ? 'border-red-100' : 'border-gray-50'}`}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-400 font-bold uppercase tracking-widest text-sm">
                  No Products Found
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-black text-sm text-slate-800">
            <tr>
              <td className="px-4 py-4 border-r border-slate-200"></td>
              <td className="px-4 py-4 border-r border-slate-200 text-right uppercase tracking-wider">Total</td>
              <td className="px-4 py-4 border-r border-slate-200"></td>
              <td className="px-4 py-4 border-r border-slate-200"></td>
              <td className="px-4 py-4 border-r border-slate-200 text-indigo-700">
                {showInBoxes ? '-' : totals.stock.toLocaleString()}
              </td>
              {months.map(m => (
                <td key={m.key} className="px-4 py-4 border-r border-slate-200">
                  {showInBoxes ? '-' : totals.monthlyTotals[m.key].toLocaleString()}
                </td>
              ))}
              <td className="px-4 py-4 border-r border-slate-200 text-green-700">
                {showInBoxes ? '-' : totals.average.toFixed(1).toLocaleString()}
              </td>
              <td className="px-4 py-4">
                {showInBoxes ? '-' : totals.orderQty.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
