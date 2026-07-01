'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Save, Search, Trash2, X, Target, ChevronDown } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import NoData from '@/app/Components/NoDataTab';
import SalesTabLoader from './SalesTabLoader';

type TargetType = 'sales_rep' | 'merchandiser';

type TargetRow = {
  userId: string;
  userName: string;
  targetAmount: number;
  isNew?: boolean;
  isDirty?: boolean;
};

interface SalesTargetsTabProps {
  userId: string;
  refreshTrigger?: number;
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

export default function SalesTargetsTab({ userId, refreshTrigger }: SalesTargetsTabProps) {
  const now = new Date();
  const [year, setYear] = useState(Math.max(2025, now.getFullYear()));
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [targetType, setTargetType] = useState<TargetType>('sales_rep');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<TargetRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [usersList, setUsersList] = useState<{ id: string; name: string }[]>([]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const addDropdownRef = useRef<HTMLDivElement>(null);
  const [yearsWithData, setYearsWithData] = useState<number[]>([2025]);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const fetchYearsWithData = useCallback(async () => {
    if (!userId) return;
    try {
      const params = new URLSearchParams({ userId, listYears: 'true' });
      const response = await fetch(`/api/Sales/Targets?${params}`);
      if (!response.ok) return;
      const result = await response.json();
      const years = (result.years || [2025]) as number[];
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
  }, [fetchYearsWithData, refreshTrigger]);

  useEffect(() => {
    if (yearOptions.length && !yearOptions.includes(year)) {
      setYear(yearOptions[yearOptions.length - 1]);
    }
  }, [yearOptions, year]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addDropdownRef.current && !addDropdownRef.current.contains(event.target as Node)) {
        setShowAddDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/DataBase/Users/api');
        if (response.ok) {
          const result = await response.json();
          setUsersList(result.users || []);
        }
      } catch (err) {
        console.error('Error fetching users:', err);
      }
    };
    fetchUsers();
  }, []);

