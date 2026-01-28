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

  const [activeTab, setActiveTab] = useState<'register' | 'view' | 'statistics'>(() => {
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

  // Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [editingRecord, setEditingRecord] = useState({
    date: '',
    employeeName: '',
    shiftHours: '9',
    shiftStart: '',
    shiftEnd: '',
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

  // Helper: Calculate hours between two time strings (HH:mm or HH.mm) with AM/PM
  const calculateDuration = (start: string, startAmPm: string, end: string, endAmPm: string): number => {
    if (!start || !end) return 0;

    // Parse Time String to Hours and Minutes
    const parse = (t: string) => {
      // support 9, 9:00, 09:00, 9.30, 4.3 -> 4:30
      // remove any spaces
      t = t.trim().replace('.', ':');

      let h = 0, m = 0;
      if (t.includes(':')) {
        const parts = t.split(':');
        h = parseInt(parts[0]) || 0;
        m = parseInt(parts[1]) || 0;
      } else {
        // try to interpret float
        h = parseFloat(t);
        const intPart = Math.floor(h);
        h = intPart;
        m = 0;
      }
      return { h, m };
    };

    const sTime = parse(start);
    const eTime = parse(end);

    // Normalize to 24h
    let sH = sTime.h;
    if (startAmPm === 'PM' && sH < 12) sH += 12;
    if (startAmPm === 'AM' && sH === 12) sH = 0;

    let eH = eTime.h;
    if (endAmPm === 'PM' && eH < 12) eH += 12;
    if (endAmPm === 'AM' && eH === 12) eH = 0;

    const sMins = sH * 60 + sTime.m;
    let eMins = eH * 60 + eTime.m;

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
            if (duration > 0) {
              const diff = duration - standard;
              if (diff > 0.01) { // tolerance
                updated.overtimeHours = diff.toFixed(2);
                updated.deductionHours = '0';
              } else if (diff < -0.01) {
                updated.overtimeHours = '0';
                updated.deductionHours = Math.abs(diff).toFixed(2);
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
            // Map new fields - Sending RAW input values as requested
            shiftStart: row.shiftStart,
            shiftEnd: row.shiftEnd,
            shiftStartAmPm: row.shiftStartAmPm, // Sending separately if backend wants it
            shiftEndAmPm: row.shiftEndAmPm,     // Sending separately if backend wants it
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
      alert('Records saved successfully!');
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

      // Use new fields if available, else legacy 'hours'
      let ot = parseFloat(rec.overtimeHours || '0');
      let ded = parseFloat(rec.deductionHours || '0');

      if (!rec.overtimeHours && !rec.deductionHours && rec.hours) {
        // Legacy record
        ot = parseFloat(rec.hours);
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
    // etc for date range

    // Group
    const groups: Map<string, any[]> = new Map();
    filtered.forEach(r => {
      const d = r.date || 'No Date';
      if (!groups.has(d)) groups.set(d, []);
      groups.get(d)!.push(r);
    });

    return Array.from(groups.entries()).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [overtimeRecords, filterYear, filterMonth]);

  const toggleDate = (date: string) => {
    const newSet = new Set(expandedDates);
    if (newSet.has(date)) newSet.delete(date);
    else newSet.add(date);
    setExpandedDates(newSet);
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
                { id: 'statistics', label: 'Statistics', icon: BarChart3 }
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
                        return (
                          <React.Fragment key={date}>
                            <tr className="bg-gray-50/50 hover:bg-gray-100 cursor-pointer transition-colors" onClick={() => toggleDate(date)}>
                              <td colSpan={6} className="px-6 py-3">
                                <div className="flex items-center gap-2">
                                  {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                                  <span className="font-bold text-gray-900">{date}</span>
                                  <span className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full">{records.length} records</span>
                                </div>
                              </td>
                            </tr>
                            {isExpanded && records.map((rec: any, idx: number) => (
                              <tr key={idx} className="bg-white hover:bg-gray-50">
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
                                  <div>{rec.shiftStart || rec.timeFrom || '-'}</div>
                                  <div className="text-xs text-gray-400">{rec.shiftEnd || rec.timeTo || '-'}</div>
                                </td>
                                <td className="px-6 py-4 text-sm font-bold text-green-600 text-center">
                                  {(rec.overtimeHours || rec.hours || 0) > 0 ? `${rec.overtimeHours || rec.hours}h` : '-'}
                                </td>
                                <td className="px-6 py-4 text-sm font-bold text-red-600 text-center">
                                  {(rec.deductionHours || 0) > 0 ? `${rec.deductionHours}h` : '-'}
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

        {/* STATISTICS TAB */}
        {activeTab === 'statistics' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Summary Statistics</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Days</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider text-green-600">Total Overtime</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider text-red-600">Total Deductions</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Net Amount (Est.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {getEmployeeStats.map(([name, stats]) => (
                    <tr key={name} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900 text-center">{name}</td>
                      <td className="px-6 py-4 text-gray-600 text-center">{stats.days}</td>
                      <td className="px-6 py-4 font-bold text-green-600 text-center">{stats.otHours.toFixed(2)} hrs</td>
                      <td className="px-6 py-4 font-bold text-red-600 text-center">{stats.deductHours.toFixed(2)} hrs</td>
                      <td className="px-6 py-4 font-bold text-gray-900 text-center">{stats.totalAmount.toLocaleString()} AED</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
