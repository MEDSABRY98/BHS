// Vehicle Expenses form: shared types and helpers.
// Nothing is saved in the database: the lines live in the page only.

/** One line read from the Excel file. */
export interface VehicleExpenseLine {
  VEHICLE: string;
  DRIVER: string;
  FUEL: number;
  MAINTENANCE: number;
}

/** One vehicle after grouping the lines (a vehicle can appear on several lines / drivers). */
export interface VehicleSummary {
  vehicle: string;
  drivers: string[];
  fuel: number;
  maintenance: number;
  total: number;
  /** share of all expenses, % */
  share: number;
}

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function cleanText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function formatAmount(n: number | null | undefined): string {
  return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function pct(part: number, whole: number): number {
  return whole ? (part / whole) * 100 : 0;
}

/** Lines → one row per vehicle (same vehicle number = same vehicle), highest total first. */
export function GroupByVehicle(lines: VehicleExpenseLine[]): VehicleSummary[] {
  const map = new Map<string, VehicleSummary>();
  for (const l of lines) {
    const key = l.VEHICLE.toUpperCase();
    const v = map.get(key) || { vehicle: l.VEHICLE, drivers: [], fuel: 0, maintenance: 0, total: 0, share: 0 };
    if (l.DRIVER && !v.drivers.some((d) => d.toUpperCase() === l.DRIVER.toUpperCase())) v.drivers.push(l.DRIVER);
    v.fuel += l.FUEL;
    v.maintenance += l.MAINTENANCE;
    map.set(key, v);
  }
  const list = [...map.values()].map((v) => ({ ...v, fuel: round2(v.fuel), maintenance: round2(v.maintenance), total: round2(v.fuel + v.maintenance) }));
  const all = list.reduce((s, v) => s + v.total, 0);
  return list.map((v) => ({ ...v, share: pct(v.total, all) })).sort((a, b) => b.total - a.total || a.vehicle.localeCompare(b.vehicle));
}

export function Totals(lines: VehicleExpenseLine[]) {
  const fuel = round2(lines.reduce((s, l) => s + l.FUEL, 0));
  const maintenance = round2(lines.reduce((s, l) => s + l.MAINTENANCE, 0));
  return { fuel, maintenance, total: round2(fuel + maintenance) };
}
