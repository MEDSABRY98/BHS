'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Clock, Plus, List, Trash2, Save, ArrowLeft } from 'lucide-react';

export default function EmployeeOvertimeTab() {
  const [activeTab, setActiveTab] = useState('register');
  const [overtimeRecords, setOvertimeRecords] = useState<any[]>([]);
  const [employeeNames, setEmployeeNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const recordsFetchedRef = useRef(false);
  const [currentRows, setCurrentRows] = useState([{
    id: Date.now(),
    employeeName: '',
    description: '',
    timeFrom: '',
    timeTo: '',
    hours: '0.00'
  }]);
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);

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
      setLoading(true);
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
      setLoading(false);
    }
  };

  const fetchRecords = async () => {
    try {
      setLoadingRecords(true);
      const response = await fetch('/api/employee-overtime');
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
          
          updatedRow.hours = calculateHours(
            convertToTimeFormat(fromTime),
            convertToTimeFormat(toTime)
          ).toFixed(2);
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
      description: '',
      timeFrom: '',
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
            description: row.description,
            timeFrom: row.timeFrom,
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
        description: '',
        timeFrom: '',
        timeTo: '',
        hours: '0.00'
      }]);
      setCurrentDate(new Date().toISOString().split('T')[0]);
      
      // Reset the records fetched flag so new records will be fetched when switching to view tab
      recordsFetchedRef.current = false;
      
      alert('Records saved successfully!');
    } catch (error) {
      console.error('Error saving records:', error);
      alert(error instanceof Error ? error.message : 'Failed to save records');
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

  const formatTime = (time: string) => {
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
    return `${displayHour}:${minutes} PM`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-[95%] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => window.location.href = '/'}
            className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Home Selection
          </button>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-black rounded-xl mb-4">
              <Clock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Overtime Tracking System</h1>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('register')}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-lg font-semibold transition-all ${
              activeTab === 'register'
                ? 'bg-black text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
            }`}
          >
            <Plus className="w-5 h-5" />
            Register Overtime
          </button>
          <button
            onClick={() => setActiveTab('view')}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-lg font-semibold transition-all ${
              activeTab === 'view'
                ? 'bg-black text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
            }`}
          >
            <List className="w-5 h-5" />
            View Records
          </button>
        </div>

        {/* Register Tab */}
        {activeTab === 'register' && (
          <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Plus className="w-6 h-6" />
                Register Overtime
              </h2>
              <div className="flex items-center gap-2">
                <label className="text-gray-700 font-medium">Date:</label>
                <input
                  type="date"
                  value={currentDate}
                  onChange={(e) => setCurrentDate(e.target.value)}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                />
              </div>
            </div>

            <div className="overflow-x-auto mb-6">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-center text-gray-700 font-semibold w-[20%]">Employee Name</th>
                    <th className="px-4 py-3 text-center text-gray-700 font-semibold w-[40%]">Description</th>
                    <th className="px-4 py-3 text-center text-gray-700 font-semibold w-[10%]">Time From</th>
                    <th className="px-4 py-3 text-center text-gray-700 font-semibold w-[10%]">Time To</th>
                    <th className="px-4 py-3 text-center text-gray-700 font-semibold w-[10%]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {currentRows.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100">
                      <td className="px-4 py-3 w-[20%]">
                        <div className="relative">
                          <select
                            value={row.employeeName}
                            onChange={(e) => updateRow(row.id, 'employeeName', e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border-2 border-gray-300 rounded-lg text-gray-900 font-medium text-sm shadow-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all cursor-pointer appearance-none pr-10 h-[42px]"
                          >
                            <option value="" disabled className="text-gray-400 font-medium text-sm py-2">
                              Select Employee
                            </option>
                            {employeeNames.map((name) => (
                              <option 
                                key={name} 
                                value={name} 
                                className="text-gray-900 font-medium text-sm py-2"
                              >
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
                      </td>
                      <td className="px-4 py-3 w-[40%]">
                        <textarea
                          value={row.description}
                          onChange={(e) => updateRow(row.id, 'description', e.target.value)}
                          placeholder="Enter description here..."
                          rows={3}
                          className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all resize-y text-sm font-medium leading-relaxed shadow-sm hover:border-gray-400"
                          style={{ minHeight: '80px' }}
                        />
                      </td>
                      <td className="px-4 py-3 w-[10%]">
                        <input
                          type="text"
                          value={row.timeFrom}
                          onChange={(e) => updateRow(row.id, 'timeFrom', e.target.value)}
                          placeholder="4, 5, 6, 4.30, 5.20 (PM)"
                          className="w-full px-4 py-2.5 bg-white border-2 border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm font-medium h-[42px]"
                        />
                      </td>
                      <td className="px-4 py-3 w-[10%]">
                        <input
                          type="text"
                          value={row.timeTo}
                          onChange={(e) => updateRow(row.id, 'timeTo', e.target.value)}
                          placeholder="4, 5, 6, 4.30, 5.20 (PM)"
                          className="w-full px-4 py-2.5 bg-white border-2 border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm font-medium h-[42px]"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => deleteRow(row.id)}
                          disabled={currentRows.length === 1}
                          className={`p-2 rounded-lg transition-colors inline-block ${
                            currentRows.length === 1
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                          }`}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-4">
              <button
                onClick={addNewRow}
                className="flex-1 bg-white text-gray-700 border border-gray-300 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add New Row
              </button>
              <button
                onClick={saveAllRecords}
                disabled={loading}
                className={`flex-1 bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition-all flex items-center justify-center gap-2 ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Save className="w-5 h-5" />
                {loading ? 'Saving...' : 'Save All Records'}
              </button>
            </div>
          </div>
        )}

        {/* View Tab */}
        {activeTab === 'view' && (
          <div className="space-y-6">
            {/* Summary Card */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Total Overtime Hours</p>
                  <p className="text-5xl font-bold text-gray-900 mt-2">{totalHours.toFixed(2)}</p>
                  <p className="text-gray-500 mt-1">hours</p>
                </div>
                <div className="bg-gray-100 rounded-full p-4">
                  <Clock className="w-12 h-12 text-gray-900" />
                </div>
              </div>
            </div>

            {/* Records Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <List className="w-6 h-6" />
                  Overtime Records ({overtimeRecords.length})
                </h2>
                <button
                  onClick={fetchRecords}
                  disabled={loadingRecords}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  {loadingRecords ? 'Loading...' : 'Refresh'}
                </button>
              </div>
              
              {loadingRecords ? (
                <div className="p-12 text-center">
                  <p className="text-gray-600">Loading records...</p>
                </div>
              ) : overtimeRecords.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                    <Clock className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-600 text-lg">No overtime records yet</p>
                  <p className="text-gray-400 mt-2">Start by registering your first overtime entry</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-6 py-4 text-center text-gray-700 font-semibold">Date</th>
                        <th className="px-6 py-4 text-center text-gray-700 font-semibold">Employee</th>
                        <th className="px-6 py-4 text-center text-gray-700 font-semibold">Description</th>
                        <th className="px-6 py-4 text-center text-gray-700 font-semibold">From</th>
                        <th className="px-6 py-4 text-center text-gray-700 font-semibold">To</th>
                        <th className="px-6 py-4 text-center text-gray-700 font-semibold">Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overtimeRecords.map((record, index) => (
                        <tr key={record.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                          <td className="px-6 py-4 text-center text-gray-900">{record.date}</td>
                          <td className="px-6 py-4 text-center text-gray-900 font-medium">{record.employeeName}</td>
                          <td className="px-6 py-4 text-center text-gray-600">{record.description}</td>
                          <td className="px-6 py-4 text-center text-gray-600">{formatTime(record.timeFrom)}</td>
                          <td className="px-6 py-4 text-center text-gray-600">{formatTime(record.timeTo)}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-block bg-gray-900 text-white px-3 py-1 rounded-lg font-semibold text-sm">
                              {record.hours && !isNaN(parseFloat(record.hours)) ? `${record.hours}h` : '0.00h'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
