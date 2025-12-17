'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Trash2, PackageOpen, ChevronDown, BarChart3 } from 'lucide-react';
import { WarehouseCleaningEntry } from '@/lib/googleSheets';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Loading from './Loading';

const WarehouseCleaningTab = () => {
  const [warehouseData, setWarehouseData] = useState<WarehouseCleaningEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, string>>({});
  const [updatingRatings, setUpdatingRatings] = useState<Record<string, boolean>>({});

  // Get current date
  const today = new Date();
  const currentYear = today.getFullYear().toString();
  const currentMonth = (today.getMonth() + 1).toString();

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedWeek, setSelectedWeek] = useState('all');

  useEffect(() => {
    fetchWarehouseData();
  }, []);

  const fetchWarehouseData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/warehouse-cleaning');
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.details || result.error || 'Failed to fetch warehouse data');
      }
      
      console.log('Warehouse data received:', result.data);
      console.log('Data length:', result.data?.length || 0);
      
      setWarehouseData(result.data || []);
      
      // Initialize ratings from data
      const ratingsMap: Record<string, string> = {};
      result.data?.forEach((entry: WarehouseCleaningEntry) => {
        if (entry.date && entry.year && entry.month) {
          const key = `${entry.year}-${entry.month}-${entry.date}`;
          ratingsMap[key] = entry.rating || '';
        }
      });
      setRatings(ratingsMap);
      
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Error fetching warehouse data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRatingChange = async (year: string, month: string, date: string, rating: string) => {
    const key = `${year}-${month}-${date}`;
    
    // Update local state immediately
    setRatings(prev => ({ ...prev, [key]: rating }));
    setUpdatingRatings(prev => ({ ...prev, [key]: true }));

    try {
      const response = await fetch('/api/warehouse-cleaning/rating', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ year, month, date, rating }),
      });

      if (!response.ok) {
        throw new Error('Failed to update rating');
      }

      // Update warehouseData locally without refetching
      setWarehouseData(prevData => 
        prevData.map(entry => {
          if (entry.year === year && entry.month === month && entry.date === date) {
            return { ...entry, rating };
          }
          return entry;
        })
      );
    } catch (err) {
      console.error('Error updating rating:', err);
      // Revert on error - restore previous rating from warehouseData
      const previousEntry = warehouseData.find(
        e => e.year === year && e.month === month && e.date === date
      );
      const previousRating = previousEntry?.rating || '';
      setRatings(prev => ({ ...prev, [key]: previousRating }));
      alert('فشل في حفظ التقييم. يرجى المحاولة مرة أخرى.');
    } finally {
      setUpdatingRatings(prev => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
    }
  };

  const getWorkerColor = (name: string) => {
    const colors: Record<string, string> = {
      'Mostafa': 'bg-red-500',
      'Hassan': 'bg-blue-500',
      'Bashir': 'bg-purple-500',
      'Jaafar': 'bg-orange-500'
    };
    return colors[name] || 'bg-gray-500';
  };

  // Filter data by year and month (normalize values for comparison)
  const filteredData = useMemo(() => {
    const filtered = warehouseData.filter(entry => {
      // Normalize year and month for comparison (handle string/number differences)
      const entryYear = entry.year?.toString().trim() || '';
      const entryMonth = entry.month?.toString().trim() || '';
      const normalizedSelectedYear = selectedYear.toString().trim();
      const normalizedSelectedMonth = selectedMonth.toString().trim();
      
      return entryYear === normalizedSelectedYear && entryMonth === normalizedSelectedMonth;
    });
    console.log(`Filtered data for Year ${selectedYear}, Month ${selectedMonth}: ${filtered.length} entries`);
    return filtered;
  }, [warehouseData, selectedYear, selectedMonth]);

  // Group data by week
  const weeks = useMemo(() => {
    const weekMap = new Map<string, WarehouseCleaningEntry[]>();
    
    filteredData.forEach(entry => {
      const weekKey = entry.week || 'Unknown';
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, []);
      }
      weekMap.get(weekKey)!.push(entry);
    });

    // Convert to array and sort by date
    const weekArray = Array.from(weekMap.entries()).map(([weekId, entries]) => {
      // Sort entries by date
      const sortedEntries = entries.sort((a, b) => {
        const dateA = a.date ? parseInt(a.date.split('/')[0]) : 0;
        const dateB = b.date ? parseInt(b.date.split('/')[0]) : 0;
        return dateA - dateB;
      });

      // Get date range
      const dates = sortedEntries.map(e => e.date).filter(Boolean);
      const startDate = dates[0] || '';
      const endDate = dates[dates.length - 1] || '';

      return {
        id: weekId,
        title: weekId,
        period: startDate && endDate ? `${startDate} - ${endDate}` : weekId,
        days: sortedEntries.map(entry => ({
          day: entry.day || '',
          date: entry.date || '',
          cleaning: entry.cleaningName || null,
          organizing: entry.organizingName || null,
          off: !entry.cleaningName && !entry.organizingName,
          rating: entry.rating || '',
          year: entry.year || '',
          month: entry.month || ''
        }))
      };
    });

    // Sort weeks by the first date in each week
    return weekArray.sort((a, b) => {
      const dateA = a.days[0]?.date ? parseInt(a.days[0].date.split('/')[0]) : 0;
      const dateB = b.days[0]?.date ? parseInt(b.days[0].date.split('/')[0]) : 0;
      return dateA - dateB;
    });
  }, [filteredData]);

  const weekOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'All Weeks' }];
    weeks.forEach((week, idx) => {
      options.push({
        value: week.id,
        label: `${week.title} (${week.period})`
      });
    });
    return options;
  }, [weeks]);

  const filteredWeeks = selectedWeek === 'all' 
    ? weeks 
    : weeks.filter(w => w.id === selectedWeek);

  // Calculate statistics for workers based on filtered data
  const workerStats = useMemo(() => {
    // Get data based on selected week filter
    const dataToAnalyze = selectedWeek === 'all' 
      ? filteredData 
      : filteredData.filter(entry => entry.week === selectedWeek);

    const statsMap = new Map<string, { 
      cleaning: number; 
      organizing: number; 
      total: number; 
      color: string;
      ratings: number[];
    }>();

    // Helper function to check if value should be excluded
    const shouldExclude = (value: string | null | undefined): boolean => {
      if (!value) return true;
      const normalized = value.trim().toUpperCase();
      return normalized === 'DAY OFF' || normalized === '-' || normalized === '';
    };

    dataToAnalyze.forEach(entry => {
      // Count cleaning tasks (exclude DAY OFF and -)
      if (entry.cleaningName && !shouldExclude(entry.cleaningName)) {
        const worker = entry.cleaningName.trim();
        if (!statsMap.has(worker)) {
          statsMap.set(worker, { cleaning: 0, organizing: 0, total: 0, color: getWorkerColor(worker), ratings: [] });
        }
        const stats = statsMap.get(worker)!;
        stats.cleaning++;
        stats.total++;
        
        // Add rating if exists
        if (entry.rating && entry.rating.trim()) {
          const ratingNum = parseFloat(entry.rating.trim());
          if (!isNaN(ratingNum)) {
            stats.ratings.push(ratingNum);
          }
        }
      }

      // Count organizing tasks (exclude DAY OFF and -)
      if (entry.organizingName && !shouldExclude(entry.organizingName)) {
        const worker = entry.organizingName.trim();
        if (!statsMap.has(worker)) {
          statsMap.set(worker, { cleaning: 0, organizing: 0, total: 0, color: getWorkerColor(worker), ratings: [] });
        }
        const stats = statsMap.get(worker)!;
        stats.organizing++;
        stats.total++;
        
        // Add rating if exists
        if (entry.rating && entry.rating.trim()) {
          const ratingNum = parseFloat(entry.rating.trim());
          if (!isNaN(ratingNum)) {
            stats.ratings.push(ratingNum);
          }
        }
      }
    });

    // Convert to array, calculate average rating, and sort by total
    const result = Array.from(statsMap.entries())
      .map(([name, stats]) => {
        const avgRating = stats.ratings.length > 0
          ? (stats.ratings.reduce((sum, r) => sum + r, 0) / stats.ratings.length).toFixed(2)
          : null;
        return { 
          name, 
          cleaning: stats.cleaning,
          organizing: stats.organizing,
          total: stats.total,
          color: stats.color,
          averageRating: avgRating
        };
      })
      .sort((a, b) => b.total - a.total);
    
    console.log('Worker stats calculated:', result);
    return result;
  }, [filteredData, selectedWeek]);

  // Prepare chart data
  const chartData = useMemo(() => {
    return workerStats.map(worker => ({
      name: worker.name,
      Cleaning: worker.cleaning,
      Organizing: worker.organizing,
      Total: worker.total
    }));
  }, [workerStats]);

  // Get unique years and months from data (normalize values)
  const availableYears = useMemo(() => {
    const yearSet = new Set<string>();
    warehouseData.forEach(entry => {
      if (entry.year) {
        // Normalize year value
        const normalizedYear = entry.year.toString().trim();
        if (normalizedYear) yearSet.add(normalizedYear);
      }
    });
    const years = Array.from(yearSet).sort((a, b) => {
      // Sort numerically if possible, otherwise alphabetically
      const numA = parseInt(a);
      const numB = parseInt(b);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.localeCompare(b);
    });
    console.log('Available years from Google Sheets:', years);
    return years;
  }, [warehouseData]);

  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    const normalizedSelectedYear = selectedYear.toString().trim();
    
    warehouseData
      .filter(entry => {
        // Normalize year for comparison
        const entryYear = entry.year?.toString().trim() || '';
        return entryYear === normalizedSelectedYear;
      })
      .forEach(entry => {
        if (entry.month) {
          // Normalize month value
          const normalizedMonth = entry.month.toString().trim();
          if (normalizedMonth) monthSet.add(normalizedMonth);
        }
      });
    
    const months = Array.from(monthSet).sort((a, b) => {
      // Sort numerically if possible
      const numA = parseInt(a);
      const numB = parseInt(b);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.localeCompare(b);
    });
    console.log(`Available months for year ${selectedYear} from Google Sheets:`, months);
    return months;
  }, [warehouseData, selectedYear]);

  // Auto-select first available year/month if current selection has no data
  useEffect(() => {
    if (warehouseData.length > 0 && availableYears.length > 0) {
      const normalizedSelectedYear = selectedYear.toString().trim();
      if (!availableYears.includes(normalizedSelectedYear)) {
        console.log(`Year ${selectedYear} not found, auto-selecting ${availableYears[0]}`);
        setSelectedYear(availableYears[0]);
      }
    }
  }, [warehouseData, availableYears, selectedYear]);

  useEffect(() => {
    if (warehouseData.length > 0 && availableMonths.length > 0) {
      const normalizedSelectedMonth = selectedMonth.toString().trim();
      if (!availableMonths.includes(normalizedSelectedMonth)) {
        console.log(`Month ${selectedMonth} not found, auto-selecting ${availableMonths[0]}`);
        setSelectedMonth(availableMonths[0]);
      }
    } else if (warehouseData.length > 0 && availableMonths.length === 0) {
      // If no months available for selected year, clear month selection
      console.log(`No months available for year ${selectedYear}`);
    }
  }, [warehouseData, availableMonths, selectedMonth, selectedYear]);

  const months = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ];

  if (loading) {
    return <Loading message="Loading warehouse data..." />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center bg-red-50 p-6 rounded-lg">
          <p className="text-red-600 text-lg mb-4">Error loading warehouse data</p>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchWarehouseData}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Main Title */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Calendar className="w-10 h-10 text-indigo-600" />
            <h1 className="text-4xl font-bold text-gray-800">Warehouse Tasks Schedule</h1>
          </div>
        </div>

        {/* Filters - In One Row */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <ChevronDown className="w-5 h-5 text-indigo-600" />
            Filters
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            {/* Year Filter */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Year</label>
              <select 
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setSelectedWeek('all');
                }}
                className="w-full p-3 border-2 border-indigo-300 rounded-lg bg-white text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {/* Month Filter */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Month</label>
              <select 
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setSelectedWeek('all');
                }}
                className="w-full p-3 border-2 border-indigo-300 rounded-lg bg-white text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                disabled={availableMonths.length === 0}
              >
                {availableMonths.length === 0 ? (
                  <option value="">No months available</option>
                ) : (
                  availableMonths.map(monthValue => {
                    // Find month label from months array, or use the value directly
                    const monthInfo = months.find(m => m.value === monthValue);
                    const monthLabel = monthInfo ? monthInfo.label : `Month ${monthValue}`;
                    return (
                      <option key={monthValue} value={monthValue}>{monthLabel}</option>
                    );
                  })
                )}
              </select>
            </div>

            {/* Week Filter */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Week</label>
              <select 
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="w-full p-3 border-2 border-indigo-300 rounded-lg bg-white text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {weekOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Statistics Section */}
        {filteredData.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 className="w-8 h-8 text-indigo-600" />
              <h2 className="text-2xl font-bold text-gray-800">Monthly Workload Distribution</h2>
            </div>

            {/* Worker Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {workerStats.map((worker) => (
                <div
                  key={worker.name}
                  className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border-2 border-gray-200 shadow-md hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-4 h-4 rounded-full ${worker.color}`}></div>
                    <h3 className="text-lg font-bold text-gray-800">{worker.name}</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Cleaning:</span>
                      <span className="text-lg font-bold text-red-600">{worker.cleaning}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Organizing:</span>
                      <span className="text-lg font-bold text-green-600">{worker.organizing}</span>
                    </div>
                    <div className="pt-2 border-t border-gray-300 flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-700">Total:</span>
                      <span className="text-xl font-bold text-indigo-600">{worker.total}</span>
                    </div>
                    {worker.averageRating !== null && (
                      <div className="pt-2 border-t border-gray-300 flex justify-between items-center">
                        <span className="text-sm font-semibold text-gray-700">Avg Rating:</span>
                        <span className="text-lg font-bold text-purple-600">{worker.averageRating}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Bar Chart */}
            {chartData.length > 0 && (
              <div className="mt-8">
                <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Workload Visualization</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: '#4b5563', fontSize: 14, fontWeight: 'bold' }}
                      stroke="#9ca3af"
                    />
                    <YAxis 
                      tick={{ fill: '#4b5563', fontSize: 12 }}
                      stroke="#9ca3af"
                      domain={[0, 'dataMax + 2']}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value: number) => [value, '']}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      iconType="square"
                    />
                    <Bar 
                      dataKey="Cleaning" 
                      fill="#ef4444" 
                      name="Cleaning"
                      radius={[8, 8, 0, 0]}
                    />
                    <Bar 
                      dataKey="Organizing" 
                      fill="#22c55e" 
                      name="Organizing"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Weekly Tables */}
        <div className="space-y-6">
          {warehouseData.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
              <p className="text-red-600 text-lg font-bold mb-2">No data found in Google Sheets</p>
              <p className="text-gray-600 text-sm">Please check:</p>
              <ul className="text-gray-600 text-sm mt-2 list-disc list-inside">
                <li>Sheet name is "Warehouse Cleaning"</li>
                <li>Columns: Cleaning Name, Organizing Name, Year, Month, Date, Week, Day</li>
                <li>Data exists in the sheet</li>
              </ul>
              {error && (
                <div className="mt-4 p-4 bg-red-50 rounded-lg">
                  <p className="text-red-800 text-sm font-semibold">Error:</p>
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}
            </div>
          ) : filteredWeeks.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
              <p className="text-gray-600 text-lg mb-2">No data available for the selected period.</p>
              <p className="text-gray-500 text-sm mb-2">
                Selected: Year {selectedYear}, Month {months.find(m => m.value === selectedMonth)?.label || selectedMonth}
              </p>
              <p className="text-gray-500 text-sm">
                Total data loaded: {warehouseData.length} entries
                {availableYears.length > 0 && ` | Available years: ${availableYears.join(', ')}`}
                {availableMonths.length > 0 && ` | Available months for ${selectedYear}: ${availableMonths.map(m => months.find(month => month.value === m)?.label || m).join(', ')}`}
              </p>
            </div>
          ) : (
            filteredWeeks.map((week, weekIdx) => (
              <div key={weekIdx} className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
                {/* Week Header */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-5 text-white flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold">{week.title} | Warehouse Schedule</h2>
                    <p className="text-purple-100 mt-1">{week.period}</p>
                  </div>
                  <Calendar className="w-8 h-8 opacity-80" />
                </div>
                
                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b-2 border-gray-200">
                        <th className="p-4 text-left text-sm font-bold text-gray-600 uppercase">Day</th>
                        <th className="p-4 text-left text-sm font-bold text-gray-600 uppercase">Date</th>
                        <th className="p-4 text-center text-sm font-bold text-red-600 uppercase">
                          <div className="flex items-center justify-center gap-2">
                            <Trash2 className="w-4 h-4" />
                            Cleaning (9:30 AM : 10:00 AM)
                          </div>
                        </th>
                        <th className="p-4 text-center text-sm font-bold text-purple-600 uppercase">
                          <div className="flex items-center justify-center gap-2">
                            <PackageOpen className="w-4 h-4" />
                            Organizing (10:00 AM : 10.30 AM)
                          </div>
                        </th>
                        <th className="p-4 text-center text-sm font-bold text-indigo-600 uppercase">
                          Rating
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {week.days.map((day, idx) => (
                        <tr 
                          key={idx} 
                          className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                            day.off ? 'bg-gray-50' : ''
                          }`}
                        >
                          <td className="p-4 font-semibold text-gray-700">{day.day}</td>
                          <td className="p-4 text-gray-600">{day.date}</td>
                          <td className="p-4 text-center">
                            {day.off ? (
                              <span className="inline-block bg-gray-300 text-gray-600 px-6 py-2 rounded-full text-sm font-semibold">
                                DAY OFF
                              </span>
                            ) : day.cleaning ? (
                              <span className={`inline-block ${getWorkerColor(day.cleaning)} text-white px-6 py-2 rounded-full text-sm font-bold shadow-md`}>
                                {day.cleaning}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            {day.off ? (
                              <span className="inline-block bg-gray-300 text-gray-600 px-6 py-2 rounded-full text-sm font-semibold">
                                DAY OFF
                              </span>
                            ) : day.organizing ? (
                              <span className={`inline-block ${getWorkerColor(day.organizing)} text-white px-6 py-2 rounded-full text-sm font-bold shadow-md`}>
                                {day.organizing}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <input
                              type="text"
                              value={ratings[`${day.year}-${day.month}-${day.date}`] || ''}
                              onChange={(e) => {
                                const newRating = e.target.value;
                                const key = `${day.year}-${day.month}-${day.date}`;
                                setRatings(prev => ({ ...prev, [key]: newRating }));
                              }}
                              onBlur={(e) => {
                                if (day.year && day.month && day.date) {
                                  handleRatingChange(day.year, day.month, day.date, e.target.value);
                                }
                              }}
                              placeholder="Enter rating"
                              className="w-24 px-3 py-2 border-2 border-indigo-300 rounded-lg text-center text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              disabled={updatingRatings[`${day.year}-${day.month}-${day.date}`]}
                            />
                            {updatingRatings[`${day.year}-${day.month}-${day.date}`] && (
                              <div className="mt-1 text-xs text-indigo-600">Saving...</div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default WarehouseCleaningTab;

