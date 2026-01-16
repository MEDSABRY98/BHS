'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Clock, Plus, List, Trash2, Save, ArrowLeft, X, Edit2, Download, Search, BarChart3, ChevronDown, ChevronRight } from 'lucide-react';
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
    // If user is Overtime Export, default to 'view' tab
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        if (user?.name === 'Overtime Export') {
          return 'view';
        }
      } catch (e) {
        // Ignore error
      }
    }
    return 'register';
  });
  const [overtimeRecords, setOvertimeRecords] = useState<any[]>([]);
  const [employeeNames, setEmployeeNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [loadingNames, setLoadingNames] = useState(false);
  const recordsFetchedRef = useRef(false);
  const [currentRows, setCurrentRows] = useState([{
    id: Date.now(),
    employeeName: '',
    type: 'Overtime',
    description: '',
    fromAmPm: 'PM',
    timeFrom: '',
    toAmPm: 'PM',
    timeTo: '',
    hours: '0.00'
  }]);
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [editingRecord, setEditingRecord] = useState({
    date: '',

    employeeName: '',
    type: 'Overtime',
    description: '',
    fromAmPm: 'PM',
    timeFrom: '',
    toAmPm: 'PM',
    timeTo: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statsSearchQuery, setStatsSearchQuery] = useState('');
  const [showAbsentStats, setShowAbsentStats] = useState(false);

  // Fetch employee names on component mount
  useEffect(() => {
    fetchEmployeeNames();
  }, []);

  // Fetch records only once when first entering view tab
  useEffect(() => {
    if (activeTab === 'view' && !recordsFetchedRef.current) {
      fetchRecords();
      recordsFetchedRef.current = true;
    }
  }, [activeTab]);

  const fetchEmployeeNames = async () => {
    try {
      setLoadingNames(true);
      const response = await fetch('/api/employee-overtime?type=names');
      const data = await response.json();
      if (response.ok) {
        setEmployeeNames(data.names || []);
      } else {
        console.error('Error fetching employee names:', data.error);
      }
    } catch (error) {
      console.error('Error fetching employee names:', error);
    } finally {
      setLoadingNames(false);
    }
  };

  const fetchRecords = async () => {
    try {
      setLoadingRecords(true);
      // Add timestamp to prevent caching
      const response = await fetch(`/api/employee-overtime?t=${Date.now()}`);
      const data = await response.json();
      if (response.ok) {
        setOvertimeRecords(data.records || []);
      } else {
        console.error('Error fetching records:', data.error);
      }
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setLoadingRecords(false);
    }
  };

  const calculateHours = (from: string, to: string) => {
    if (!from || !to) return 0;
    const [fromH, fromM] = from.split(':').map(Number);
    const [toH, toM] = to.split(':').map(Number);
    const fromMins = fromH * 60 + fromM;
    let toMins = toH * 60 + toM;
    if (toMins < fromMins) toMins += 24 * 60;
    return (toMins - fromMins) / 60;
  };

  const updateRow = (id: number, field: string, value: string) => {
    setCurrentRows(currentRows.map(row => {
      if (row.id === id) {
        let processedValue = value;
        if (field === 'timeFrom' || field === 'timeTo') {
          // Allow numbers and dot (for PM hours like 4, 5, 6, or 4.30, 5.20)
          // Replace comma with dot for convenience, and remove any other non-digit/dot characters
          processedValue = value.replace(',', '.').replace(/[^0-9.]/g, '');
          // Prevent multiple dots
          const dotIndex = processedValue.indexOf('.');
          if (dotIndex !== -1) {
            processedValue = processedValue.substring(0, dotIndex + 1) + processedValue.substring(dotIndex + 1).replace(/\./g, '');
          }
        }
        const updatedRow = { ...row, [field]: processedValue };
        if (field === 'timeFrom' || field === 'timeTo') {
          // Calculate hours - convert format (4.30 -> 4:30, or 4 -> 4:00)
          const fromTime = field === 'timeFrom' ? processedValue : row.timeFrom;
          const toTime = field === 'timeTo' ? processedValue : row.timeTo;

          const convertToTimeFormat = (timeStr: string): string => {
            if (!timeStr) return '00:00';
            if (timeStr.includes(':')) return timeStr;
            if (timeStr.includes('.')) {
              const parts = timeStr.split('.');
              const hours = parts[0] || '0';
              const minutes = parts[1] || '00';
              return `${hours.padStart(2, '0')}:${minutes.padEnd(2, '0')}`;
            }
            return `${timeStr.padStart(2, '0')}:00`;
          };

          updatedRow.hours = (() => {
            const totalHours = calculateHours(
              convertToTimeFormat(fromTime),
              convertToTimeFormat(toTime)
            );
            // Convert decimal hours to hours.minutes format (base 60)
            const hours = Math.floor(totalHours);
            const minutes = Math.round((totalHours - hours) * 60);
            return `${hours}.${minutes}`;
          })();
        }
        return updatedRow;
      }
      return row;
    }));
  };

  const addNewRow = () => {
    setCurrentRows([...currentRows, {
      id: Date.now(),
      employeeName: '',
      type: 'Overtime',
      description: '',
      fromAmPm: 'PM',
      timeFrom: '',
      toAmPm: 'PM',
      timeTo: '',
      hours: '0.00'
    }]);
  };

  const deleteRow = (id: number) => {
    if (currentRows.length > 1) {
      setCurrentRows(currentRows.filter(row => row.id !== id));
    }
  };

  const saveAllRecords = async () => {
    const validRows = currentRows.filter(row =>
      row.employeeName.trim() &&
      row.description.trim() &&
      row.timeFrom &&
      row.timeTo
    );

    if (validRows.length === 0) {
      alert('Please fill at least one complete row');
      return;
    }

    try {
      setLoading(true);

      // Save each record to Google Sheets
      for (const row of validRows) {
        const response = await fetch('/api/employee-overtime', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            date: currentDate,
            employeeName: row.employeeName,
            type: row.type || 'Overtime',
            description: row.description,
            fromAmPm: row.fromAmPm || 'PM',
            timeFrom: row.timeFrom,
            toAmPm: row.toAmPm || 'PM',
            timeTo: row.timeTo,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.details || 'Failed to save record');
        }
      }

      // Reset form
      setCurrentRows([{
        id: Date.now(),
        employeeName: '',
        type: 'Overtime',
        description: '',
        fromAmPm: 'PM',
        timeFrom: '',
        toAmPm: 'PM',
        timeTo: '',
        hours: '0.00'
      }]);
      setCurrentDate(new Date().toISOString().split('T')[0]);

      // Reset the records fetched flag so new records will be fetched when switching to view tab
      recordsFetchedRef.current = false;

    } catch (error) {
      console.error('Error saving records:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteRecord = (id: string) => {
    // Note: Delete functionality would require additional API endpoint
    // For now, just show a message
    alert('Delete functionality not yet implemented. Please delete directly from Google Sheets.');
  };

  const totalHours = overtimeRecords.reduce((sum, r) => sum + parseFloat(r.hours || 0), 0);

  const openEditModal = (record: any) => {
    setSelectedRecord(record);
    setEditingRecord({
      date: record.date,
      employeeName: record.employeeName,
      type: record.type || 'Overtime',
      description: record.description,
      fromAmPm: record.fromAmPm || 'PM',
      timeFrom: record.timeFrom,
      toAmPm: record.toAmPm || 'PM',
      timeTo: record.timeTo
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedRecord(null);
    setEditingRecord({
      date: '',
      employeeName: '',
      type: 'Overtime',
      description: '',
      fromAmPm: 'PM',
      timeFrom: '',
      toAmPm: 'PM',
      timeTo: ''
    });
  };

  const handleUpdateRecord = async () => {
    if (!selectedRecord) return;

    if (!editingRecord.employeeName || !editingRecord.description || !editingRecord.timeFrom || !editingRecord.timeTo) {
      alert('Please fill all fields');
      return;
    }

    const fromAmPm = editingRecord.fromAmPm || 'PM';
    const toAmPm = editingRecord.toAmPm || 'PM';

    setIsSaving(true);
    try {
      const response = await fetch('/api/employee-overtime', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rowIndex: selectedRecord.rowIndex,
          date: editingRecord.date,
          employeeName: editingRecord.employeeName,
          type: editingRecord.type || 'Overtime',
          description: editingRecord.description,
          fromAmPm: fromAmPm,
          timeFrom: editingRecord.timeFrom,
          toAmPm: toAmPm,
          timeTo: editingRecord.timeTo,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        closeModal();
        fetchRecords(); // Refresh the list
      } else {
        alert(data.error || 'Failed to update record');
      }
    } catch (error) {
      console.error('Error updating record:', error);
      alert('Failed to update record');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRecord = async () => {
    if (!selectedRecord) return;

    if (!confirm('Are you sure you want to delete this record?')) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/employee-overtime', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rowIndex: selectedRecord.rowIndex
        }),
      });

      const data = await response.json();
      if (response.ok) {
        closeModal();
        fetchRecords(); // Refresh the list
      } else {
        alert(data.error || 'Failed to delete record');
      }
    } catch (error) {
      console.error('Error deleting record:', error);
      alert('Failed to delete record');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter records by year, month, and date range
  const filteredRecords = useMemo(() => {
    let filtered = [...overtimeRecords];

    // Date range filter (from - to)
    if (filterDateFrom.trim() || filterDateTo.trim()) {
      filtered = filtered.filter(record => {
        if (!record.date) return false;
        try {
          const recordDate = new Date(record.date);
          recordDate.setHours(0, 0, 0, 0);

          if (filterDateFrom.trim()) {
            const fromDate = new Date(filterDateFrom);
            fromDate.setHours(0, 0, 0, 0);
            if (recordDate < fromDate) return false;
          }

          if (filterDateTo.trim()) {
            const toDate = new Date(filterDateTo);
            toDate.setHours(23, 59, 59, 999);
            if (recordDate > toDate) return false;
          }

          return true;
        } catch (e) {
          return false;
        }
      });
    }

    // Year filter
    if (filterYear.trim()) {
      const yearNum = parseInt(filterYear.trim(), 10);
      if (!isNaN(yearNum)) {
        filtered = filtered.filter(record => {
          if (!record.date) return false;
          try {
            const date = new Date(record.date);
            return !isNaN(date.getTime()) && date.getFullYear() === yearNum;
          } catch (e) {
            return false;
          }
        });
      }
    }

    // Month filter
    if (filterMonth.trim()) {
      const monthNum = parseInt(filterMonth.trim(), 10);
      if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
        filtered = filtered.filter(record => {
          if (!record.date) return false;
          try {
            const date = new Date(record.date);
            return !isNaN(date.getTime()) && date.getMonth() + 1 === monthNum;
          } catch (e) {
            return false;
          }
        });
      }
    }

    // Sort by date from oldest to newest
    filtered.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    return filtered;
  }, [overtimeRecords, filterYear, filterMonth, filterDateFrom, filterDateTo]);

  // Apply search filter
  const searchedRecords = useMemo(() => {
    if (!searchQuery.trim()) return filteredRecords;

    const query = searchQuery.toLowerCase().trim();
    return filteredRecords.filter(record => {
      return (
        record.date?.toLowerCase().includes(query) ||
        record.employeeName?.toLowerCase().includes(query) ||
        record.type?.toLowerCase().includes(query) ||
        record.description?.toLowerCase().includes(query) ||
        record.timeFrom?.toLowerCase().includes(query) ||
        record.timeTo?.toLowerCase().includes(query) ||
        record.hours?.toLowerCase().includes(query)
      );
    });
  }, [filteredRecords, searchQuery]);

  // Group records by date
  const groupedRecords = useMemo(() => {
    const groups: { date: string; records: any[] }[] = [];
    const dateMap = new Map<string, any[]>();

    searchedRecords.forEach(record => {
      const date = record.date || 'No Date';
      if (!dateMap.has(date)) {
        dateMap.set(date, []);
      }
      dateMap.get(date)?.push(record);
    });

    dateMap.forEach((records, date) => {
      groups.push({ date, records });
    });

    return groups;
  }, [searchedRecords]);

  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const toggleDate = (date: string) => {
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedDates(newExpanded);
  };

  // Calculate employee statistics
  const employeeStats = useMemo(() => {
    const stats: {
      [employeeName: string]: {
        days: number;
        totalHours: number;
        totalAmount: number;
        dates: Set<string>;
      };
    } = {};

    overtimeRecords.forEach(record => {
      const name = record.employeeName;
      if (!name) return;

      if (!stats[name]) {
        stats[name] = {
          days: 0,
          totalHours: 0,
          totalAmount: 0,
          dates: new Set()
        };
      }

      // Add unique date
      if (record.date) {
        stats[name].dates.add(record.date);
      }

      // Parse hours (format: "4.30" means 4 hours and 30 minutes)
      if (record.hours) {
        const hoursStr = record.hours.toString();
        const parts = hoursStr.split('.');
        const hours = parseInt(parts[0]) || 0;
        const minutes = parseInt(parts[1]) || 0;
        const totalHours = hours + (minutes / 60);
        stats[name].totalHours += totalHours;
      }
    });

    // Convert to array and calculate final values
    return Object.entries(stats).map(([name, data]) => ({
      employeeName: name,
      days: data.dates.size,
      totalHours: data.totalHours,
      totalAmount: data.totalHours * 10 // 10 AED per hour
    })).sort((a, b) => b.totalAmount - a.totalAmount); // Sort by amount descending
  }, [overtimeRecords]);

  // Apply filters to employee stats
  const filteredEmployeeStats = useMemo(() => {
    // First filter the records based on date filters
    let filtered = [...overtimeRecords];

    // Date range filter
    if (filterDateFrom.trim() || filterDateTo.trim()) {
      filtered = filtered.filter(record => {
        if (!record.date) return false;
        try {
          const recordDate = new Date(record.date);
          recordDate.setHours(0, 0, 0, 0);

          if (filterDateFrom.trim()) {
            const fromDate = new Date(filterDateFrom);
            fromDate.setHours(0, 0, 0, 0);
            if (recordDate < fromDate) return false;
          }

          if (filterDateTo.trim()) {
            const toDate = new Date(filterDateTo);
            toDate.setHours(23, 59, 59, 999);
            if (recordDate > toDate) return false;
          }

          return true;
        } catch (e) {
          return false;
        }
      });
    }

    // Year filter
    if (filterYear.trim()) {
      const yearNum = parseInt(filterYear.trim(), 10);
      if (!isNaN(yearNum)) {
        filtered = filtered.filter(record => {
          if (!record.date) return false;
          try {
            const date = new Date(record.date);
            return !isNaN(date.getTime()) && date.getFullYear() === yearNum;
          } catch (e) {
            return false;
          }
        });
      }
    }

    // Month filter
    if (filterMonth.trim()) {
      const monthNum = parseInt(filterMonth.trim(), 10);
      if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
        filtered = filtered.filter(record => {
          if (!record.date) return false;
          try {
            const date = new Date(record.date);
            return !isNaN(date.getTime()) && date.getMonth() + 1 === monthNum;
          } catch (e) {
            return false;
          }
        });
      }
    }

    // Filter by type (Overtime vs Absent)
    const typeToFilter = showAbsentStats ? 'Absent' : 'Overtime';
    filtered = filtered.filter(record => (record.type || 'Overtime').trim().toLowerCase() === typeToFilter.toLowerCase());

    // Recalculate stats from filtered records
    const stats: {
      [employeeName: string]: {
        days: number;
        totalHours: number;
        totalAmount: number;
        dates: Set<string>;
      };
    } = {};

    filtered.forEach(record => {
      const name = record.employeeName;
      if (!name) return;

      if (!stats[name]) {
        stats[name] = {
          days: 0,
          totalHours: 0,
          totalAmount: 0,
          dates: new Set()
        };
      }

      // Add unique date
      if (record.date) {
        stats[name].dates.add(record.date);
      }

      // Parse hours (format: "4.30" means 4 hours and 30 minutes)
      if (record.hours) {
        const hoursStr = record.hours.toString();
        const parts = hoursStr.split('.');
        const hours = parseInt(parts[0]) || 0;
        const minutes = parseInt(parts[1]) || 0;
        const totalHours = hours + (minutes / 60);
        stats[name].totalHours += totalHours;
      }
    });

    // Convert to array and calculate final values
    return Object.entries(stats).map(([name, data]) => ({
      employeeName: name,
      days: data.dates.size,
      totalHours: data.totalHours,
      totalAmount: data.totalHours * 10 // 10 AED per hour
    })).sort((a, b) => showAbsentStats ? b.days - a.days : b.totalAmount - a.totalAmount); // Sort by amount or days descending
  }, [overtimeRecords, filterYear, filterMonth, filterDateFrom, filterDateTo, statsSearchQuery, showAbsentStats]);

  // Export to Excel
  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    const headers = ['Date', 'Employee ID', 'Employee Name (Ar)', 'Employee Name (En)', 'Particulars', 'FROM AM/PM', 'FTime', 'TO AM/PM', 'TTime'];

    const rows = searchedRecords.map(record => [
      record.date || '',
      record.employeeId || '',
      record.employeeNameAr || '',
      record.employeeName || '',
      record.type || 'Overtime',
      record.description || '',
      record.fromAmPm || 'PM',
      record.timeFrom || '',
      record.toAmPm || 'PM',
      record.timeTo || '',
    ]);

    const sheetData = [headers, ...rows];
    const sheet = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Overtime Records');

    const filename = `employee_overtime_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const formatTime = (time: string, amPm: string = 'PM') => {
    if (!time) return '';

    // Handle different formats: "4", "4.30", "4:30"
    let hour: number, minutes: string;

    if (time.includes(':')) {
      const parts = time.split(':');
      hour = parseInt(parts[0]) || 0;
      minutes = parts[1] || '00';
    } else if (time.includes('.')) {
      const parts = time.split('.');
      hour = parseInt(parts[0]) || 0;
      minutes = (parts[1] || '00').padEnd(2, '0');
    } else {
      hour = parseInt(time) || 0;
      minutes = '00';
    }

    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${amPm || 'PM'}`;
  };

  // Convert decimal hours (4.5) to base-60 format (4.30)
  const convertHoursToBase60 = (decimalHours: string | number): string => {
    const hours = typeof decimalHours === 'string' ? parseFloat(decimalHours) : decimalHours;
    if (isNaN(hours)) return '0.00';

    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours}.${minutes}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0 flex flex-col shadow-lg">
        {/* Sidebar Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col items-center justify-center gap-2">
            <button
              onClick={() => window.location.href = '/'}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
              title="Back to Home"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-gray-900 whitespace-nowrap">Employee Overtime</h1>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="p-4 flex-1 overflow-y-auto">
          {/* Register Overtime Tab - Hidden for Overtime Export */}
          {currentUser?.name !== 'Overtime Export' && (
            <button
              onClick={() => setActiveTab('register')}
              className={`w-full text-left p-4 mb-3 rounded-xl transition-all flex items-center gap-3 ${activeTab === 'register'
                ? 'bg-gray-900 text-white shadow-md'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
            >
              <Plus className={`w-5 h-5 ${activeTab === 'register' ? 'text-white' : 'text-gray-600'}`} />
              <span className="font-semibold">Register Overtime</span>
            </button>
          )}
          <button
            onClick={() => setActiveTab('view')}
            className={`w-full text-left p-4 mb-3 rounded-xl transition-all flex items-center gap-3 ${activeTab === 'view'
              ? 'bg-gray-900 text-white shadow-md'
              : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
          >
            <List className={`w-5 h-5 ${activeTab === 'view' ? 'text-white' : 'text-gray-600'}`} />
            <span className="font-semibold">View Records</span>
          </button>
          <button
            onClick={() => setActiveTab('statistics')}
            className={`w-full text-left p-4 mb-3 rounded-xl transition-all flex items-center gap-3 ${activeTab === 'statistics'
              ? 'bg-gray-900 text-white shadow-md'
              : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
          >
            <BarChart3 className={`w-5 h-5 ${activeTab === 'statistics' ? 'text-white' : 'text-gray-600'}`} />
            <span className="font-semibold">Statistics</span>
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 ml-64 p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">

          {/* Register Tab - Hidden for Overtime Export */}
          {activeTab === 'register' && currentUser?.name !== 'Overtime Export' && (
            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-lg border border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">Register Overtime</h2>
                <div className="flex items-center gap-3">
                  <label className="text-gray-700 font-semibold whitespace-nowrap">Date:</label>
                  <input
                    type="date"
                    value={currentDate}
                    onChange={(e) => setCurrentDate(e.target.value)}
                    className="px-4 py-2.5 bg-white border-2 border-gray-300 rounded-lg text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all shadow-sm hover:border-gray-400"
                  />
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {currentRows.map((row, index) => (
                  <div key={row.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    {/* Employee Name, Type, Time From, Time To, Delete Button - In one row */}
                    <div className="grid grid-cols-12 gap-2 items-end mb-3">
                      {/* Employee Name */}
                      <div className="col-span-12 md:col-span-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                          Employee Name
                        </label>
                        <div className="relative">
                          <select
                            value={row.employeeName}
                            onChange={(e) => updateRow(row.id, 'employeeName', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 font-medium text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all cursor-pointer appearance-none pr-8"
                          >
                            <option value="" disabled className="text-gray-400 font-medium">
                              Select Employee
                            </option>
                            {employeeNames.map((name) => (
                              <option
                                key={name}
                                value={name}
                                className="text-gray-900 font-medium"
                              >
                                {name}
                              </option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      {/* Type */}
                      <div className="col-span-12 md:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                          Type
                        </label>
                        <div className="relative">
                          <select
                            value={row.type || 'Overtime'}
                            onChange={(e) => updateRow(row.id, 'type', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 font-medium text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all cursor-pointer appearance-none pr-8"
                          >
                            <option value="Overtime">Overtime</option>
                            <option value="Absent">Absent</option>
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      {/* Time From */}
                      <div className="col-span-6 md:col-span-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                          Time From
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={row.fromAmPm || 'PM'}
                            onChange={(e) => updateRow(row.id, 'fromAmPm', e.target.value)}
                            className="px-1 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all text-sm font-medium hover:border-gray-400"
                          >
                            <option value="AM">AM</option>
                            <option value="PM">PM</option>
                          </select>
                          <input
                            type="text"
                            value={row.timeFrom}
                            onChange={(e) => updateRow(row.id, 'timeFrom', e.target.value)}
                            placeholder="4, 5, 4.30"
                            className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all text-sm font-medium hover:border-gray-400"
                          />
                        </div>
                      </div>

                      {/* Time To */}
                      <div className="col-span-6 md:col-span-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                          Time To
                        </label>
                        <div className="flex gap-2 items-center">
                          <select
                            value={row.toAmPm || 'PM'}
                            onChange={(e) => updateRow(row.id, 'toAmPm', e.target.value)}
                            className="px-1 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all text-sm font-medium hover:border-gray-400"
                          >
                            <option value="AM">AM</option>
                            <option value="PM">PM</option>
                          </select>
                          <input
                            type="text"
                            value={row.timeTo}
                            onChange={(e) => updateRow(row.id, 'timeTo', e.target.value)}
                            placeholder="4, 5, 4.30"
                            className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all text-sm font-medium hover:border-gray-400"
                          />
                        </div>
                      </div>

                      {/* Delete Button - Dedicated Column */}
                      <div className="col-span-12 md:col-span-1 flex justify-center pb-1">
                        <button
                          onClick={() => deleteRow(row.id)}
                          disabled={currentRows.length === 1}
                          className={`p-2 rounded-lg transition-all flex items-center justify-center w-full md:w-auto ${currentRows.length === 1
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed hidden md:flex'
                            : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 hover:border-red-300'
                            }`}
                          title="Remove row"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Description - Full Width */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">
                        Description
                      </label>
                      <textarea
                        value={row.description}
                        onChange={(e) => updateRow(row.id, 'description', e.target.value)}
                        placeholder="Enter description..."
                        rows={2}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all resize-y text-sm font-medium leading-relaxed hover:border-gray-400"
                        style={{ minHeight: '60px' }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={addNewRow}
                  className="flex-1 bg-white text-gray-700 border border-gray-300 py-2.5 rounded-lg font-medium hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add New Employee
                </button>
                <button
                  onClick={saveAllRecords}
                  disabled={loading}
                  className={`flex-1 bg-gray-900 text-white py-2.5 rounded-lg font-medium hover:bg-gray-800 transition-all flex items-center justify-center gap-2 text-sm ${loading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                >
                  <Save className="w-4 h-4" />
                  {loading ? 'Saving Data...' : 'Save All Records'}
                </button>
              </div>
            </div>
          )}

          {/* View Tab */}
          {activeTab === 'view' && (
            <div className="space-y-6">
              {/* Records Table */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <List className="w-5 h-5 text-gray-700" />
                      </div>
                      Overtime Records
                      <span className="text-lg text-gray-500 font-normal">({searchedRecords.length})</span>
                    </h2>
                    <button
                      onClick={exportToExcel}
                      className="p-2 rounded-full bg-green-600 text-white hover:bg-green-700 transition-colors"
                      title="Export to Excel"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                  <button
                    onClick={fetchRecords}
                    disabled={loadingRecords}
                    className="px-5 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <svg className={`w-4 h-4 ${loadingRecords ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {loadingRecords ? 'Loading Data...' : 'Refresh'}
                  </button>
                </div>

                {/* Filters */}
                <div className="p-4 bg-gray-50 border-b border-gray-200">
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    <div className="flex items-center gap-2">
                      <label htmlFor="filterYear" className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                        Year:
                      </label>
                      <input
                        id="filterYear"
                        type="number"
                        placeholder="e.g., 2024"
                        value={filterYear}
                        onChange={(e) => setFilterYear(e.target.value)}
                        className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                        min="2000"
                        max="2100"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label htmlFor="filterMonth" className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                        Month (1-12):
                      </label>
                      <input
                        id="filterMonth"
                        type="number"
                        placeholder="e.g., 1-12"
                        value={filterMonth}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || (parseInt(value) >= 1 && parseInt(value) <= 12)) {
                            setFilterMonth(value);
                          }
                        }}
                        className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                        min="1"
                        max="12"
                      />
                    </div>
                    {/* Date Range Filters */}
                    <div className="flex items-center gap-2">
                      <label htmlFor="filterDateFrom" className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                        From Date:
                      </label>
                      <input
                        id="filterDateFrom"
                        type="date"
                        value={filterDateFrom}
                        onChange={(e) => setFilterDateFrom(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label htmlFor="filterDateTo" className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                        To Date:
                      </label>
                      <input
                        id="filterDateTo"
                        type="date"
                        value={filterDateTo}
                        onChange={(e) => setFilterDateTo(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                      />
                    </div>
                    {(filterYear || filterMonth || filterDateFrom || filterDateTo) && (
                      <button
                        onClick={() => {
                          setFilterYear('');
                          setFilterMonth('');
                          setFilterDateFrom('');
                          setFilterDateTo('');
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>

                  {/* Search Box */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-gray-300">
                      <Search className="w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Quick search in table (Employee, Description, Date, etc.)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 bg-transparent border-none focus:outline-none text-gray-700 placeholder-gray-400"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {loadingRecords ? (
                  <div className="p-16 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4 animate-pulse">
                      <Clock className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-600 text-lg font-medium">Load Employee Overtime Data...</p>
                  </div>
                ) : searchedRecords.length === 0 ? (
                  <div className="p-16 text-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-2xl mb-6">
                      <Clock className="w-10 h-10 text-gray-400" />
                    </div>
                    <p className="text-gray-700 text-xl font-semibold mb-2">No overtime records yet</p>
                    <p className="text-gray-500">Start by registering your first overtime entry in the Register tab</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full table-fixed">
                      <thead>
                        <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                          <th className="px-6 py-4 text-center text-gray-700 font-bold text-xs uppercase tracking-wide w-[12%]">Date</th>
                          <th className="px-6 py-4 text-center text-gray-700 font-bold text-xs uppercase tracking-wide w-[18%]">Employee</th>
                          <th className="px-6 py-4 text-center text-gray-700 font-bold text-xs uppercase tracking-wide w-[10%]">Type</th>
                          <th className="px-6 py-4 text-center text-gray-700 font-bold text-xs uppercase tracking-wide w-[25%]">Description</th>
                          <th className="px-6 py-4 text-center text-gray-700 font-bold text-xs uppercase tracking-wide w-[12%]">From</th>
                          <th className="px-6 py-4 text-center text-gray-700 font-bold text-xs uppercase tracking-wide w-[12%]">To</th>
                          <th className="px-6 py-4 text-center text-gray-700 font-bold text-xs uppercase tracking-wide w-[11%]">Hours</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {groupedRecords.map((group) => {
                          const isExpanded = expandedDates.has(group.date);
                          const totalHours = group.records.reduce((sum, r) => sum + (parseFloat(r.hours) || 0), 0);

                          const isGroupSunday = group.date ? new Date(group.date).getDay() === 0 : false;

                          return (
                            <React.Fragment key={group.date}>
                              {/* Group Header */}
                              <tr
                                className={`cursor-pointer transition-colors ${isGroupSunday ? 'bg-yellow-100 hover:bg-yellow-200' : 'bg-gray-100 hover:bg-gray-200'}`}
                                onClick={() => toggleDate(group.date)}
                              >
                                <td colSpan={7} className="px-6 py-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 font-bold text-gray-800">
                                      {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                      <span className="w-28 inline-block">{group.date}</span>
                                      <span className="text-sm font-normal text-gray-600 bg-white border border-gray-200 px-3 py-1 rounded-full shadow-sm w-32 text-center inline-block">
                                        {group.records.length} records
                                      </span>
                                    </div>
                                    <span className="text-sm font-bold text-gray-700 bg-white px-3 py-1 rounded-full shadow-sm w-36 text-center inline-block">
                                      Total: {totalHours.toFixed(2)}h
                                    </span>
                                  </div>
                                </td>
                              </tr>

                              {/* Records */}
                              {isExpanded && group.records.map((record, index) => {
                                const isSunday = record.date ? new Date(record.date).getDay() === 0 : false;
                                return (
                                  <tr
                                    key={record.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (currentUser?.name !== 'Overtime Export') {
                                        openEditModal(record);
                                      }
                                    }}
                                    className={`${currentUser?.name !== 'Overtime Export' ? 'hover:bg-gray-100 cursor-pointer' : ''} transition-colors ${isSunday
                                      ? 'bg-yellow-100 hover:bg-yellow-200'
                                      : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                                      }`}
                                  >
                                    <td className="px-6 py-4 text-center text-gray-900 font-medium truncate opacity-50" title={record.date}>{record.date}</td>
                                    <td className="px-6 py-4 text-center text-gray-900 font-semibold truncate" title={record.employeeName}>{record.employeeName}</td>
                                    <td className="px-6 py-4 text-center text-gray-900 font-medium truncate">
                                      <span className={`inline-block px-2 py-1 rounded-md text-xs font-bold ${record.type === 'Absent' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                        }`}>
                                        {record.type || 'Overtime'}
                                      </span>
                                    </td>
                                    <td className={`px-6 py-4 text-center truncate ${isSunday ? 'text-gray-900 font-bold' : 'text-gray-600'}`} title={record.description}>{record.description}</td>
                                    <td className="px-6 py-4 text-center text-gray-700 font-medium truncate">{formatTime(record.timeFrom, record.fromAmPm)}</td>
                                    <td className="px-6 py-4 text-center text-gray-700 font-medium truncate">{formatTime(record.timeTo, record.toAmPm)}</td>
                                    <td className="px-6 py-4 text-center">
                                      <span className="inline-block bg-gray-900 text-white px-4 py-1.5 rounded-lg font-bold text-sm shadow-sm">
                                        {record.hours && !isNaN(parseFloat(record.hours)) ? `${record.hours}h` : '0.00h'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
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

          {/* Statistics Tab */}
          {activeTab === 'statistics' && (
            <div className="bg-white rounded-xl shadow-md">
              <div className="p-6 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-gray-700" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    Employee Statistics
                    <span className="text-lg text-gray-500 font-normal">({filteredEmployeeStats.length})</span>
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer bg-gray-100 px-4 py-2 rounded-lg hover:bg-gray-200 transition-all select-none border border-gray-200">
                    <span className={`text-sm font-bold ${!showAbsentStats ? 'text-blue-600' : 'text-gray-500'}`}>Overtime</span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={showAbsentStats}
                        onChange={(e) => setShowAbsentStats(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`w-10 h-6 bg-gray-300 rounded-full shadow-inner transition-colors ${showAbsentStats ? 'bg-red-500' : 'bg-blue-600'}`}></div>
                      <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow transition-transform ${showAbsentStats ? 'translate-x-4' : ''}`}></div>
                    </div>
                    <span className={`text-sm font-bold ${showAbsentStats ? 'text-red-600' : 'text-gray-500'}`}>Absent</span>
                  </label>
                </div>
              </div>

              {/* Filters */}
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <div className="flex items-center gap-2">
                    <label htmlFor="statsFilterYear" className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                      Year:
                    </label>
                    <input
                      id="statsFilterYear"
                      type="number"
                      placeholder="e.g., 2024"
                      value={filterYear}
                      onChange={(e) => setFilterYear(e.target.value)}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                      min="2000"
                      max="2100"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="statsFilterMonth" className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                      Month (1-12):
                    </label>
                    <input
                      id="statsFilterMonth"
                      type="number"
                      placeholder="e.g., 1-12"
                      value={filterMonth}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || (parseInt(value) >= 1 && parseInt(value) <= 12)) {
                          setFilterMonth(value);
                        }
                      }}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                      min="1"
                      max="12"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="statsFilterDateFrom" className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                      From Date:
                    </label>
                    <input
                      id="statsFilterDateFrom"
                      type="date"
                      value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="statsFilterDateTo" className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                      To Date:
                    </label>
                    <input
                      id="statsFilterDateTo"
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                    />
                  </div>
                  {(filterYear || filterMonth || filterDateFrom || filterDateTo) && (
                    <button
                      onClick={() => {
                        setFilterYear('');
                        setFilterMonth('');
                        setFilterDateFrom('');
                        setFilterDateTo('');
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>

                {/* Search Box */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-gray-300">
                    <Search className="w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Quick search by employee name..."
                      value={statsSearchQuery}
                      onChange={(e) => setStatsSearchQuery(e.target.value)}
                      className="flex-1 bg-transparent border-none focus:outline-none text-gray-700 placeholder-gray-400"
                    />
                    {statsSearchQuery && (
                      <button
                        onClick={() => setStatsSearchQuery('')}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {filteredEmployeeStats.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-2xl mb-6">
                    <BarChart3 className="w-10 h-10 text-gray-400" />
                  </div>
                  <p className="text-gray-700 text-xl font-semibold mb-2">No statistics available</p>
                  <p className="text-gray-500">Start by registering overtime entries</p>
                </div>
              ) : (
                <div className="p-6">
                  {/* Summary Cards */}
                  {/* Summary Cards */}
                  {/* Summary Cards */}
                  <div className={`grid gap-4 mb-6 ${showAbsentStats ? 'grid-cols-1 md:grid-cols-2 max-w-3xl mx-auto' : 'grid-cols-1 md:grid-cols-3'}`}>
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 shadow-lg text-white text-center">
                      <p className="text-blue-100 text-sm font-semibold uppercase tracking-wide mb-2">Total Employees</p>
                      <h3 className="text-4xl font-black">{filteredEmployeeStats.length}</h3>
                    </div>
                    {showAbsentStats ? (
                      <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-5 shadow-lg text-white text-center">
                        <p className="text-red-100 text-sm font-semibold uppercase tracking-wide mb-2">Total Absent Days</p>
                        <h3 className="text-4xl font-black">
                          {filteredEmployeeStats.reduce((sum, emp) => sum + emp.days, 0)}
                        </h3>
                      </div>
                    ) : (
                      <>
                        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-5 shadow-lg text-white text-center">
                          <p className="text-green-100 text-sm font-semibold uppercase tracking-wide mb-2">Total Hours</p>
                          <h3 className="text-4xl font-black">
                            {filteredEmployeeStats.reduce((sum, emp) => sum + emp.totalHours, 0).toFixed(1)}h
                          </h3>
                        </div>
                        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 shadow-lg text-white text-center">
                          <p className="text-purple-100 text-sm font-semibold uppercase tracking-wide mb-2">Total Amount</p>
                          <h3 className="text-4xl font-black">
                            {filteredEmployeeStats.reduce((sum, emp) => sum + emp.totalAmount, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
                          </h3>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Statistics Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                          <th className="px-6 py-4 text-center text-gray-700 font-bold text-xs uppercase tracking-wide">#</th>
                          <th className="px-6 py-4 text-center text-gray-700 font-bold text-xs uppercase tracking-wide">Employee Name</th>
                          <th className="px-6 py-4 text-center text-gray-700 font-bold text-xs uppercase tracking-wide">Days</th>
                          {!showAbsentStats && (
                            <>
                              <th className="px-6 py-4 text-center text-gray-700 font-bold text-xs uppercase tracking-wide">Total Hours</th>
                              <th className="px-6 py-4 text-center text-gray-700 font-bold text-xs uppercase tracking-wide">Total Amount (10 AED/hr)</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredEmployeeStats.map((emp, index) => (
                          <tr key={emp.employeeName} className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                            <td className="px-6 py-4 text-center text-gray-600 font-medium">{index + 1}</td>
                            <td className="px-6 py-4 text-center text-gray-900 font-semibold">{emp.employeeName}</td>
                            <td className="px-6 py-4 text-center text-gray-700 font-medium">{emp.days}</td>
                            {!showAbsentStats && (
                              <>
                                <td className="px-6 py-4 text-center text-gray-700 font-medium">{emp.totalHours.toFixed(1)}h</td>
                                <td className="px-6 py-4 text-center">
                                  <span className="inline-block bg-green-600 text-white px-4 py-1.5 rounded-lg font-bold text-sm shadow-sm">
                                    {emp.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
                                  </span>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                        {/* Total Row */}
                        <tr className="bg-gray-900 text-white font-bold border-t-2 border-gray-300">
                          <td colSpan={2} className="px-6 py-4 text-center text-lg">TOTAL</td>
                          <td className="px-6 py-4 text-center text-lg">
                            {filteredEmployeeStats.reduce((sum, emp) => sum + emp.days, 0)}
                          </td>
                          {!showAbsentStats && (
                            <>
                              <td className="px-6 py-4 text-center text-lg">
                                {filteredEmployeeStats.reduce((sum, emp) => sum + emp.totalHours, 0).toFixed(1)}h
                              </td>
                              <td className="px-6 py-4 text-center text-lg">
                                {filteredEmployeeStats.reduce((sum, emp) => sum + emp.totalAmount, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
                              </td>
                            </>
                          )}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Edit/Delete Modal */}
          {isModalOpen && (
            <div className="fixed inset-0 backdrop-blur-[2px] bg-white/25 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Edit2 className="w-6 h-6" />
                    Edit Overtime Record
                  </h2>
                  <button
                    onClick={closeModal}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  {/* Date */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Date
                    </label>
                    <input
                      type="date"
                      value={editingRecord.date}
                      onChange={(e) => setEditingRecord({ ...editingRecord, date: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border-2 border-gray-300 rounded-lg text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all"
                    />
                  </div>

                  {/* Employee Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Employee Name
                    </label>
                    <div className="relative">
                      <select
                        value={editingRecord.employeeName}
                        onChange={(e) => setEditingRecord({ ...editingRecord, employeeName: e.target.value })}
                        className="w-full px-4 py-2.5 bg-white border-2 border-gray-300 rounded-lg text-gray-900 font-medium text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all cursor-pointer appearance-none pr-10"
                      >
                        <option value="" disabled>Select Employee</option>
                        {employeeNames.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Type */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Type
                    </label>
                    <div className="relative">
                      <select
                        value={editingRecord.type || 'Overtime'}
                        onChange={(e) => setEditingRecord({ ...editingRecord, type: e.target.value })}
                        className="w-full px-4 py-2.5 bg-white border-2 border-gray-300 rounded-lg text-gray-900 font-medium text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all cursor-pointer appearance-none pr-10"
                      >
                        <option value="Overtime">Overtime</option>
                        <option value="Absent">Absent</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={editingRecord.description}
                      onChange={(e) => setEditingRecord({ ...editingRecord, description: e.target.value })}
                      placeholder="Enter description..."
                      rows={3}
                      className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all resize-none text-sm font-medium"
                    />
                  </div>

                  {/* Time From and To */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Time From
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={editingRecord.fromAmPm || 'PM'}
                          onChange={(e) => setEditingRecord({ ...editingRecord, fromAmPm: e.target.value })}
                          className="px-4 py-2.5 bg-white border-2 border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all text-sm font-medium"
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                        <input
                          type="text"
                          value={editingRecord.timeFrom}
                          onChange={(e) => setEditingRecord({ ...editingRecord, timeFrom: e.target.value })}
                          placeholder="4, 5, 4.30"
                          className="flex-1 px-4 py-2.5 bg-white border-2 border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all text-sm font-medium"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Time To
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={editingRecord.toAmPm || 'PM'}
                          onChange={(e) => setEditingRecord({ ...editingRecord, toAmPm: e.target.value })}
                          className="px-4 py-2.5 bg-white border-2 border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all text-sm font-medium"
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                        <input
                          type="text"
                          value={editingRecord.timeTo}
                          onChange={(e) => setEditingRecord({ ...editingRecord, timeTo: e.target.value })}
                          placeholder="4, 5, 4.30"
                          className="flex-1 px-4 py-2.5 bg-white border-2 border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all text-sm font-medium"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-gray-200 flex gap-3">
                  <button
                    onClick={handleDeleteRecord}
                    disabled={isSaving}
                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-5 h-5" />
                    Delete
                  </button>
                  <button
                    onClick={handleUpdateRecord}
                    disabled={isSaving}
                    className="flex-1 px-4 py-3 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-5 h-5" />
                    {isSaving ? 'Saving Data...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
