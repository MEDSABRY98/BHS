import React, { useMemo, useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Building2,
  Package,
  TrendingUp,
  AlertTriangle,
  ListOrdered,
  Filter,
  Grid3x3,
} from 'lucide-react';
import { PurchaseRecord, Product, Supplier } from '../page';
import { generateSupplierPriceHistoryReport } from './SupplierPriceHistoryReport';
import { generateProductSupplierComparisonReport } from './ProductSupplierComparisonReport';
import { generatePriceInflationReport } from './PriceInflationReport';
import { generateSupplierDependencyReport } from './SupplierDependencyReport';
import { generateProductPriceSequenceReport } from './ProductPriceSequenceReport';
import { generateSupplierPriceMatrixReport } from './SupplierPriceMatrixReport';
import { usePurchaseModuleFilters, PurchaseFilterButton } from '../Model/PurchaseFilters';

interface Props {
  purchases: PurchaseRecord[];
  products: Product[];
  suppliers: Supplier[];
}

export default function ReportsTab({ purchases, products, suppliers }: Props) {
  const {
    appliedFilters,
    hasAnyFilter,
    supplierId,
    productId,
    category,
    productSupplierCount,
    fromDate,
    toDate,
    openFilterModal,
  } = usePurchaseModuleFilters();

  const [isGenerating1, setIsGenerating1] = useState(false);
  const [isGenerating2, setIsGenerating2] = useState(false);
  const [isGenerating3, setIsGenerating3] = useState(false);
  const [isGenerating4, setIsGenerating4] = useState(false);
  const [isGenerating5, setIsGenerating5] = useState(false);
  const [isGenerating6, setIsGenerating6] = useState(false);

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    parts.push(
      supplierId
        ? suppliers.find((s) => s.id === supplierId)?.name || 'Supplier'
        : 'All Suppliers',
    );
    parts.push(
      productSupplierCount
        ? productSupplierCount === '1'
          ? '1 Supplier / Product'
          : `${productSupplierCount} Suppliers / Product`
        : 'All Supplier Counts',
    );
    parts.push(category || 'All Categories');
    parts.push(
      productId ? products.find((p) => p.id === productId)?.name || 'Product' : 'All Products',
    );
    return parts.join(' · ');
  }, [supplierId, productSupplierCount, category, productId, suppliers, products]);

  const handleDownloadSupplierReport = async () => {
    if (!supplierId) return;
    setIsGenerating1(true);
    const supplier = suppliers.find((s) => s.id === supplierId);
    if (supplier) {
      await generateSupplierPriceHistoryReport(supplier.name, purchases, products, appliedFilters);
    }
    setIsGenerating1(false);
  };

  const handleDownloadProductReport = async () => {
    if (!productId) return;
    setIsGenerating2(true);
    const product = products.find((p) => p.id === productId);
    if (product) {
      await generateProductSupplierComparisonReport(
        product.name,
        purchases,
        suppliers,
        appliedFilters,
        products,
      );
    }
    setIsGenerating2(false);
  };

  const handleDownloadInflationReport = async () => {
    setIsGenerating3(true);
    await generatePriceInflationReport(purchases, products, appliedFilters);
    setIsGenerating3(false);
  };

  const handleDownloadDependencyReport = async () => {
    setIsGenerating4(true);
    await generateSupplierDependencyReport(purchases, products, suppliers, appliedFilters);
    setIsGenerating4(false);
  };

  const handleDownloadPriceSequenceReport = async () => {
    setIsGenerating5(true);
    await generateProductPriceSequenceReport(purchases, products, appliedFilters);
    setIsGenerating5(false);
  };

  const handleDownloadMatrixReport = async () => {
    setIsGenerating6(true);
    await generateSupplierPriceMatrixReport(purchases, products, suppliers, appliedFilters);
    setIsGenerating6(false);
  };

  const reportCards = [
    {
      title: 'Price Inflation',
      icon: TrendingUp,
      accent: 'border-t-rose-500',
      iconClass: 'text-rose-500 bg-rose-50',
      onClick: handleDownloadInflationReport,
      disabled: isGenerating3,
      loading: isGenerating3,
    },
    {
      title: 'Price Sequence',
      icon: ListOrdered,
      accent: 'border-t-amber-500',
      iconClass: 'text-amber-600 bg-amber-50',
      onClick: handleDownloadPriceSequenceReport,
      disabled: isGenerating5,
      loading: isGenerating5,
    },
    {
      title: 'Product Comparison',
      icon: Package,
      accent: 'border-t-emerald-500',
      iconClass: 'text-emerald-500 bg-emerald-50',
      onClick: handleDownloadProductReport,
      disabled: !productId || isGenerating2,
      loading: isGenerating2,
    },
    {
      title: 'Supplier Dependency',
      icon: AlertTriangle,
      accent: 'border-t-purple-500',
      iconClass: 'text-purple-500 bg-purple-50',
      onClick: handleDownloadDependencyReport,
      disabled: isGenerating4,
      loading: isGenerating4,
    },
    {
      title: 'Supplier History',
      icon: Building2,
      accent: 'border-t-blue-500',
      iconClass: 'text-blue-500 bg-blue-50',
      onClick: handleDownloadSupplierReport,
      disabled: !supplierId || isGenerating1,
      loading: isGenerating1,
    },
    {
      title: 'Supplier Price Matrix',
      icon: Grid3x3,
      accent: 'border-t-teal-500',
      iconClass: 'text-teal-600 bg-teal-50',
      onClick: handleDownloadMatrixReport,
      disabled: isGenerating6,
      loading: isGenerating6,
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-[#D4AF37]" />
            Excel Reports
          </h2>
          <p className="text-slate-500 font-medium mt-1">
            Use sidebar filters, then download any report below.
          </p>
        </div>
        <PurchaseFilterButton />
      </div>

      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-800">
            <Filter className="w-5 h-5 text-[#D4AF37]" />
            <h3 className="font-bold text-lg">Active Filters</h3>
            {hasAnyFilter && (
              <span className="text-[10px] font-black uppercase tracking-widest bg-[#D4AF37]/10 text-[#b8962e] px-2 py-0.5 rounded-full">
                Applied
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={openFilterModal}
            className="text-sm font-bold text-[#b8962e] hover:text-[#D4AF37] transition-colors"
          >
            Edit Filters
          </button>
        </div>
        <p className="text-sm font-medium text-slate-500 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 mt-4">
          Active scope: <span className="font-bold text-slate-700">{filterSummary}</span>
          {(fromDate || toDate) && (
            <span className="text-slate-500">
              {' '}
              · {fromDate || '…'} → {toDate || '…'}
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {reportCards.map((report) => {
          const Icon = report.icon;
          return (
            <div
              key={report.title}
              className={`bg-white px-4 py-4 rounded-xl border border-slate-100 shadow-sm border-t-[3px] ${report.accent} flex items-center justify-between gap-3 hover:shadow-md transition-shadow min-h-[68px]`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className={`p-2 rounded-lg shrink-0 ${report.iconClass}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-[15px] font-bold text-slate-800 leading-tight truncate">
                  {report.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={report.onClick}
                disabled={report.disabled}
                title={`Download ${report.title}`}
                className="shrink-0 w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center hover:bg-[#D4AF37] hover:text-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {report.loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Download className="w-[18px] h-[18px]" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