  const fetchTargets = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        userId,
        year: String(year),
        month: String(month),
        type: targetType,
      });
      const response = await fetch(`/api/Sales/Targets?${params}`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to load targets');
      }
      const result = await response.json();
      setRows(
        (result.data || []).map((r: TargetRow) => ({
          userId: r.userId,
          userName: r.userName,
          targetAmount: r.targetAmount,
        }))
      );
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to load targets');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [userId, year, month, targetType]);

  useEffect(() => {
    fetchTargets();
  }, [fetchTargets, refreshTrigger]);

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter((r) => r.userName.toLowerCase().includes(q));
  }, [rows, searchQuery]);

  const existingUserIds = useMemo(() => new Set(rows.map((r) => r.userId)), [rows]);

  const availableUsers = useMemo(() => {
    const q = addSearchQuery.toLowerCase();
    return usersList.filter(
      (u) =>
        !existingUserIds.has(u.id) &&
        u.name.toLowerCase().includes(q)
    );
  }, [usersList, existingUserIds, addSearchQuery]);

  const updateRowAmount = (userIdKey: string, value: string) => {
    const amount = value === '' ? 0 : Number(value);
    setRows((prev) =>
      prev.map((r) =>
        r.userId === userIdKey
          ? { ...r, targetAmount: Number.isFinite(amount) ? amount : r.targetAmount, isDirty: true }
          : r
      )
    );
  };

  const handleDelete = async (row: TargetRow) => {
    toast.loading('Deleting target...', { id: 'del_target' });
    try {
      const params = new URLSearchParams({
        userId,
        targetUserId: row.userId,
        year: String(year),
        month: String(month),
        type: targetType,
      });
      const response = await fetch(`/api/Sales/Targets?${params}`, { method: 'DELETE' });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete');
      }
      toast.success('Target removed');
      await fetchYearsWithData();
      fetchTargets();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete target');
    } finally {
      toast.dismiss('del_target');
    }
  };

  const handleAddPerson = async () => {
    if (!addUserId) {
      toast.error('Select a person first');
      return;
    }
    const amount = parseDecimalInput(addAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error('Enter a valid target amount');
      return;
    }

    setSaving(true);
    toast.loading('Saving target...', { id: 'add_target' });
    try {
      const response = await fetch('/api/Sales/Targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          targetUserId: addUserId,
          year,
          month,
          type: targetType,
          targetAmount: amount,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save');
      }
      toast.success('Target added');
      setShowAddForm(false);
      setAddUserId('');
      setAddAmount('');
      setAddSearchQuery('');
      await fetchYearsWithData();
      fetchTargets();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add target');
    } finally {
      setSaving(false);
      toast.dismiss('add_target');
    }
  };

  const handleSaveMonth = async () => {
    const dirtyRows = rows.filter((r) => r.isDirty);
    if (dirtyRows.length === 0) {
      toast.info('No changes to save');
      return;
    }

    setSaving(true);
    toast.loading('Saving targets...', { id: 'save_targets' });
    try {
      const response = await fetch('/api/Sales/Targets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          year,
          month,
          type: targetType,
          targets: dirtyRows.map((r) => ({
            userId: r.userId,
            targetAmount: r.targetAmount,
          })),
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save');
      }
      toast.success('Targets saved');
      await fetchYearsWithData();
      fetchTargets();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save targets');
    } finally {
      setSaving(false);
      toast.dismiss('save_targets');
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

  if (loading && rows.length === 0) {
    return <SalesTabLoader />;
  }

  const typeLabel = targetType === 'sales_rep' ? 'Sales Rep' : 'Merchandiser';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-100 shrink-0">
            <Target className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 shrink-0">Monthly Targets</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTargetType('sales_rep')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                targetType === 'sales_rep'
                  ? 'bg-green-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Sales Rep Targets
            </button>
            <button
              type="button"
              onClick={() => setTargetType('merchandiser')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                targetType === 'merchandiser'
                  ? 'bg-green-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Merchandiser Targets
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 w-64 shrink-0">
          <PeriodSelect
            label="Year"
            value={String(year)}
            options={yearSelectOptions}
            onChange={(v) => setYear(Number(v))}
          />
          <PeriodSelect
            label="Month"
            value={String(month)}
            options={monthSelectOptions}
            onChange={(v) => setMonth(Number(v))}
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={`Search ${typeLabel.toLowerCase()}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="h-10 w-10 flex items-center justify-center bg-white border border-green-200 text-green-700 rounded-xl hover:bg-green-50 transition-all shadow-sm"
            title="Add Person"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleSaveMonth}
            disabled={saving}
            className="h-10 w-10 flex items-center justify-center bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-50"
            title="Save Changes"
          >
            <Save className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredRows.length === 0 ? (
          <NoData title="NO TARGETS FOUND" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-center">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-center">
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase text-center">#</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase text-center">{typeLabel}</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase text-center">Target Amount</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase text-center w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row, idx) => (
                  <tr key={row.userId} className="hover:bg-slate-50 text-center">
                    <td className="px-4 py-3 text-xs text-slate-500 text-center">{idx + 1}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-800 text-center">{row.userName}</td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        min={0}
                        value={row.targetAmount}
                        onChange={(e) => updateRowAmount(row.userId, e.target.value)}
                        className="w-40 mx-auto px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-center focus:border-green-500 outline-none"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => handleDelete(row)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Remove from this month"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddForm && portalReady && createPortal(
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !saving && setShowAddForm(false)} />
          <div className="relative w-full max-w-md max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-6 pb-4 space-y-4 overflow-y-auto flex-1 min-h-0">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Add {typeLabel}</h3>
              <button type="button" onClick={() => !saving && setShowAddForm(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div ref={addDropdownRef}>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Person</label>
              <input
                type="text"
                value={addSearchQuery}
                onChange={(e) => {
                  setAddSearchQuery(e.target.value);
                  setAddUserId('');
                  setShowAddDropdown(true);
                }}
                onFocus={() => setShowAddDropdown(true)}
                placeholder="Search by name..."
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium"
              />
              {showAddDropdown && (
                <div className="mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-sm max-h-36 overflow-y-auto p-1 scrollbar-thin">
                  {availableUsers.length > 0 ? (
                    availableUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setAddUserId(u.id);
                          setAddSearchQuery(u.name);
                          setShowAddDropdown(false);
                        }}
                        className={`w-full px-3 py-2 rounded-lg text-left text-sm font-semibold hover:bg-slate-50 ${
                          addUserId === u.id ? 'bg-green-50 text-green-700' : 'text-slate-700'
                        }`}
                      >
                        {u.name}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-xs text-slate-400 text-center">No users available</div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target Amount</label>
              <input
                type="text"
                inputMode="decimal"
                value={addAmount}
                onChange={(e) => setAddAmount(formatDecimalInput(e.target.value))}
                placeholder="0.00"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium"
              />
            </div>
            </div>

            <div className="flex justify-end gap-2 p-6 pt-4 border-t border-slate-100 bg-white shrink-0">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                disabled={saving}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddPerson}
                disabled={saving}
                className="px-5 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
