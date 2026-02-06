'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Clock, Plus, List, Trash2, Save, ArrowLeft, X, Edit2, Download, Search,
  BarChart3, ChevronDown, ChevronRight, Calendar, User, Calculator
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function EmployeeOvertimeTab() {
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Error parsing user:', e);
      }
    }
  }, []);

  const [activeTab, setActiveTab] = useState<'register' | 'view' | 'statistics' | 'absence'>(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        if (user?.name === 'Overtime Export') {
          return 'view';
        }
      } catch (e) { }
    }
    return 'register';
  });

  const [overtimeRecords, setOvertimeRecords] = useState<any[]>([]);
  const [employeeNames, setEmployeeNames] = useState<string[]>([]);
  const [employeeSalaries, setEmployeeSalaries] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const recordsFetchedRef = useRef(false);

  // New Row Structure matching user request:
  // Employee Name, Shift Hours (Standard), Start Time, End Time, Overtime Hours, Deduction Hours
  const [currentRows, setCurrentRows] = useState([{
    id: Date.now(),
    employeeName: '',
    shiftHours: '9', // Default standard shift
    shiftStart: '7',
    shiftStartAmPm: 'AM',
    shiftEnd: '4',
    shiftEndAmPm: 'PM',
    overtimeHours: '0',
    deductionHours: '0',
    description: '',
  }]);

  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);

  // Absence State
  const [absenceRecords, setAbsenceRecords] = useState<any[]>([]);
  const [loadingAbsence, setLoadingAbsence] = useState(false);
  const [absenceSubTab, setAbsenceSubTab] = useState<'register' | 'stats'>('register');
  const [absenceDate, setAbsenceDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentAbsenceRows, setCurrentAbsenceRows] = useState([{
    id: Date.now(),
    employeeName: '',
    particulars: 'Absent'
  }]);

  // Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [editingRecord, setEditingRecord] = useState({
    date: '',
    employeeName: '',
    shiftHours: '9',
    shiftStart: '',
    shiftStartAmPm: 'AM',
    shiftEnd: '',
    shiftEndAmPm: 'PM',
    overtimeHours: '0',
    deductionHours: '0',
    description: '',
    type: 'Overtime' // Kept for backend compatibility
  });
  const [isSaving, setIsSaving] = useState(false);

  // Custom Dropdown State
  const [openDropdown, setOpenDropdown] = useState<{ id: number, field: string } | null>(null);

  // Filters
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statsSearchQuery, setStatsSearchQuery] = useState('');
  const [showAbsentStats, setShowAbsentStats] = useState(false);

  // Expanded Groups in View
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  // Delete Confirmation State
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean, rowIndex: number | null }>({ show: false, rowIndex: null });

  // Fetch employee names on mount
  useEffect(() => {
    const fetchEmployeeNames = async () => {
      try {
        const response = await fetch('/api/employee-overtime?type=names');
        const data = await response.json();
        if (response.ok) {
          setEmployeeNames(data.names || []);
          if (data.salaries) setEmployeeSalaries(data.salaries);
        }
      } catch (error) {
        console.error('Error fetching employee names:', error);
      }
    };
    fetchEmployeeNames();
  }, []);

  // Fetch records when switching to View tab
  useEffect(() => {
    if (activeTab === 'view' && !recordsFetchedRef.current) {
      fetchRecords();
      recordsFetchedRef.current = true;
    }
  }, [activeTab]);

  const fetchRecords = async () => {
    try {
      setLoadingRecords(true);
      const response = await fetch(`/api/employee-overtime?t=${Date.now()}`);
      const data = await response.json();
      if (response.ok) {
        setOvertimeRecords(data.records || []);
      }
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setLoadingRecords(false);
    }
  };

  const fetchAbsenceRecords = async () => {
    try {
      setLoadingAbsence(true);
      const response = await fetch(`/api/employee-overtime?type=absence&t=${Date.now()}`);
      const data = await response.json();
      if (response.ok) {
        setAbsenceRecords(data.records || []);
      }
    } catch (error) {
      console.error('Error fetching absence records:', error);
    } finally {
      setLoadingAbsence(false);
    }
  };

  const handleDeleteAbsence = async (rowIndex: number) => {
    setDeleteConfirm({ show: true, rowIndex });
  };

  const confirmDeleteAbsence = async () => {
    if (deleteConfirm.rowIndex === null) return;
    try {
      setIsSaving(true);
      const response = await fetch('/api/employee-overtime', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowIndex: deleteConfirm.rowIndex,
          mode: 'absence'
        }),
      });

      if (response.ok) {
        fetchAbsenceRecords();
      }
    } catch (error) {
      console.error('Error deleting absence:', error);
    } finally {
      setIsSaving(false);
      setDeleteConfirm({ show: false, rowIndex: null });
    }
  };

  useEffect(() => {
    if (activeTab === 'absence' && absenceSubTab === 'stats') {
      fetchAbsenceRecords();
    }
  }, [activeTab, absenceSubTab]);

  const formatDateForInput = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) {
        // Handle cases like "30-Jan-2026" manually if Date fails
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          const months: Record<string, string> = {
            'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
            'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
          };
          const day = parts[0].padStart(2, '0');
          const month = months[parts[1]] || '01';
          const year = parts[2];
          return `${year}-${month}-${day}`;
        }
        return '';
      }
      return d.toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  };

  const openEditModal = (record: any) => {
    setSelectedRecord(record);
    setEditingRecord({
      date: formatDateForInput(record.date),
      employeeName: record.employeeName,
      shiftHours: record.shiftHours || '9',
      shiftStart: record.shiftStart || '',
      shiftStartAmPm: record.shiftStartAmPm || 'AM',
      shiftEnd: record.shiftEnd || '',
      shiftEndAmPm: record.shiftEndAmPm || 'PM',
      overtimeHours: record.overtimeHours || '0',
      deductionHours: record.deductionHours || '0',
      description: record.description || '',
      type: record.type || 'Overtime'
    });
    setIsModalOpen(true);
  };

  const handleUpdateRecord = async () => {
    if (!selectedRecord) return;
    try {
      setIsSaving(true);
      const response = await fetch('/api/employee-overtime', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowIndex: selectedRecord.rowIndex,
          ...editingRecord,
          // Combine for backend
          shiftStart: `${editingRecord.shiftStart} ${editingRecord.shiftStartAmPm}`,
          shiftEnd: `${editingRecord.shiftEnd} ${editingRecord.shiftEndAmPm}`,
        }),
      });

      if (response.ok) {
        setIsModalOpen(false);
        fetchRecords();
      }
    } catch (error) {
      console.error('Error updating:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRecord = async () => {
    if (!selectedRecord || !confirm('Are you sure you want to delete this record?')) return;
    try {
      setIsSaving(true);
      const response = await fetch('/api/employee-overtime', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: selectedRecord.rowIndex }),
      });

      if (response.ok) {
        setIsModalOpen(false);
        fetchRecords();
      }
    } catch (error) {
      console.error('Error deleting:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Helper: Convert H.MM format (where .20 is 20 mins) to decimal hours
  const timeToDecimal = (t: string | number): number => {
    if (!t) return 0;
    const s = t.toString().trim();
    const sign = s.startsWith('-') ? -1 : 1;
    const absS = s.startsWith('-') ? s.substring(1) : s;

    if (!absS.includes('.') && !absS.includes(':')) return parseFloat(absS) || 0;

    const parts = absS.includes(':') ? absS.split(':') : absS.split('.');
    const h = parseInt(parts[0]) || 0;
    let mStr = parts[1] || '0';
    if (mStr.length === 1) mStr += '0'; // treat .2 as 20 mins
    const m = parseInt(mStr.substring(0, 2)) || 0;
    return (h + m / 60) * sign;
  };

  // Helper: Convert decimal hours to H.MM format string
  const decimalToTime = (decimal: number): string => {
    if (isNaN(decimal) || decimal === 0) return '0';
    const sign = decimal < 0 ? '-' : '';
    const absD = Math.abs(decimal);
    const h = Math.floor(absD);
    const m = Math.round((absD - h) * 60);
    return `${sign}${h}.${m.toString().padStart(2, '0')}`;
  };

  // Helper: Calculate hours between two time strings (HH:mm or HH.mm) with AM/PM
  const calculateDuration = (start: string, startAmPm: string, end: string, endAmPm: string): number => {
    if (!start || !end) return 0;

    const parseToMins = (t: string, ampm: string) => {
      let h = 0, m = 0;
      const cleanT = t.trim().replace(':', '.');
      if (cleanT.includes('.')) {
        const parts = cleanT.split('.');
        h = parseInt(parts[0]) || 0;
        let mStr = parts[1] || '0';
        if (mStr.length === 1) mStr += '0';
        m = parseInt(mStr.substring(0, 2)) || 0;
      } else {
        h = parseInt(cleanT) || 0;
      }

      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    };

    const sMins = parseToMins(start, startAmPm);
    let eMins = parseToMins(end, endAmPm);

    if (eMins < sMins) eMins += 24 * 60;
    return (eMins - sMins) / 60;
  };

  const updateRow = (id: number, field: string, value: string) => {
    setCurrentRows(currentRows.map(row => {
      if (row.id === id) {
        const updated = { ...row, [field]: value };

        // Auto-calculate Overtime/Deduction if start, end, shiftHours shift
        if (field === 'shiftStart' || field === 'shiftEnd' || field === 'shiftHours' || field === 'shiftStartAmPm' || field === 'shiftEndAmPm') {
          const start = field === 'shiftStart' ? value : row.shiftStart;
          const sAmPm = field === 'shiftStartAmPm' ? value : row.shiftStartAmPm;
          const end = field === 'shiftEnd' ? value : row.shiftEnd;
          const eAmPm = field === 'shiftEndAmPm' ? value : row.shiftEndAmPm;
          const standard = parseFloat(field === 'shiftHours' ? value : row.shiftHours) || 0;

          if (start && end && standard > 0) {
            const duration = calculateDuration(start, sAmPm, end, eAmPm);
            if (duration >= 0) {
              const diff = duration - standard;
              if (diff > 0.001) { // Overtime
                updated.overtimeHours = decimalToTime(diff);
                updated.deductionHours = '0';
              } else if (diff < -0.001) { // Deduction
                updated.overtimeHours = '0';
                updated.deductionHours = decimalToTime(Math.abs(diff));
              } else {
                updated.overtimeHours = '0';
                updated.deductionHours = '0';
              }
            }
          }
        }
        return updated;
      }
      return row;
    }));
  };

  const addNewRow = () => {
    setCurrentRows([...currentRows, {
      id: Date.now(),
      employeeName: '',
      shiftHours: '9',
      shiftStart: '7',
      shiftStartAmPm: 'AM',
      shiftEnd: '4',
      shiftEndAmPm: 'PM',
      overtimeHours: '0',
      deductionHours: '0',
      description: '',
    }]);
  };

  const deleteRow = (id: number) => {
    if (currentRows.length > 1) {
      setCurrentRows(currentRows.filter(row => row.id !== id));
    }
  };

  const saveAllRecords = async () => {
    const validRows = currentRows.filter(row => row.employeeName.trim());

    if (validRows.length === 0) {
      alert('Please select at least one employee');
      return;
    }

    try {
      setLoading(true);
      for (const row of validRows) {
        // Prepare combined time strings - User requested RAW values (e.g. 4.3, 5) without AM/PM text
        // const shiftStartCombined = row.shiftStart ? `${row.shiftStart} ${row.shiftStartAmPm}` : '';
        // const shiftEndCombined = row.shiftEnd ? `${row.shiftEnd} ${row.shiftEndAmPm}` : '';

        const type = parseFloat(row.deductionHours) > 0 ? 'Deduction' : 'Overtime';

        await fetch('/api/employee-overtime', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: currentDate,
            employeeName: row.employeeName,
            type: type,
            description: row.description,
            // Map new fields - Sending combined values for backend parser
            shiftStart: `${row.shiftStart} ${row.shiftStartAmPm}`,
            shiftEnd: `${row.shiftEnd} ${row.shiftEndAmPm}`,
            shiftHours: row.shiftHours,
            overtimeHours: row.overtimeHours,
            deductionHours: row.deductionHours,
            // Legacy fields (pass empty or derived)
            timeFrom: '',
            timeTo: ''
          }),
        });
      }

      // Reset
      setCurrentRows([{
        id: Date.now(),
        employeeName: '',
        shiftHours: '9',
        shiftStart: '',
        shiftStartAmPm: 'AM',
        shiftEnd: '',
        shiftEndAmPm: 'PM',
        overtimeHours: '0',
        deductionHours: '0',
        description: '',
      }]);
      recordsFetchedRef.current = false; // Force refresh View
      if (activeTab === 'view') fetchRecords();
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save records');
    } finally {
      setLoading(false);
    }
  };

  // Stats Calculation with new fields
  const getEmployeeStats = useMemo(() => {
    const stats: Record<string, { days: number, otHours: number, deductHours: number, totalAmount: number }> = {};

    overtimeRecords.forEach(rec => {
      const name = rec.employeeName;
      if (!name) return;
      if (!stats[name]) stats[name] = { days: 0, otHours: 0, deductHours: 0, totalAmount: 0 };

      stats[name].days++;

      let ot = 0;
      let ded = 0;

      // 1. Try On-the-fly calculation (Most Accurate)
      if (rec.shiftStart && rec.shiftEnd) {
        const dur = calculateDuration(rec.shiftStart, rec.shiftStartAmPm || 'AM', rec.shiftEnd, rec.shiftEndAmPm || 'PM');
        const std = parseFloat(rec.shiftHours) || 9;
        const diff = dur - std;
        if (diff > 0.001) ot = diff;
        else if (diff < -0.001) ded = Math.abs(diff);
      }
      // 2. Fallback to Stored Values
      else {
        ot = timeToDecimal(rec.overtimeHours || '0');
        ded = timeToDecimal(rec.deductionHours || '0');

        if (!rec.overtimeHours && !rec.deductionHours && rec.hours) {
          // Legacy fallback
          ot = parseFloat(rec.hours);
        }
      }

      stats[name].otHours += ot;
      stats[name].deductHours += ded;

      // Amount Calculation
      // OT = +10 AED/hr (standard assumption)
      // Deduction = -10 AED/hr? Or based on salary?
      // User didn't specify rate for Deduction. Assuming symmetrical for now, or just tracking hours.
      // Let's assume 10 for OT. What about deduction? Let's assume -10.
      // Also handle "Sunday/Holiday" = Full Day Salary calculation if description matches?
      // Let's keep legacy amount logic for simple OT, but for Deduction we might need guidance.
      // For now: Amount = (OT * 10) - (Ded * 10).

      let amount = (ot * 10) - (ded * 10);

      // Sunday/Holiday override (Full Salary / 30)
      const isSunday = rec.date ? new Date(rec.date).getDay() === 0 : false;
      const isHoliday = (rec.description || '').toLowerCase().includes('holiday');

      if ((isSunday || isHoliday) && ot > 0) {
        // If worked on Sunday/Holiday, usually it's treated as full day OT payment
        // Legacy logic: Salary / 30
        const salary = employeeSalaries[name] || 0;
        if (salary > 0) amount = salary / 30;
      }

      stats[name].totalAmount += amount;
    });

    return Object.entries(stats)
      .sort((a, b) => b[1].totalAmount - a[1].totalAmount);
  }, [overtimeRecords, employeeSalaries]);

  // View Tab grouping
  const groupedRecords = useMemo(() => {
    // Filter first
    let filtered = overtimeRecords;
    if (filterYear) filtered = filtered.filter(r => r.date.startsWith(filterYear));
    if (filterMonth) filtered = filtered.filter(r => {
      const d = new Date(r.date);
      return (d.getMonth() + 1) === parseInt(filterMonth);
    });

    // Search Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        (r.employeeName || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q)
      );
    }

    // Group
    const groups: Map<string, any[]> = new Map();
    filtered.forEach(r => {
      const d = r.date || 'No Date';
      if (!groups.has(d)) groups.set(d, []);
      groups.get(d)!.push(r);
    });

    return Array.from(groups.entries()).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [overtimeRecords, filterYear, filterMonth, searchQuery]);

  const toggleDate = (date: string) => {
    const newSet = new Set(expandedDates);
    if (newSet.has(date)) newSet.delete(date);
    else newSet.add(date);
    setExpandedDates(newSet);
  };

  const handleExportStats = () => {
    const data = getEmployeeStats.map(([name, stats]) => ({
      'Employee Name': name,
      'Days Worked': stats.days,
      'Total Overtime (Hours)': decimalToTime(stats.otHours),
      'Total Deductions (Hours)': decimalToTime(stats.deductHours),
      'Net Amount (AED)': stats.totalAmount.toFixed(2)
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Overtime Statistics');
    XLSX.writeFile(workbook, `Overtime_Statistics_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportViewRecords = () => {
    // 1. Filter Logic
    let filtered = [...overtimeRecords];
    if (filterYear) filtered = filtered.filter(r => r.date.startsWith(filterYear));
    if (filterMonth) filtered = filtered.filter(r => {
      const d = new Date(r.date);
      return (d.getMonth() + 1) === parseInt(filterMonth);
    });
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        (r.employeeName || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q)
      );
    }

    // 2. Sort Logic: Name ASC, then Date ASC
    filtered.sort((a, b) => {
      const nameA = (a.employeeName || '').toLowerCase();
      const nameB = (b.employeeName || '').toLowerCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    // 3. Map to Excel Format
    const data = filtered.map(rec => {
      let otDisplay = (rec.overtimeHours || rec.hours || 0) > 0 ? `${rec.overtimeHours || rec.hours}` : '0';
      let dedDisplay = (rec.deductionHours || 0) > 0 ? `${rec.deductionHours}` : '0';

      // Re-calculate
      if (rec.shiftStart && rec.shiftEnd) {
        const dur = calculateDuration(rec.shiftStart, rec.shiftStartAmPm || 'AM', rec.shiftEnd, rec.shiftEndAmPm || 'PM');
        const std = parseFloat(rec.shiftHours) || 9;
        const diff = dur - std;

        if (diff > 0.001) otDisplay = decimalToTime(diff);
        else if (diff < -0.001) dedDisplay = decimalToTime(Math.abs(diff));
        else { otDisplay = '0'; dedDisplay = '0'; }
      }

      return {
        'Date': rec.date,
        'Employee Name': rec.employeeName,
        'Shift Hours': rec.shiftHours || '9',
        'Start Time': rec.shiftStart ? `${rec.shiftStart} ${rec.shiftStartAmPm}` : (rec.timeFrom || ''),
        'End Time': rec.shiftEnd ? `${rec.shiftEnd} ${rec.shiftEndAmPm}` : (rec.timeTo || ''),
        'Overtime (Hours)': otDisplay,
        'Deduction (Hours)': dedDisplay,
        'Description': rec.description || ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Overtime Records');
    XLSX.writeFile(workbook, `Overtime_Records_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Header - Like DEBIT Tab */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between py-4 gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => window.location.href = '/'}
                className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
                title="Back to Home"
              >
                <ArrowLeft className="w-5 h-5 text-gray-500" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Clock className="w-6 h-6 text-blue-600" />
                  Employee Overtime
                </h1>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-nowrap bg-gray-100 p-1 rounded-xl self-start md:self-auto overflow-x-auto">
              {[
                { id: 'register', label: 'Register', icon: Plus },
                { id: 'view', label: 'View Records', icon: List },
                { id: 'statistics', label: 'Statistics', icon: BarChart3 },
                { id: 'absence', label: 'Absence', icon: User }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex flex-1 items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-8">

        {/* REGISTER TAB */}
        {activeTab === 'register' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 p-2 rounded-lg">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</label>
                  <input
                    type="date"
                    value={currentDate}
                    onChange={(e) => setCurrentDate(e.target.value)}
                    className="font-semibold text-gray-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 bg-gray-50 px-3 py-1 rounded-full border border-gray-200">
                  {currentRows.length} Entries
                </span>
              </div>
            </div>

            <div className="p-6 pb-80">
              <div className="overflow-visible">
                <table className="w-full min-w-[1000px] mx-auto">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[22%]">Employee</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[8%]">Shift (Hrs)</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[13%]">Start Time</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[13%]">End Time</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[8%] text-green-600">Overtime</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[8%] text-red-600">Deduction</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[28%]">Description</th>
                      <th className="w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 bg-white">
                    {/* Backdrop for closing dropdowns */}
                    {openDropdown && (
                      <tr className="fixed inset-0 z-10 cursor-default" onClick={() => setOpenDropdown(null)}></tr>
                    )}

                    {currentRows.map((row) => (
                      <tr key={row.id} className="group hover:bg-gray-50 transition-colors relative">
                        <td className="p-2 relative">
                          <input
                            type="text"
                            value={row.employeeName}
                            onChange={(e) => updateRow(row.id, 'employeeName', e.target.value)}
                            onClick={(e) => { e.stopPropagation(); setOpenDropdown({ id: row.id, field: 'employeeName' }); }}
                            onFocus={() => setOpenDropdown({ id: row.id, field: 'employeeName' })}
                            className="w-full h-11 bg-white border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:border-blue-500 focus:ring-0 outline-none transition-all px-3 text-center shadow-sm placeholder:text-gray-400"
                            placeholder="Select Employee..."
                          />
                          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />

                          {/* Employee Dropdown */}
                          {openDropdown?.id === row.id && openDropdown?.field === 'employeeName' && (
                            <div className="absolute top-[85%] left-0 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-[300px] overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                              {employeeNames
                                .filter(n => !row.employeeName || n.toLowerCase().includes(row.employeeName.toLowerCase()))
                                .map(name => (
                                  <div
                                    key={name}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateRow(row.id, 'employeeName', name);
                                      setOpenDropdown(null);
                                    }}
                                    className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-700 text-center"
                                  >
                                    {name}
                                  </div>
                                ))}
                              {employeeNames.length === 0 && <div className="p-2 text-gray-400 text-xs text-center">No employees found</div>}
                            </div>
                          )}
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={row.shiftHours}
                            onChange={(e) => updateRow(row.id, 'shiftHours', e.target.value)}
                            className="w-full h-11 bg-white border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:border-blue-500 focus:ring-0 outline-none transition-all text-center shadow-sm"
                            placeholder="9"
                          />
                        </td>
                        <td className="p-2">
                          <div className="flex gap-1 relative items-center">
                            <input
                              type="text"
                              value={row.shiftStart}
                              onChange={(e) => updateRow(row.id, 'shiftStart', e.target.value)}
                              className="w-full h-11 bg-white border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:border-blue-500 focus:ring-0 outline-none transition-all text-center shadow-sm"
                              placeholder="e.g. 4.30"
                            />

                            {/* Start AM/PM Custom Dropdown */}
                            <div className="relative">
                              <div
                                onClick={(e) => { e.stopPropagation(); setOpenDropdown({ id: row.id, field: 'startAmPm' }); }}
                                className="h-11 w-20 bg-white border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-700 flex items-center justify-center cursor-pointer hover:border-blue-400 transition-all shadow-sm"
                              >
                                {row.shiftStartAmPm}
                              </div>
                              {openDropdown?.id === row.id && openDropdown?.field === 'startAmPm' && (
                                <div className="absolute top-[100%] right-0 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                  {['AM', 'PM'].map(val => (
                                    <div
                                      key={val}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateRow(row.id, 'shiftStartAmPm', val);
                                        setOpenDropdown(null);
                                      }}
                                      className={`px-3 py-2 text-center text-sm cursor-pointer hover:bg-blue-50 ${row.shiftStartAmPm === val ? 'bg-blue-50 font-bold text-blue-600' : 'text-gray-700'}`}
                                    >
                                      {val}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex gap-1 relative items-center">
                            <input
                              type="text"
                              value={row.shiftEnd}
                              onChange={(e) => updateRow(row.id, 'shiftEnd', e.target.value)}
                              className="w-full h-11 bg-white border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:border-blue-500 focus:ring-0 outline-none transition-all text-center shadow-sm"
                              placeholder="e.g. 8.30"
                            />

                            {/* End AM/PM Custom Dropdown */}
                            <div className="relative">
                              <div
                                onClick={(e) => { e.stopPropagation(); setOpenDropdown({ id: row.id, field: 'endAmPm' }); }}
                                className="h-11 w-20 bg-white border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-700 flex items-center justify-center cursor-pointer hover:border-blue-400 transition-all shadow-sm"
                              >
                                {row.shiftEndAmPm}
                              </div>
                              {openDropdown?.id === row.id && openDropdown?.field === 'endAmPm' && (
                                <div className="absolute top-[100%] right-0 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                  {['AM', 'PM'].map(val => (
                                    <div
                                      key={val}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateRow(row.id, 'shiftEndAmPm', val);
                                        setOpenDropdown(null);
                                      }}
                                      className={`px-3 py-2 text-center text-sm cursor-pointer hover:bg-blue-50 ${row.shiftEndAmPm === val ? 'bg-blue-50 font-bold text-blue-600' : 'text-gray-700'}`}
                                    >
                                      {val}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={row.overtimeHours}
                            onChange={(e) => updateRow(row.id, 'overtimeHours', e.target.value)}
                            className="w-full h-11 bg-green-50 border-2 border-green-200 text-green-700 rounded-xl text-sm font-bold focus:border-green-500 focus:ring-0 outline-none transition-all text-center shadow-sm"
                            placeholder="0"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={row.deductionHours}
                            onChange={(e) => updateRow(row.id, 'deductionHours', e.target.value)}
                            className="w-full h-11 bg-red-50 border-2 border-red-200 text-red-700 rounded-xl text-sm font-bold focus:border-red-500 focus:ring-0 outline-none transition-all text-center shadow-sm"
                            placeholder="0"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.description}
                            onChange={(e) => updateRow(row.id, 'description', e.target.value)}
                            className="w-full h-11 bg-white border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:border-blue-500 focus:ring-0 outline-none transition-all text-center shadow-sm"
                            placeholder="Notes..."
                          />
                        </td>
                        <td className="p-2 text-center">
                          {currentRows.length > 1 && (
                            <button
                              onClick={() => deleteRow(row.id)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex gap-4">
                <button
                  onClick={addNewRow}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Row
                </button>
                <button
                  onClick={saveAllRecords}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50 ml-auto"
                >
                  <Save className="w-4 h-4" />
                  {loading ? 'Saving...' : 'Save All Records'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW TAB */}
        {activeTab === 'view' && (
          <div className="space-y-6">
            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-4 items-center justify-center">
              <div className="flex flex-wrap gap-4 items-center justify-center flex-1">
                <div className="flex items-center gap-2 bg-white border-2 border-gray-200 rounded-xl px-3 h-11 w-full md:w-auto focus-within:border-blue-500 transition-all shadow-sm">
                  <Search className="w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent border-none text-sm p-0 focus:ring-0 w-full md:w-64 text-gray-700 font-medium placeholder-gray-400"
                  />
                  {searchQuery && <button onClick={() => setSearchQuery('')}><X className="w-3 h-3 text-gray-500" /></button>}
                </div>

                <div className="h-6 w-px bg-gray-300 mx-2 hidden md:block"></div>

                <div className="relative">
                  <div
                    onClick={(e) => { e.stopPropagation(); setOpenDropdown({ id: -1, field: 'filterMonth' }); }}
                    className="bg-white border-2 border-gray-200 text-gray-700 font-medium text-sm rounded-xl h-11 w-40 px-3 flex items-center justify-between cursor-pointer hover:border-blue-400 transition-all shadow-sm group"
                  >
                    <span className="truncate">{filterMonth ? new Date(0, parseInt(filterMonth) - 1).toLocaleString('default', { month: 'long' }) : 'All Months'}</span>
                    <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  </div>

                  {openDropdown?.id === -1 && openDropdown?.field === 'filterMonth' && (
                    <div className="absolute top-[115%] left-0 w-full bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                      <div
                        onClick={(e) => { e.stopPropagation(); setFilterMonth(''); setOpenDropdown(null); }}
                        className={`px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm ${filterMonth === '' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-700'}`}
                      >
                        All Months
                      </div>
                      {Array.from({ length: 12 }, (_, i) => (
                        <div
                          key={i + 1}
                          onClick={(e) => { e.stopPropagation(); setFilterMonth((i + 1).toString()); setOpenDropdown(null); }}
                          className={`px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm ${filterMonth === (i + 1).toString() ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-700'}`}
                        >
                          {new Date(0, i).toLocaleString('default', { month: 'long' })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  type="number"
                  placeholder="Year"
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="bg-white border-2 border-gray-200 text-gray-700 font-medium text-sm rounded-xl h-11 w-32 px-3 text-center focus:border-blue-500 focus:ring-0 outline-none transition-all shadow-sm"
                />
              </div>
              <button
                onClick={handleExportViewRecords}
                className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                title="Export Records to Excel"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={fetchRecords}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Refresh"
              >
                <div className={loadingRecords ? 'animate-spin' : ''}><Clock className="w-5 h-5" /></div>
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {loadingRecords ? (
                <div className="p-12 text-center text-gray-500">Loading records...</div>
              ) : groupedRecords.length === 0 ? (
                <div className="p-12 text-center text-gray-500">No records found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-[25%]">Date / Employee</th>
                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-[10%]">Shift</th>
                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-[15%]">In / Out</th>
                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider text-green-600 w-[10%]">Overtime</th>
                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider text-red-600 w-[10%]">Deduction</th>
                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-[30%]">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {groupedRecords.map(([date, records]) => {
                        const isExpanded = expandedDates.has(date);
                        const isSunday = date !== 'No Date' && (() => {
                          const d = new Date(date);
                          return !isNaN(d.getTime()) && d.getDay() === 0;
                        })();

                        return (
                          <React.Fragment key={date}>
                            <tr
                              className={`cursor-pointer transition-colors ${isSunday ? 'bg-yellow-50 hover:bg-yellow-100 border-l-4 border-l-yellow-400' : 'bg-gray-50/50 hover:bg-gray-100'}`}
                              onClick={() => toggleDate(date)}
                            >
                              <td colSpan={6} className="px-6 py-3">
                                <div className="flex items-center justify-between w-full pr-4">
                                  <div className="flex items-center gap-2">
                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                                    <span className={`font-bold ${isSunday ? 'text-yellow-900' : 'text-gray-900'}`}>
                                      {date} {isSunday && <span className="text-[10px] font-black text-yellow-600 ml-1 uppercase pl-1">(Sunday)</span>}
                                    </span>
                                  </div>
                                  <span className={`text-[10px] font-bold shrink-0 w-24 text-center ${isSunday ? 'bg-yellow-200/50 border-yellow-300 text-yellow-800' : 'text-slate-500 bg-white border-slate-200'} border px-3 py-1 rounded-full shadow-sm`}>
                                    {records.length} {records.length === 1 ? 'RECORD' : 'RECORDS'}
                                  </span>
                                </div>
                              </td>
                            </tr>
                            {isExpanded && records.map((rec: any, idx: number) => (
                              <tr
                                key={idx}
                                className="bg-white hover:bg-blue-50 cursor-pointer transition-colors group"
                                onClick={() => openEditModal(rec)}
                              >
                                <td className="px-6 py-4">
                                  <div className="flex items-center justify-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                                      {rec.employeeName.charAt(0)}
                                    </div>
                                    <span className="font-medium text-gray-900">{rec.employeeName}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600 text-center">
                                  {rec.shiftHours || '-'} hrs
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600 text-center">
                                  <div className="font-bold">
                                    {rec.shiftStart || rec.timeFrom || '-'}
                                    <span className="text-[10px] text-gray-400 ml-1">{(rec.shiftStartAmPm || '').toUpperCase()}</span>
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {rec.shiftEnd || rec.timeTo || '-'}
                                    <span className="text-[10px] text-gray-400 ml-1">{(rec.shiftEndAmPm || '').toUpperCase()}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-sm font-bold text-green-600 text-center">
                                  {(() => {
                                    // 1. Try on-the-fly calculation for consistent formatting (H.MM)
                                    if (rec.shiftStart && rec.shiftEnd) {
                                      const dur = calculateDuration(rec.shiftStart, rec.shiftStartAmPm || 'AM', rec.shiftEnd, rec.shiftEndAmPm || 'PM');
                                      const std = parseFloat(rec.shiftHours) || 9;
                                      const diff = dur - std;
                                      if (diff > 0.001) return `${decimalToTime(diff)}h`;
                                    }
                                    // 2. Fallback to stored value
                                    return (rec.overtimeHours || rec.hours || 0) > 0 ? `${rec.overtimeHours || rec.hours}h` : '-';
                                  })()}
                                </td>
                                <td className="px-6 py-4 text-sm font-bold text-red-600 text-center">
                                  {(() => {
                                    // 1. Try on-the-fly calculation
                                    if (rec.shiftStart && rec.shiftEnd) {
                                      const dur = calculateDuration(rec.shiftStart, rec.shiftStartAmPm || 'AM', rec.shiftEnd, rec.shiftEndAmPm || 'PM');
                                      const std = parseFloat(rec.shiftHours) || 9;
                                      const diff = dur - std;
                                      if (diff < -0.001) return `${decimalToTime(Math.abs(diff))}h`;
                                    }
                                    // 2. Fallback
                                    return (rec.deductionHours || 0) > 0 ? `${rec.deductionHours}h` : '-';
                                  })()}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500 italic truncate max-w-xs text-center">{rec.description}</td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'statistics' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Summary Statistics</h3>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleExportStats}
                  className="p-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors border border-green-200 shadow-sm"
                  title="Export to Excel"
                >
                  <Download className="w-5 h-5" />
                </button>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{getEmployeeStats.length} EMPLOYEES</div>
              </div>
            </div>
            {getEmployeeStats.length === 0 ? (
              <div className="p-12 text-center text-gray-500">No records found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 font-bold">
                      <th className="px-6 py-4 text-center text-[10px] text-gray-500 uppercase tracking-wider">Employee</th>
                      <th className="px-6 py-4 text-center text-[10px] text-gray-500 uppercase tracking-wider">Days</th>
                      <th className="px-6 py-4 text-center text-[10px] text-green-600 uppercase tracking-wider">Total Overtime</th>
                      <th className="px-6 py-4 text-center text-[10px] text-red-600 uppercase tracking-wider">Total Deductions</th>
                      <th className="px-6 py-4 text-center text-[10px] text-gray-500 uppercase tracking-wider">Net Amount (Est.)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {getEmployeeStats.map(([name, stats]) => (
                      <tr key={name} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800 text-center text-sm">{name}</td>
                        <td className="px-6 py-4 text-slate-500 font-bold text-center text-sm">{stats.days}</td>
                        <td className="px-6 py-4 font-black text-green-600 text-center text-sm">{decimalToTime(stats.otHours)}h</td>
                        <td className="px-6 py-4 font-black text-red-600 text-center text-sm">{decimalToTime(stats.deductHours)}h</td>
                        <td className="px-6 py-4 font-black text-slate-900 text-center text-sm">{stats.totalAmount.toLocaleString()} AED</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ABSENCE TAB */}
        {activeTab === 'absence' && (
          <div className="space-y-6">
            {/* Sub-tabs Selection */}
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200 w-fit mx-auto">
              {[
                { id: 'register', label: 'Register Absence' },
                { id: 'stats', label: 'Absence Statistics' }
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setAbsenceSubTab(sub.id as any)}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${absenceSubTab === sub.id
                    ? 'bg-red-50 text-red-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {absenceSubTab === 'register' ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 max-w-6xl mx-auto">
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-red-600" />
                    <input
                      type="date"
                      value={absenceDate}
                      onChange={(e) => setAbsenceDate(e.target.value)}
                      className="font-bold text-gray-900 border-none p-0 focus:ring-0 cursor-pointer"
                    />
                  </div>
                  <div className="text-xs font-bold text-gray-400 uppercase">{currentAbsenceRows.length} ABSENTEES</div>
                </div>

                <div className="p-6">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                        <th className="pb-3 px-2 w-[40%]">Employee</th>
                        <th className="pb-3 px-2">Particulars / Reason</th>
                        <th className="pb-3 px-2 w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {/* Backdrop for closing dropdowns */}
                      {openDropdown && (
                        <tr className="fixed inset-0 z-10 cursor-default" onClick={() => setOpenDropdown(null)}></tr>
                      )}

                      {currentAbsenceRows.map((row) => (
                        <tr key={row.id} className="group hover:bg-red-50/30 transition-colors">
                          <td className="py-3 px-2 relative">
                            <div className="relative">
                              <input
                                type="text"
                                readOnly
                                value={row.employeeName}
                                onClick={(e) => { e.stopPropagation(); setOpenDropdown({ id: row.id, field: 'abs_emp' }); }}
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 cursor-pointer hover:border-red-300 transition-all text-center"
                                placeholder="Select employee..."
                              />
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>

                            {openDropdown?.id === row.id && openDropdown?.field === 'abs_emp' && (
                              <div className="absolute top-[85%] left-0 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-[250px] overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                                {employeeNames.map(name => (
                                  <div
                                    key={name}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCurrentAbsenceRows(currentAbsenceRows.map(r => r.id === row.id ? { ...r, employeeName: name } : r));
                                      setOpenDropdown(null);
                                    }}
                                    className="px-4 py-2 hover:bg-red-50 cursor-pointer text-sm font-bold text-slate-700 text-center"
                                  >
                                    {name}
                                  </div>
                                ))}
                                {employeeNames.length === 0 && <div className="p-3 text-center text-gray-400 text-xs italic">No employees loaded</div>}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-2">
                            <input
                              type="text"
                              value={row.particulars}
                              onChange={(e) => setCurrentAbsenceRows(currentAbsenceRows.map(r => r.id === row.id ? { ...r, particulars: e.target.value } : r))}
                              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                              placeholder="Reason..."
                            />
                          </td>
                          <td className="py-3 px-2 text-center">
                            {currentAbsenceRows.length > 1 && (
                              <button
                                onClick={() => setCurrentAbsenceRows(currentAbsenceRows.filter(r => r.id !== row.id))}
                                className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-8 flex items-center justify-between">
                    <button
                      onClick={() => setCurrentAbsenceRows([...currentAbsenceRows, { id: Date.now(), employeeName: '', particulars: 'Absent' }])}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all border-dashed border-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Another Absentee
                    </button>
                    <button
                      onClick={async () => {
                        const valid = currentAbsenceRows.filter(r => r.employeeName.trim());
                        if (valid.length === 0) return alert('Select at least one employee');
                        setLoading(true);
                        try {
                          for (const row of valid) {
                            await fetch('/api/employee-overtime', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                mode: 'absence',
                                date: absenceDate,
                                employeeName: row.employeeName,
                                particulars: row.particulars
                              })
                            });
                          }
                          setCurrentAbsenceRows([{ id: Date.now(), employeeName: '', particulars: 'Absent' }]);
                        } catch (e) {
                          alert('Failed to save');
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                      className="flex items-center gap-2 px-8 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 shadow-lg shadow-red-100 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {loading ? 'Saving...' : 'Save Absence Records'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-w-6xl mx-auto">
                <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-slate-50/50">
                  <h3 className="text-lg font-black text-slate-800">Absence Statistics</h3>
                  <button onClick={fetchAbsenceRecords} className="p-2 hover:bg-white rounded-lg text-red-600 transition-colors">
                    <div className={loadingAbsence ? 'animate-spin' : ''}><Clock className="w-5 h-5" /></div>
                  </button>
                </div>
                <div className="p-0">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50/50 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <th className="px-6 py-4">Employee</th>
                        <th className="px-6 py-4 text-center">Total Absence Days</th>
                        <th className="px-6 py-4 text-center w-24">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(() => {
                        // Group records by employee for a cleaner view but allow deleting individual ones
                        const grouped: Record<string, any[]> = {};
                        absenceRecords.forEach(r => {
                          if (!grouped[r.employeeNameEn]) grouped[r.employeeNameEn] = [];
                          grouped[r.employeeNameEn].push(r);
                        });

                        const sortedEntries = Object.entries(grouped).sort((a, b) => b[1].length - a[1].length);

                        if (sortedEntries.length === 0) {
                          return <tr><td colSpan={3} className="px-6 py-12 text-center text-slate-400 font-bold italic">No absence data recorded yet</td></tr>;
                        }

                        return sortedEntries.map(([name, records]) => (
                          <React.Fragment key={name}>
                            {/* Employee Header Row */}
                            <tr className="bg-slate-50/30">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-black text-xs">
                                    {name.charAt(0)}
                                  </div>
                                  <span className="font-bold text-slate-800 text-base">{name}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="inline-flex items-center px-4 py-1.5 bg-red-600 text-white rounded-full font-black text-sm shadow-sm">
                                  {records.length} {records.length === 1 ? 'DAY' : 'DAYS'} TOTAL
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center"></td>
                            </tr>

                            {/* Individual Records for this Employee */}
                            {records.map((rec, rIdx) => (
                              <tr key={`${name}-${rIdx}`} className="hover:bg-red-50/20 transition-colors group">
                                <td className="px-6 py-3 pl-16">
                                  <div className="flex items-center gap-2 text-slate-500 font-bold text-sm">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {rec.date}
                                    <span className="text-[10px] text-slate-300 ml-2 font-medium italic">— {rec.particulars || 'No reason'}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-3 text-center"></td>
                                <td className="px-6 py-3 text-center">
                                  <button
                                    onClick={() => handleDeleteAbsence(rec.rowIndex)}
                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all active:scale-95"
                                    title="Delete this record"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600" />
                Edit Record
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Date</label>
                <input
                  type="date"
                  value={editingRecord.date}
                  onChange={e => setEditingRecord({ ...editingRecord, date: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Employee Name</label>
                <input
                  type="text"
                  readOnly
                  value={editingRecord.employeeName}
                  className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-bold cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Start Time</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={editingRecord.shiftStart}
                      onChange={e => {
                        const newStart = e.target.value;
                        const duration = calculateDuration(newStart, editingRecord.shiftStartAmPm, editingRecord.shiftEnd, editingRecord.shiftEndAmPm);
                        const standard = parseFloat(editingRecord.shiftHours) || 9;
                        const diff = duration - standard;
                        setEditingRecord({
                          ...editingRecord,
                          shiftStart: newStart,
                          overtimeHours: diff > 0.001 ? decimalToTime(diff) : '0',
                          deductionHours: diff < -0.001 ? decimalToTime(Math.abs(diff)) : '0'
                        });
                      }}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700 text-center"
                    />
                    <select
                      value={editingRecord.shiftStartAmPm}
                      onChange={e => {
                        const newAmPm = e.target.value;
                        const duration = calculateDuration(editingRecord.shiftStart, newAmPm, editingRecord.shiftEnd, editingRecord.shiftEndAmPm);
                        const standard = parseFloat(editingRecord.shiftHours) || 9;
                        const diff = duration - standard;
                        setEditingRecord({
                          ...editingRecord,
                          shiftStartAmPm: newAmPm,
                          overtimeHours: diff > 0.001 ? decimalToTime(diff) : '0',
                          deductionHours: diff < -0.001 ? decimalToTime(Math.abs(diff)) : '0'
                        });
                      }}
                      className="px-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">End Time</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={editingRecord.shiftEnd}
                      onChange={e => {
                        const newEnd = e.target.value;
                        const duration = calculateDuration(editingRecord.shiftStart, editingRecord.shiftStartAmPm, newEnd, editingRecord.shiftEndAmPm);
                        const standard = parseFloat(editingRecord.shiftHours) || 9;
                        const diff = duration - standard;
                        setEditingRecord({
                          ...editingRecord,
                          shiftEnd: newEnd,
                          overtimeHours: diff > 0.001 ? decimalToTime(diff) : '0',
                          deductionHours: diff < -0.001 ? decimalToTime(Math.abs(diff)) : '0'
                        });
                      }}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700 text-center"
                    />
                    <select
                      value={editingRecord.shiftEndAmPm}
                      onChange={e => {
                        const newAmPm = e.target.value;
                        const duration = calculateDuration(editingRecord.shiftStart, editingRecord.shiftStartAmPm, editingRecord.shiftEnd, newAmPm);
                        const standard = parseFloat(editingRecord.shiftHours) || 9;
                        const diff = duration - standard;
                        setEditingRecord({
                          ...editingRecord,
                          shiftEndAmPm: newAmPm,
                          overtimeHours: diff > 0.001 ? decimalToTime(diff) : '0',
                          deductionHours: diff < -0.001 ? decimalToTime(Math.abs(diff)) : '0'
                        });
                      }}
                      className="px-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 text-green-600">Overtime (H.MM)</label>
                  <input
                    type="text"
                    value={editingRecord.overtimeHours}
                    onChange={e => setEditingRecord({ ...editingRecord, overtimeHours: e.target.value })}
                    className="w-full px-4 py-2.5 bg-green-50 border border-green-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 font-black text-green-700 text-center"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 text-red-600">Deduction (H.MM)</label>
                  <input
                    type="text"
                    value={editingRecord.deductionHours}
                    onChange={e => setEditingRecord({ ...editingRecord, deductionHours: e.target.value })}
                    className="w-full px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 font-black text-red-700 text-center"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Notes / Description</label>
                <textarea
                  value={editingRecord.description}
                  onChange={e => setEditingRecord({ ...editingRecord, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700 min-h-[80px]"
                  placeholder="Additional details..."
                />
              </div>
            </div>

            <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between gap-4">
              <button
                onClick={handleDeleteRecord}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-600 hover:text-white transition-all active:scale-95 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 bg-white text-slate-500 rounded-xl font-bold text-sm hover:bg-slate-100 transition-all border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateRecord}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Custom Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDeleteConfirm({ show: false, rowIndex: null })}></div>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Confirm Delete</h3>
              <p className="text-slate-500 font-bold text-sm leading-relaxed">
                Are you sure you want to delete this absence record? This action cannot be undone.
              </p>
            </div>
            <div className="flex border-t border-slate-100">
              <button
                onClick={() => setDeleteConfirm({ show: false, rowIndex: null })}
                className="flex-1 px-6 py-4 text-slate-400 font-bold hover:bg-slate-50 transition-colors border-r border-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteAbsence}
                className="flex-1 px-6 py-4 text-red-600 font-black hover:bg-red-50 transition-colors"
                disabled={isSaving}
              >
                {isSaving ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
