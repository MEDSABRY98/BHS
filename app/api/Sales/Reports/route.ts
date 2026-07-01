import { NextResponse } from 'next/server';
import { bhs_supabas } from '@/lib/supabase';
import { getFilteredSalesData } from '@/app/Sales/Utils/SalesMappingCache';
import {
  augmentWithDates,
  applyGeoFilters,
  buildAtRisk,
  buildCustomerChangeRows,
  buildDeclining,
  buildGrowing,
  buildLast6MonthsComparison,
  buildMonthlySparkline,
  buildTopCategories,
  buildTopCustomers,
  buildTopReturnCustomers,
  buildTopInvoicesByValue,
  buildTopProducts,
  buildDailySalesCalendars,
  computePeriodMetrics,
  getPrevMonthPeriod,
  getSameMonthLastYearPeriod,
  periodData,
  pctChange,
  absChange,
  resolveReportPeriod,
} from '@/app/Sales/Utils/ReportsAggregation';
import {
  getPrimaryAmount,
  REPORTING_MODE_LABELS,
  PRIMARY_AMOUNT_LABELS,
  resolveReportingMode,
  shouldShowReturnAmountKpi,
  shouldShowTargetAchievement,
  shouldShowTargetInChart,
} from '@/app/Sales/Utils/ReportingMode';

export const maxDuration = 60;

async function fetchTargets(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const { data, error } = await bhs_supabas
    .from('web_Sales_DB_TARGET')
    .select('"USER_ID", "YEAR", "MONTH", "TARGET_AMOUNT", "TARGET_TYPE"');
  if (error || !data) return map;
  data.forEach((row: Record<string, unknown>) => {
    const type = String(row.TARGET_TYPE || 'sales_rep');
    const key = `${row.USER_ID}|${row.YEAR}|${row.MONTH}|${type}`;
    map.set(key, Number(row.TARGET_AMOUNT) || 0);
  });
  return map;
}

async function fetchUserName(uid: string): Promise<string> {
  const { data } = await bhs_supabas
    .from('bhs_USERS')
    .select('NAME')
    .eq('ID', uid.toUpperCase())
    .maybeSingle();
  return data?.NAME || uid;
}

async function resolveUserIdByName(name: string): Promise<string | null> {
  const { data: users } = await bhs_supabas.from('bhs_USERS').select('ID, NAME');
  if (!users) return null;
  const upper = name.trim().toUpperCase();
  const match = users.find((u) => String(u.NAME || '').trim().toUpperCase() === upper);
  return match?.ID || null;
}

async function checkIsManager(userId: string): Promise<boolean> {
  const { data: user } = await bhs_supabas
    .from('bhs_USERS')
    .select('NAME, ROLE, IS_SALESMANAGER')
    .eq('ID', String(userId).trim().toUpperCase())
    .maybeSingle();
  if (!user) return false;
  const userName = String(user.NAME || '').trim().toLowerCase();
  return (
    userName === 'med sabry' ||
    String(user.ROLE || '').toLowerCase() === 'admin' ||
    user.IS_SALESMANAGER === true ||
    String(user.IS_SALESMANAGER || '').toUpperCase() === 'TRUE'
  );
}

function sumTargetsForMonth(
  targetMap: Map<string, number>,
  year: number,
  month: number,
  userIds?: string[] | null,
  targetType?: 'sales_rep' | 'merchandiser' | null
): number {
  let total = 0;
  targetMap.forEach((amount, key) => {
    const parts = key.split('|');
    const uid = parts[0];
    const y = parseInt(parts[1], 10);
    const m = parseInt(parts[2], 10);
    const type = parts[3] || 'sales_rep';
    if (y !== year || m !== month) return;
    if (targetType && type !== targetType) return;
    if (userIds && userIds.length > 0 && !userIds.includes(uid)) return;
    total += amount;
  });
  return total;
}

function kpiBlock(value: number, change: number, sparkline: number[], changeIsPct = true) {
  return {
    value,
    changePct: changeIsPct ? change : undefined,
    changeAbs: !changeIsPct ? change : undefined,
    sparkline,
  };
}

