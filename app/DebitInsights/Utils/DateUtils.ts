export function parseDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.trim().split(/[\/\-]/);
  if (parts.length === 3) {
    const p1 = parseInt(parts[0], 10);
    const p2 = parseInt(parts[1], 10);
    const p3 = parseInt(parts[2], 10);
    if (!isNaN(p1) && !isNaN(p2) && !isNaN(p3)) {
      if (p3 > 1000) {
        const parsed = new Date(p3, p2 - 1, p1);
        if (!isNaN(parsed.getTime())) return parsed;
      } else if (p1 > 1000) {
        const parsed = new Date(p1, p2 - 1, p3);
        if (!isNaN(parsed.getTime())) return parsed;
      }
    }
  }
  const direct = new Date(dateStr);
  if (!isNaN(direct.getTime())) return direct;
  return null;
}

export function endOfDay(dateInput: string | Date): Date {
  const date = typeof dateInput === 'string' ? parseDate(dateInput) : new Date(dateInput);
  const result = date ? new Date(date) : new Date();
  result.setHours(23, 59, 59, 999);
  return result;
}

export function startOfDay(dateInput: string | Date): Date {
  const date = typeof dateInput === 'string' ? parseDate(dateInput) : new Date(dateInput);
  const result = date ? new Date(date) : new Date();
  result.setHours(0, 0, 0, 0);
  return result;
}

export function toInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getMonthlyKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(key: string): string {
  const [year, month] = key.split('-');
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const monthIndex = parseInt(month, 10) - 1;
  if (monthIndex >= 0 && monthIndex < 12) {
    return `${monthNames[monthIndex]} ${year}`;
  }
  return key;
}
