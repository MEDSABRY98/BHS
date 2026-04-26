export const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;

  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parseInt(parts[2], 10);
    const candidate = new Date(y, m, d);
    if (!isNaN(candidate.getTime())) return candidate;
  }

  return null;
};

export const formatDate = (date: Date | null): string => {
  if (!date) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export const formatDateInput = (date: Date | null): string => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getDailyKey = (date: Date): string => {
  return formatDate(date);
};

export const getWeeklyKey = (date: Date): string => {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
  const week = Math.floor(days / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
};

export const getMonthlyKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const getYearlyKey = (date: Date): string => {
  return String(date.getFullYear());
};

export const formatPeriodLabel = (key: string, periodType: 'daily' | 'weekly' | 'monthly' | 'yearly'): string => {
  if (periodType === 'daily') {
    return key; // Already formatted as DD/MM/YYYY
  } else if (periodType === 'weekly') {
    const [year, week] = key.split('-W');
    return `Week ${week}, ${year}`;
  } else if (periodType === 'monthly') {
    const [year, month] = key.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = parseInt(month, 10) - 1;
    return `${monthNames[monthIndex] || month} ${year}`;
  } else {
    return key;
  }
};