export async function POST(request: Request) {
  try {
    const { userId, filters } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const rawData = await getFilteredSalesData(userId);
    const geoData = applyGeoFilters(augmentWithDates(rawData), filters);
    const reportingMode = resolveReportingMode(filters?.invoiceType);

    const period = resolveReportPeriod(filters);
    const prevPeriod = getPrevMonthPeriod(period.year, period.month);
    const smlyPeriod = getSameMonthLastYearPeriod(period.year, period.month);
    const prevPrevPeriod = getPrevMonthPeriod(prevPeriod.year, prevPeriod.month);

    const currentData = periodData(geoData, period.fromTime, period.toTime);
    const prevMonthData = periodData(geoData, prevPeriod.fromTime, prevPeriod.toTime);
    const smlyData = periodData(geoData, smlyPeriod.fromTime, smlyPeriod.toTime);
    const prevPrevData = periodData(geoData, prevPrevPeriod.fromTime, prevPrevPeriod.toTime);

    const smlyPrevPeriod = getPrevMonthPeriod(smlyPeriod.year, smlyPeriod.month);
    const smlyPrevData = periodData(geoData, smlyPrevPeriod.fromTime, smlyPrevPeriod.toTime);

    const currentMetrics = computePeriodMetrics(currentData, [], filters?.invoiceType);
    const primaryCurrent = getPrimaryAmount(currentMetrics, reportingMode);

    const targetMap = await fetchTargets();
    const isManager = await checkIsManager(userId);

    let targetUserIds: string[] | null = null;
    let targetType: 'sales_rep' | 'merchandiser' | null = null;
    if (filters?.salesRep) {
      const rid = await resolveUserIdByName(filters.salesRep);
      targetUserIds = rid ? [rid] : [];
      targetType = 'sales_rep';
    } else if (filters?.merchandiser) {
      const mid = await resolveUserIdByName(filters.merchandiser);
      targetUserIds = mid ? [mid] : [];
      targetType = 'merchandiser';
    } else if (!isManager) {
      targetUserIds = [String(userId).trim().toUpperCase()];
      targetType = 'sales_rep';
    }

    const getTarget = (y: number, m: number) =>
      isManager && !filters?.salesRep && !filters?.merchandiser
        ? sumTargetsForMonth(targetMap, y, m, null, null)
        : sumTargetsForMonth(targetMap, y, m, targetUserIds, targetType);

    const monthlyComparison = buildLast6MonthsComparison(
      geoData,
      period.year,
      period.month,
      getTarget,
      { showTarget: shouldShowTargetInChart(reportingMode), invoiceType: filters?.invoiceType }
    );

    const dailySalesCalendars = buildDailySalesCalendars(currentData, period);

    const sparkPrimary = buildMonthlySparkline(geoData, period.year, period.month, 8, (items) =>
      getPrimaryAmount(computePeriodMetrics(items, [], filters?.invoiceType), reportingMode)
    );
    const sparkInvoices = buildMonthlySparkline(geoData, period.year, period.month, 8, (items) =>
      computePeriodMetrics(items, [], filters?.invoiceType).invoices
    );
    const sparkCustomers = buildMonthlySparkline(geoData, period.year, period.month, 8, (items) => {
      const set = new Set<string>();
      items.forEach((i) => set.add(i.customerId || i.customerName || ''));
      return set.size;
    });
    const sparkAvgInv = buildMonthlySparkline(geoData, period.year, period.month, 8, (items) =>
      computePeriodMetrics(items, [], filters?.invoiceType).avgInvoiceValue
    );
    const sparkNewCust = buildMonthlySparkline(geoData, period.year, period.month, 8, (items) => {
      const y = items[0]?.yr ?? period.year;
      const m = items[0]?.mn ?? period.month;
      const pp = getPrevMonthPeriod(y, m);
      const prevItems = periodData(geoData, pp.fromTime, pp.toTime);
      return computePeriodMetrics(items, prevItems, filters?.invoiceType).newCustomers;
    });
    const sparkReturns = shouldShowReturnAmountKpi(reportingMode)
      ? buildMonthlySparkline(geoData, period.year, period.month, 8, (items) =>
          computePeriodMetrics(items, [], filters?.invoiceType).returnsRate
        )
      : [];
    const sparkReturnInvoices = shouldShowReturnAmountKpi(reportingMode)
      ? buildMonthlySparkline(geoData, period.year, period.month, 8, (items) =>
          computePeriodMetrics(items, [], filters?.invoiceType).grvInvoices
        )
      : [];
    const sparkAvgReturn = shouldShowReturnAmountKpi(reportingMode)
      ? buildMonthlySparkline(geoData, period.year, period.month, 8, (items) =>
          computePeriodMetrics(items, [], filters?.invoiceType).avgGrvValue
        )
      : [];
    const sparkTarget = shouldShowTargetAchievement(reportingMode)
      ? buildMonthlySparkline(geoData, period.year, period.month, 8, (items) => {
          const y = items[0]?.yr;
          const m = items[0]?.mn;
          if (!y || !m) return 0;
          const actual = getPrimaryAmount(
            computePeriodMetrics(items, [], filters?.invoiceType),
            reportingMode
          );
          const tgt = getTarget(y, m);
          return tgt > 0 ? (actual / tgt) * 100 : 0;
        })
      : [];

    const fixedNewCustomers = computePeriodMetrics(
      currentData,
      prevMonthData,
      filters?.invoiceType
    ).newCustomers;

    const buildKpiView = (
      compareData: typeof currentData,
      compareBaselineData: typeof currentData,
      compareTargetYear: number,
      compareTargetMonth: number
    ) => {
      const metrics = computePeriodMetrics(currentData, compareData, filters?.invoiceType);
      const baselineMetrics = computePeriodMetrics(compareData, compareBaselineData, filters?.invoiceType);
      const compareOnlyMetrics = computePeriodMetrics(compareData, [], filters?.invoiceType);

      const primary = getPrimaryAmount(metrics, reportingMode);
      const primaryCompare = getPrimaryAmount(compareOnlyMetrics, reportingMode);

      const tgt = getTarget(period.year, period.month);
      const compareTgt = getTarget(compareTargetYear, compareTargetMonth);
      const tgtAch =
        shouldShowTargetAchievement(reportingMode) && tgt > 0 ? (primary / tgt) * 100 : 0;
      const compareTgtAch =
        shouldShowTargetAchievement(reportingMode) && compareTgt > 0
          ? (primaryCompare / compareTgt) * 100
          : 0;

      return {
        totalSales: {
          ...kpiBlock(primary, pctChange(primary, primaryCompare), sparkPrimary),
          salesAmount: metrics.salesAmount,
          returnsAmount: metrics.grvAmount,
        },
        ...(shouldShowTargetAchievement(reportingMode)
          ? {
              targetAchievement: {
                value: tgtAch,
                targetAmount: tgt,
                actualAmount: primary,
                changePct: pctChange(tgtAch, compareTgtAch),
                sparkline: sparkTarget,
              },
            }
          : {}),
        invoices: kpiBlock(
          metrics.invoices,
          absChange(metrics.invoices, compareOnlyMetrics.invoices),
          sparkInvoices,
          false
        ),
        activeCustomers: kpiBlock(
          metrics.activeCustomers,
          absChange(metrics.activeCustomers, compareOnlyMetrics.activeCustomers),
          sparkCustomers,
          false
        ),
        avgInvoiceValue: kpiBlock(
          metrics.avgInvoiceValue,
          pctChange(metrics.avgInvoiceValue, compareOnlyMetrics.avgInvoiceValue),
          sparkAvgInv
        ),
        newCustomers: kpiBlock(
          fixedNewCustomers,
          absChange(fixedNewCustomers, baselineMetrics.newCustomers),
          sparkNewCust,
          false
        ),
        ...(shouldShowReturnAmountKpi(reportingMode)
          ? {
              returnsRate: {
                value: metrics.returnsRate,
                changePct: pctChange(metrics.returnsRate, compareOnlyMetrics.returnsRate),
                grvAmount: metrics.grvAmount,
                salesAmount: metrics.salesAmount,
                sparkline: sparkReturns,
              },
              returnInvoices: kpiBlock(
                metrics.grvInvoices,
                absChange(metrics.grvInvoices, compareOnlyMetrics.grvInvoices),
                sparkReturnInvoices,
                false
              ),
              avgReturnValue: kpiBlock(
                metrics.avgGrvValue,
                pctChange(metrics.avgGrvValue, compareOnlyMetrics.avgGrvValue),
                sparkAvgReturn
              ),
            }
          : {}),
      };
    };

    const kpiViews = {
      prevMonth: buildKpiView(prevMonthData, prevPrevData, prevPeriod.year, prevPeriod.month),
      sameMonthLastYear: buildKpiView(smlyData, smlyPrevData, smlyPeriod.year, smlyPeriod.month),
    };

    const comparePrevRowsMain = buildCustomerChangeRows(currentData, prevMonthData, 'main');
    const compareSmlyRowsMain = buildCustomerChangeRows(currentData, smlyData, 'main');
    const comparePrevRowsSub = buildCustomerChangeRows(currentData, prevMonthData, 'sub');
    const compareSmlyRowsSub = buildCustomerChangeRows(currentData, smlyData, 'sub');

    const buildCompareBlock = (
      rows: ReturnType<typeof buildCustomerChangeRows>,
      comparePeriodData: typeof prevMonthData,
      groupBy: 'main' | 'sub'
    ) => ({
      topCustomers: buildTopCustomers(
        currentData,
        rows,
        primaryCurrent,
        groupBy,
        filters?.invoiceType
      ),
      topReturnCustomers: buildTopReturnCustomers(
        currentData,
        comparePeriodData,
        currentMetrics.grvAmount,
        groupBy
      ),
      topDeclining: buildDeclining(rows).map((r, i) => ({ ...r, rank: i + 1 })),
      topGrowing: buildGrowing(rows).map((r, i) => ({ ...r, rank: i + 1 })),
      atRisk: buildAtRisk(rows),
    });

    const customerViews = {
      main: {
        prevMonth: buildCompareBlock(comparePrevRowsMain, prevMonthData, 'main'),
        sameMonthLastYear: buildCompareBlock(compareSmlyRowsMain, smlyData, 'main'),
      },
      sub: {
        prevMonth: buildCompareBlock(comparePrevRowsSub, prevMonthData, 'sub'),
        sameMonthLastYear: buildCompareBlock(compareSmlyRowsSub, smlyData, 'sub'),
      },
    };

    let repDisplayName = await fetchUserName(userId);
    if (filters?.salesRep) repDisplayName = filters.salesRep;
    else if (filters?.merchandiser) repDisplayName = filters.merchandiser;
    else if (isManager) repDisplayName = 'All Sales Reps';

    return NextResponse.json({
      repDisplayName,
      periodLabel: period.label,
      reportingMode,
      reportingModeLabel: REPORTING_MODE_LABELS[reportingMode],
      primaryAmountLabel: PRIMARY_AMOUNT_LABELS[reportingMode],
      compareModes: {
        prevMonth: { label: prevPeriod.label },
        sameMonthLastYear: { label: smlyPeriod.label },
      },
      kpis: kpiViews.prevMonth,
      kpiViews,
      monthlyComparison,
      dailySalesCalendars,
      customerViews,
      topProducts: buildTopProducts(currentData, primaryCurrent),
      topCategories: buildTopCategories(currentData, primaryCurrent),
      topSalesInvoices: buildTopInvoicesByValue(currentData, 'sales'),
      topReturnInvoices: buildTopInvoicesByValue(currentData, 'returns'),
    });
  } catch (error: unknown) {
    console.error('API Error Reports:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to fetch reports data', details: message }, { status: 500 });
  }
}
