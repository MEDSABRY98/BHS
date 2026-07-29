'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Save, Search, Target, ChevronDown, Users, X, AlertCircle } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import NoData from '@/app/Components/NoDataTab';
import SalesTabLoader from '@/app/Sales/Shared/TabLoader';
import { getTargetYears, getTargetsData, batchSaveTargets } from '../Service/sales_targets_service';
import { useSalesDataContext } from '@/app/Sales/Context/SalesDataContext';

type TargetRow = {
  userId: string;
  userName: string;
  targetAmount: number;
  type: 'sales_rep' | 'merchandiser';
  isDirty?: boolean;
  merchandisers?: TargetRow[];
  supervisorId?: string | null;
};

interface SalesTargetsTabProps {
  userId: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatDecimalInput(input: string): string {
  const sanitized = input.replace(/[^\d.]/g, '');
  if (!sanitized) return '';

  const dotIndex = sanitized.indexOf('.');
  const intPart = dotIndex === -1 ? sanitized : sanitized.slice(0, dotIndex);
  const decPart =
    dotIndex === -1 ? '' : sanitized.slice(dotIndex + 1).replace(/\./g, '').slice(0, 2);

  const formattedInt = intPart ? Number(intPart).toLocaleString('en-US') : '';

  if (dotIndex !== -1) {
    if (decPart.length === 0 && sanitized.endsWith('.')) {
      return `${formattedInt || '0'}.`;
    }
    return `${formattedInt || '0'}.${decPart}`;
  }

  return formattedInt;
}

function parseDecimalInput(input: string): number {
  return Number(input.replace(/,/g, ''));
}

function PeriodSelect({
  value,
  label,
  options,
  onChange,
}: {
  value: string;
  label: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl shadow-sm text-sm font-bold text-slate-800 flex items-center justify-between gap-2 hover:border-green-300 focus:border-green-500 outline-none transition-all"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-green-600' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full min-w-full bg-white border border-slate-200 rounded-xl shadow-2xl max-h-56 overflow-y-auto p-1.5 scrollbar-thin animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            {label}
          </div>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 rounded-lg text-left text-sm font-semibold transition-colors ${
                value === opt.value
                  ? 'bg-green-50 text-green-700'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SalesTargetsTab({ userId }: SalesTargetsTabProps) {
  const { dataVersion } = useSalesDataContext();
  const now = new Date();
  const [year, setYear] = useState(Math.max(2025, now.getFullYear()));
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [salesReps, setSalesReps] = useState<TargetRow[]>([]);
  const [unassigned, setUnassigned] = useState<TargetRow[]>([]);
  const [hasSalesDataAccess, setHasSalesDataAccess] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [yearsWithData, setYearsWithData] = useState<number[]>([2025]);

  // Modal State
  const [activeRep, setActiveRep] = useState<TargetRow | null>(null);

  const fetchYearsWithData = useCallback(async () => {
    if (!userId) return;
    try {
      const years = await getTargetYears();
      setYearsWithData(years.length ? years : [2025]);
    } catch (err) {
      console.error('Error fetching target years:', err);
    }
  }, [userId]);

  const yearOptions = useMemo(() => {
    const set = new Set<number>([2025, ...yearsWithData]);
    if (year >= 2025) set.add(year);
    return Array.from(set).sort((a, b) => a - b);
  }, [yearsWithData, year]);

  useEffect(() => {
    fetchYearsWithData();
  }, [fetchYearsWithData, dataVersion]);

  useEffect(() => {
    if (yearOptions.length && !yearOptions.includes(year)) {
      setYear(yearOptions[yearOptions.length - 1]);
    }
  }, [yearOptions, year]);

  const fetchTargets = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const result = await getTargetsData(userId, year, month);
      setSalesReps(result.salesReps || []);
      setUnassigned(result.unassignedMerchandisers || []);
      setHasSalesDataAccess(!!result.hasSalesDataAccess);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to load targets');
      setSalesReps([]);
      setUnassigned([]);
    } finally {
      setLoading(false);
    }
  }, [userId, year, month]);

  useEffect(() => {
    fetchTargets();
  }, [fetchTargets, dataVersion]);

  const filteredReps = useMemo(() => {
    if (!searchQuery.trim()) return salesReps;
    const q = searchQuery.toLowerCase();
    return salesReps.filter((r) => r.userName.toLowerCase().includes(q));
  }, [salesReps, searchQuery]);

  const updateRepAmount = (userIdKey: string, value: string) => {
    const amount = value === '' ? 0 : Number(value);
    setSalesReps((prev) =>
      prev.map((r) =>
        r.userId === userIdKey
          ? { ...r, targetAmount: Number.isFinite(amount) ? amount : r.targetAmount, isDirty: true }
          : r
      )
    );
    // If modal is open for this rep, update it too
    if (activeRep?.userId === userIdKey) {
      setActiveRep(prev => prev ? { ...prev, targetAmount: Number.isFinite(amount) ? amount : prev.targetAmount, isDirty: true } : prev);
    }
  };

  const updateMerchAmount = (repId: string, merchId: string, value: string) => {
    const amount = value === '' ? 0 : Number(value);
    setSalesReps((prev) =>
      prev.map((r) => {
        if (r.userId === repId) {
          return {
            ...r,
            merchandisers: (r.merchandisers || []).map(m => 
              m.userId === merchId ? { ...m, targetAmount: Number.isFinite(amount) ? amount : m.targetAmount, isDirty: true } : m
            )
          };
        }
        return r;
      })
    );
    
    // Update active modal rep instantly
    if (activeRep?.userId === repId) {
      setActiveRep(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          merchandisers: (prev.merchandisers || []).map(m => 
            m.userId === merchId ? { ...m, targetAmount: Number.isFinite(amount) ? amount : m.targetAmount, isDirty: true } : m
          )
        };
      });
    }
  };

  const flattenDirtyRows = () => {
    const dirty: TargetRow[] = [];
    salesReps.forEach(r => {
      if (r.isDirty) dirty.push(r);
      (r.merchandisers || []).forEach(m => {
        if (m.isDirty) dirty.push(m);
      });
    });
    unassigned.forEach(u => {
      if (u.isDirty) dirty.push(u);
    });
    return dirty;
  };

  const handleSaveMonth = async () => {
    // Validate Allocations
    let validationError = false;
    salesReps.forEach(rep => {
      if (rep.merchandisers && rep.merchandisers.length > 0) {
        const totalMerchTarget = rep.merchandisers.reduce((sum, m) => sum + (m.targetAmount || 0), 0);
        if (totalMerchTarget !== (rep.targetAmount || 0)) {
          toast.error(`Total allocated to merchandisers for ${rep.userName} does not match their target!`);
          validationError = true;
        }
      }
    });

    if (validationError) return;

    const dirtyRows = flattenDirtyRows();
    if (dirtyRows.length === 0) {
      toast.info('No changes to save');
      return;
    }

    setSaving(true);
    toast.loading('Saving targets...', { id: 'save_targets' });
    try {
      await batchSaveTargets(userId, year, month, 'sales_rep', dirtyRows.map((r) => ({
        userId: r.userId,
        targetAmount: r.targetAmount,
        type: r.type
      })));
      toast.success('Targets saved');
      await fetchYearsWithData();
      fetchTargets();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save targets');
    } finally {
      setSaving(false);
      toast.dismiss('save_targets');
      setActiveRep(null);
    }
  };

  const yearSelectOptions = useMemo(
    () => yearOptions.map((y) => ({ value: String(y), label: String(y) })),
    [yearOptions]
  );

  const monthSelectOptions = useMemo(
    () => MONTH_NAMES.map((name, i) => ({ value: String(i + 1), label: name })),
    []
  );

  if (loading && salesReps.length === 0) {
    return <SalesTabLoader />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-100 shrink-0">
            <Target className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 shrink-0">Sales Rep Targets</h1>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="w-28 shrink-0">
              <PeriodSelect
                value={String(year)}
                label="Year"
                options={yearSelectOptions}
                onChange={(val) => setYear(Number(val))}
              />
            </div>
            <div className="w-36 shrink-0">
              <PeriodSelect
                value={String(month)}
                label="Month"
                options={monthSelectOptions}
                onChange={(val) => setMonth(Number(val))}
              />
            </div>
          </div>
          
          <button
            onClick={handleSaveMonth}
            disabled={saving}
            className="w-full sm:w-auto px-6 h-10 bg-black text-[#D4AF37] hover:bg-slate-800 rounded-xl font-bold text-sm transition-all shadow-xl shadow-black/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save All
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search Sales Rep..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all placeholder:font-normal"
            />
          </div>
          <div className="text-sm font-bold text-slate-500 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
            {filteredReps.length} Sales Reps
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          {filteredReps.length > 0 ? (
            <table className="w-full text-center border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase font-extrabold tracking-widest text-slate-400">
                  <th className="py-4 px-6 w-[20%] text-center">User ID</th>
                  <th className="py-4 px-6 w-[35%] text-center">Name</th>
                  <th className="py-4 px-6 w-[20%] text-center">Merchandisers</th>
                  <th className="py-4 px-6 w-[25%] text-center">Target Amount (AED)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReps.map((row) => (
                  <tr
                    key={row.userId}
                    className="group hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-3 px-6 text-center">
                      <div className="font-mono text-xs font-bold text-slate-500 bg-slate-100/50 px-2.5 py-1 rounded-md inline-block">
                        {row.userId}
                      </div>
                    </td>
                    <td className="py-3 px-6">
                      <div className="font-bold text-sm text-slate-800 flex items-center justify-center gap-2">
                        {row.userName}
                        {row.isDirty && (
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Unsaved changes" />
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-6">
                      <div className="flex justify-center">
                        {row.merchandisers && row.merchandisers.length > 0 ? (
                          <button
                            onClick={() => setActiveRep(row)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-xs font-bold transition-colors border border-green-200"
                          >
                            <Users className="w-3.5 h-3.5" />
                            View ({row.merchandisers.length})
                          </button>
                        ) : (
                          <span className="text-xs font-medium text-slate-400 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                            None
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-6">
                      <div className="flex justify-center">
                        <div className="relative group/input max-w-[180px] w-full">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 group-focus-within/input:text-green-600 transition-colors">
                            AED
                          </span>
                          <input
                            type="text"
                            disabled={!hasSalesDataAccess}
                            value={formatDecimalInput(String(row.targetAmount || ''))}
                            onChange={(e) => updateRepAmount(row.userId, String(parseDecimalInput(e.target.value)))}
                            className={`w-full h-10 pl-12 pr-4 text-sm font-bold text-center rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-green-500/20 disabled:opacity-60 disabled:cursor-not-allowed ${
                              row.isDirty
                                ? 'bg-amber-50 border-amber-200 focus:border-amber-500 text-amber-900'
                                : 'bg-slate-50 border-slate-200 focus:border-green-500 text-slate-800'
                            }`}
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-12">
              <NoData
                title={
                  searchQuery
                    ? `No sales reps match "${searchQuery}"`
                    : 'No active sales reps found.'
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* Merchandiser Allocation Modal */}
      {activeRep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setActiveRep(null)} />
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  Merchandiser Targets
                </h2>
                <p className="text-sm font-medium text-slate-500 mt-1">
                  Allocate <span className="text-black font-bold">AED {formatDecimalInput(String(activeRep.targetAmount || 0))}</span> for {activeRep.userName}
                </p>
              </div>
              <button
                onClick={() => setActiveRep(null)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
              <div className="space-y-4">
                {(activeRep.merchandisers || []).map((merch) => (
                  <div key={merch.userId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-200 transition-all">
                    <div>
                      <div className="font-bold text-sm text-slate-800">{merch.userName}</div>
                      <div className="font-mono text-[11px] font-bold text-slate-500 mt-1">{merch.userId}</div>
                    </div>
                    <div className="relative max-w-[180px] w-full shrink-0">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        AED
                      </span>
                      <input
                        type="text"
                        value={formatDecimalInput(String(merch.targetAmount || ''))}
                        onChange={(e) => updateMerchAmount(activeRep.userId, merch.userId, String(parseDecimalInput(e.target.value)))}
                        className={`w-full h-10 pl-12 pr-4 text-sm font-bold text-right rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-green-500/20 ${
                          merch.isDirty
                            ? 'bg-amber-50 border-amber-200 focus:border-amber-500 text-amber-900'
                            : 'bg-white border-slate-200 focus:border-green-500 text-slate-800'
                        }`}
                        placeholder="0"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/80 rounded-b-3xl">
              {(() => {
                const totalAllocated = (activeRep.merchandisers || []).reduce((sum, m) => sum + (m.targetAmount || 0), 0);
                const isMatch = totalAllocated === (activeRep.targetAmount || 0);
                
                return (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${isMatch ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                      {isMatch ? <Target className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                      <div className="font-bold text-sm">
                        Total Allocated: AED {formatDecimalInput(String(totalAllocated))} 
                        <span className="text-xs font-medium ml-1 opacity-70">/ {formatDecimalInput(String(activeRep.targetAmount || 0))}</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => setActiveRep(null)}
                      className="px-6 py-2.5 bg-black text-[#D4AF37] hover:bg-slate-800 rounded-xl font-bold text-sm transition-all shadow-md shadow-black/10"
                    >
                      Done
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
