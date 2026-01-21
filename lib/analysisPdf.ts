import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { InvoiceRow } from '@/types';
import { getInvoiceType } from './invoiceType';

interface FilterContext {
    startDate?: Date;
    endDate?: Date;
    salesRep?: string;
    searchQuery?: string;
}

interface PeriodMetric {
    label: string;
    start: Date;
    end: Date;
    current: number;
    previous: number;
    lastYear: number;
}

const parseDate = (dateStr: string | undefined): Date | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    return null;
};

const getDiffMonths = (d1: Date, d2: Date) => {
    return (d1.getFullYear() - d2.getFullYear()) * 12 + (d1.getMonth() - d2.getMonth());
};

// --- CHART UTILS ---
const drawBarChart = (doc: jsPDF, x: number, y: number, w: number, h: number, data: PeriodMetric[], title: string) => {
    if (data.length === 0) return;

    // Chart Container Background
    doc.setFillColor(250, 250, 252); // Very light blue/gray
    doc.roundedRect(x, y, w, h + 15, 3, 3, 'F');

    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.setFont('helvetica', 'bold');
    doc.text(title, x + 10, y + 10);

    const chartTop = y + 25;
    const chartBottom = y + h;
    const chartLeft = x + 20; // Y-axis spacing
    const chartRight = x + w - 10;
    const chartWidth = chartRight - chartLeft;
    const chartHeight = chartBottom - chartTop;

    // Find max value for Y-scale
    let maxVal = 0;
    data.forEach(d => maxVal = Math.max(maxVal, d.current, d.previous, d.lastYear));
    maxVal = maxVal * 1.15; // 15% headroom

    // Draw Grid & Axes
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.setLineWidth(0.1);

    // Y-axis lines (5 steps)
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.setFont('helvetica', 'normal');

    for (let i = 0; i <= 5; i++) {
        const val = (maxVal / 5) * i;
        const yPos = chartBottom - ((val / maxVal) * chartHeight);

        // Grid line
        doc.line(chartLeft, yPos, chartRight, yPos);

        // Label
        doc.text(new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(val), x + 5, yPos + 2.5);
    }

    // Draw Bars
    const itemWidth = chartWidth / data.length;
    const barGroupWidth = itemWidth * 0.7; // 70% of space for bars
    const barWidth = barGroupWidth / 3; // 3 bars per group: Curr, Prev, LastYear
    const spacing = (itemWidth - barGroupWidth) / 2;

    data.forEach((d, i) => {
        const xBase = chartLeft + (itemWidth * i) + spacing;

        // Helper to draw single bar
        const drawBar = (val: number, offsetX: number, color: [number, number, number]) => {
            const barH = (val / maxVal) * chartHeight;
            if (barH > 0) {
                doc.setFillColor(...color);
                // rounded top corners manually? doc.roundedRect rounds all. 
                // Let's us roundedRect with small radius.
                doc.roundedRect(xBase + offsetX, chartBottom - barH, barWidth, barH, 1, 1, 'F');
            }
        };

        drawBar(d.current, 0, [59, 130, 246]); // Blue 500 (Current)
        drawBar(d.previous, barWidth + 1, [148, 163, 184]); // Slate 400 (Prev)
        drawBar(d.lastYear, (barWidth * 2) + 2, [16, 185, 129]); // Emerald 500 (LY)

        // X-axis Label
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105); // Slate 600
        const lines = doc.splitTextToSize(d.label, itemWidth);
        doc.text(lines, xBase + (barGroupWidth / 2), chartBottom + 10, { align: 'center', maxWidth: itemWidth });
    });

    // Legend (Top Right inside box)
    const legendY = y + 10;
    const legendX = x + w - 80;

    doc.setFontSize(9);

    doc.setFillColor(59, 130, 246); doc.circle(legendX, legendY - 1, 2, 'F');
    doc.text('Current', legendX + 4, legendY);

    doc.setFillColor(148, 163, 184); doc.circle(legendX + 25, legendY - 1, 2, 'F');
    doc.text('Prev', legendX + 29, legendY);

    doc.setFillColor(16, 185, 129); doc.circle(legendX + 45, legendY - 1, 2, 'F');
    doc.text('Last Year', legendX + 49, legendY);
};


const getBHSWeek = (date: Date) => {
    const year = date.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const days = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    const week = Math.floor(days / 7) + 1;
    return { week, year };
};

const getWeekDateRange = (year: number, week: number) => {
    const startOfYear = new Date(year, 0, 1); // Jan 1
    const start = new Date(startOfYear);
    start.setDate(startOfYear.getDate() + (week - 1) * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
};


const formatDate = (date: Date | null): string => {
    if (!date) return '';
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
};


export const generatePaymentAnalysisPDF = (allData: InvoiceRow[], filters: FilterContext) => {
    const doc = new jsPDF();
    const today = new Date();

    // 1. Base Filter (Strictly align with PaymentTrackerTab logic + R-Payment fix)
    const baseData = allData.filter(inv => {
        const t = getInvoiceType(inv);
        // User Logic: Include R-Payment (Returns) to reduce total collections
        if (t !== 'Payment' && t !== 'R-Payment') return false;

        // Filters
        if (filters.salesRep && filters.salesRep !== 'All Sales Reps' && inv.salesRep?.trim() !== filters.salesRep) return false;
        if (filters.searchQuery && !inv.customerName.toLowerCase().includes(filters.searchQuery.toLowerCase())) return false;

        return true;
    });

    // 2. Determine Date Range
    let startDate = filters.startDate;
    let endDate = filters.endDate;

    if (!startDate || !endDate) {
        let min = new Date(8640000000000000); // max date
        let max = new Date(0);
        let hasData = false;
        baseData.forEach(p => {
            const d = parseDate(p.date);
            if (d) {
                if (d < min) min = d;
                if (d > max) max = d;
                hasData = true;
            }
        });

        if (!hasData) {
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);
        } else {
            // Default to discovered range if no filter
            if (!startDate) startDate = min;
            if (!endDate) endDate = max;
        }
    }
    // Ensure boundaries
    if (startDate) startDate.setHours(0, 0, 0, 0);
    if (endDate) endDate.setHours(23, 59, 59, 999);

    // Helper to sum range
    const sumRange = (start: Date, end: Date) => {
        // Ensure strictly within standard days
        const s = new Date(start); s.setHours(0, 0, 0, 0);
        const e = new Date(end); e.setHours(23, 59, 59, 999);

        return baseData.reduce((sum, p) => {
            const d = parseDate(p.date);
            if (d && d >= s && d <= e) {
                return sum + ((p.credit || 0) - (p.debit || 0));
            }
            return sum;
        }, 0);
    };

    // --- DAILY CALCULATOR ---
    const days: PeriodMetric[] = [];
    const dIter = new Date(startDate!.getTime());
    const dEnd = new Date(endDate!.getTime());

    let daySafety = 0;
    while (dIter <= dEnd && daySafety < 5000) {
        const dayStart = new Date(dIter); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dIter); dayEnd.setHours(23, 59, 59, 999);

        // Compare vs Same Day Previous Month
        const prevDayStart = new Date(dayStart); prevDayStart.setMonth(prevDayStart.getMonth() - 1);
        const prevDayEnd = new Date(dayEnd); prevDayEnd.setMonth(prevDayEnd.getMonth() - 1);

        const lyDayStart = new Date(dayStart); lyDayStart.setFullYear(lyDayStart.getFullYear() - 1);
        const lyDayEnd = new Date(dayEnd); lyDayEnd.setFullYear(lyDayEnd.getFullYear() - 1);

        days.push({
            label: formatDate(dayStart),
            start: dayStart,
            end: dayEnd,
            current: sumRange(dayStart, dayEnd),
            previous: sumRange(prevDayStart, prevDayEnd),
            lastYear: sumRange(lyDayStart, lyDayEnd)
        });

        dIter.setDate(dIter.getDate() + 1);
        daySafety++;
    }

    // --- WEEKLY CALCULATOR (Aligned to BHS fixed buckets) ---
    const weeks: PeriodMetric[] = [];

    // Determine Start Week and End Week based on date range
    const startWeekInfo = getBHSWeek(startDate!);
    const endWeekInfo = getBHSWeek(endDate!);

    // Create a sequential week iterator
    // Handle year crossing? "BHS Week" resets every year (Week 1 is always Jan 1). 
    // This creates non-contiguous weeks at year end (Dec 31 might be Week 53, Jan 1 is Week 1).
    // We will iterate mainly by year + week number.

    let iterYear = startWeekInfo.year;
    let iterWeek = startWeekInfo.week;

    // Avoid infinite loops, limit to reasonable number of weeks (e.g. 100)
    let safety = 0;
    while (safety < 200) {
        const { start: wStart, end: wEnd } = getWeekDateRange(iterYear, iterWeek);

        // Break if we are completely past the endDate
        if (wStart > endDate!) break;

        // Include this week if it overlaps or is contained
        if (wEnd >= startDate! && wStart <= endDate!) {

            // Previous Week (simply week - 1, handle week 1 -> prev year week 52/53?)
            // BHS Logic simplistically implies comparison to "Previous Sequential Block of 7 Days" OR "Same Week Index Previous"?
            // User: "differences from last week".
            // Since this is a custom week system, "Previous Week" should actually be the *previous 7 days*.
            const prevStart = new Date(wStart); prevStart.setDate(prevStart.getDate() - 7);
            const prevEnd = new Date(wEnd); prevEnd.setDate(prevEnd.getDate() - 7);

            // Last Year: Same Week Index in Year-1
            const { start: lyStart, end: lyEnd } = getWeekDateRange(iterYear - 1, iterWeek);

            weeks.push({
                label: `Week ${iterWeek} / ${iterYear}`,
                start: wStart,
                end: wEnd,
                current: sumRange(wStart, wEnd),
                previous: sumRange(prevStart, prevEnd),
                lastYear: sumRange(lyStart, lyEnd)
            });
        }

        // Next Week
        iterWeek++;
        // Check if we rolled over year (approx > 52)
        // Check if next week start is in next year
        const nextWStart = getWeekDateRange(iterYear, iterWeek).start;
        if (nextWStart.getFullYear() > iterYear) {
            iterYear++;
            iterWeek = 1;
        }
        safety++;
    }

    // --- MONTHLY CALCULATOR ---
    const months: PeriodMetric[] = [];
    // Standard Month iteration
    const mIter = new Date(startDate!.getFullYear(), startDate!.getMonth(), 1);
    const mEndLimit = new Date(endDate!.getFullYear(), endDate!.getMonth() + 1, 0);

    while (mIter < mEndLimit) { // Iterate until strictly after
        const monthStart = new Date(mIter.getFullYear(), mIter.getMonth(), 1);
        const monthEnd = new Date(mIter.getFullYear(), mIter.getMonth() + 1, 0);

        // Only add if it overlaps the user's filtered range
        if (monthEnd >= startDate! && monthStart <= endDate!) {

            const prevYear = monthStart.getFullYear() - 1;
            const prevMonthStart = new Date(monthStart); prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
            const prevMonthEnd = new Date(monthStart); prevMonthEnd.setDate(0);

            const lyMonthStart = new Date(prevYear, monthStart.getMonth(), 1);
            const lyMonthEnd = new Date(prevYear, monthStart.getMonth() + 1, 0);

            months.push({
                label: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                start: monthStart,
                end: monthEnd,
                current: sumRange(monthStart, monthEnd),
                previous: sumRange(prevMonthStart, prevMonthEnd),
                lastYear: sumRange(lyMonthStart, lyMonthEnd)
            });
        }
        mIter.setMonth(mIter.getMonth() + 1);
    }

    // --- FILTERING (If User Search is Active) ---
    // If searching for a customer (or anything), hide days/weeks/months with zero value
    if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
        // Filter in place? No, just re-assign.
        // We really want to show moments where the customer paid.
        // Usually filtering by customer means baseData is filtered.
        // If we sum 0 for a day, it means that customer didn't pay that day.
        // User wants to see only rows/bars with payments.

        // Note: Filter based on 'current' value being non-zero
        // We might also check 'previous' or 'lastYear' if we want to show comparison?
        // User request: "appear rows that have payments only". Implies current > 0.
        // Let's be safe and show if ANY value > 0? No, usually "payments only" means active.
        // But let's stick to current > 0 to be precise.

        const hasValue = (m: PeriodMetric) => m.current !== 0;

        let i = days.length;
        while (i--) {
            if (!hasValue(days[i])) days.splice(i, 1);
        }

        i = weeks.length;
        while (i--) {
            if (!hasValue(weeks[i])) weeks.splice(i, 1);
        }

        i = months.length;
        while (i--) {
            if (!hasValue(months[i])) months.splice(i, 1);
        }
    }


    // --- METRICS CALCULATION (Current vs Previous Period) ---
    const durationMs = endDate!.getTime() - startDate.getTime();
    const prevEndDate = new Date(startDate.getTime() - 86400000); // 1 day before start
    const prevStartDate = new Date(prevEndDate.getTime() - durationMs);

    // Helper for specific range sums
    const getMetrics = (s: Date, e: Date) => {
        let total = 0;
        let count = 0;
        const customers = new Set<string>();

        // Ensure boundaries
        const sTime = s.setHours(0, 0, 0, 0);
        const eTime = e.setHours(23, 59, 59, 999);

        baseData.forEach(p => {
            const d = parseDate(p.date);
            if (d && d.getTime() >= sTime && d.getTime() <= eTime) {
                const val = (p.credit || 0) - (p.debit || 0);
                total += val;
                count++;
                customers.add(p.customerName);
            }
        });

        return { total, count, uniqueCustomers: customers.size };
    };

    const curMet = getMetrics(startDate, endDate!);
    const prevMet = getMetrics(prevStartDate, prevEndDate);

    const lyStartDate = new Date(startDate); lyStartDate.setFullYear(lyStartDate.getFullYear() - 1);
    const lyEndDate = new Date(endDate!); lyEndDate.setFullYear(lyEndDate.getFullYear() - 1);
    const lyMet = getMetrics(lyStartDate, lyEndDate);

    const revenueTrend = prevMet.total > 0 ? ((curMet.total - prevMet.total) / prevMet.total) * 100 : 0;
    const countTrend = prevMet.count > 0 ? ((curMet.count - prevMet.count) / prevMet.count) * 100 : 0;
    const custTrend = prevMet.uniqueCustomers > 0 ? ((curMet.uniqueCustomers - prevMet.uniqueCustomers) / prevMet.uniqueCustomers) * 100 : 0;

    const curAvg = curMet.count > 0 ? curMet.total / curMet.count : 0;
    const prevAvg = prevMet.count > 0 ? prevMet.total / prevMet.count : 0;
    const avgTrend = prevAvg > 0 ? ((curAvg - prevAvg) / prevAvg) * 100 : 0;

    // Last Year Trends
    const revenueTrendLY = lyMet.total > 0 ? ((curMet.total - lyMet.total) / lyMet.total) * 100 : 0;
    const countTrendLY = lyMet.count > 0 ? ((curMet.count - lyMet.count) / lyMet.count) * 100 : 0;
    const custTrendLY = lyMet.uniqueCustomers > 0 ? ((curMet.uniqueCustomers - lyMet.uniqueCustomers) / lyMet.uniqueCustomers) * 100 : 0;


    // ================= PDF RENDERING =================

    // --- DATA PREP: DAILY & TOP CUSTOMERS ---

    // Daily Data for Chart
    const dailyMap = new Map<string, number>();
    const startMs = startDate!.getTime();
    const endMs = endDate!.getTime();
    const oneDay = 86400000;

    for (let t = startMs; t <= endMs; t += oneDay) {
        const dStr = formatDate(new Date(t));
        dailyMap.set(dStr, 0);
    }

    // Customer Data for Ranking
    const custMap = new Map<string, number>();

    baseData.forEach(p => {
        const d = parseDate(p.date);
        if (d && d.getTime() >= startMs && d.getTime() <= endMs) {
            const val = (p.credit || 0) - (p.debit || 0);

            // Daily
            const dStr = formatDate(d);
            if (dailyMap.has(dStr)) dailyMap.set(dStr, (dailyMap.get(dStr) || 0) + val);

            // Cust
            custMap.set(p.customerName, (custMap.get(p.customerName) || 0) + val);
        }
    });

    const dailyData = Array.from(dailyMap.entries()).map(([label, val]) => ({ label, value: val }));
    const topCustomers = Array.from(custMap.entries())
        .map(([label, val]) => ({ label, value: val }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);


    // --- MODERN UI HELPERS ---

    const drawModernCard = (
        x: number,
        y: number,
        w: number,
        h: number,
        title: string,
        value: string,
        trendInfo: { prev: number, ly: number } | null,
        accentColor: [number, number, number]
    ) => {
        // Shadow effect (subtle)
        doc.setFillColor(241, 245, 249); // Slate 100
        doc.roundedRect(x + 1, y + 1, w, h, 2, 2, 'F');

        // Main Card
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240); // Slate 200
        doc.setLineWidth(0.1);
        doc.roundedRect(x, y, w, h, 2, 2, 'FD');

        // Accent Bar
        doc.setFillColor(...accentColor);
        doc.rect(x, y + 5, 1.5, 12, 'F'); // Left accent mark

        // Title
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139); // Slate 500
        doc.setFont('helvetica', 'normal');
        doc.text(title, x + 8, y + 10);

        // Value
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42); // Slate 900
        doc.setFont('helvetica', 'bold');
        doc.text(value, x + 8, y + 20);

        if (trendInfo) {
            // Draw Line separator
            doc.setDrawColor(226, 232, 240); // Slate 200
            doc.setLineWidth(0.1);
            doc.line(x + 5, y + 23, x + w - 5, y + 23);

            // --- LEFT: PREV ---
            doc.setFontSize(8); // Increased from 7
            doc.setTextColor(100, 116, 139); // Slate 500 (Darker for clarity)
            doc.setFont('helvetica', 'normal');
            doc.text('Vs Prev', x + 5, y + 27); // Moved left slightly

            const prevText = `${trendInfo.prev > 0 ? '+' : ''}${trendInfo.prev.toFixed(1)}%`;
            if (trendInfo.prev > 0) doc.setTextColor(22, 163, 74);
            else if (trendInfo.prev < 0) doc.setTextColor(220, 38, 38);
            else doc.setTextColor(148, 163, 184);

            doc.setFontSize(10); // Increased from default/implicit small
            doc.setFont('helvetica', 'bold');
            doc.text(prevText, x + 5, y + 32);

            // --- RIGHT: LAST YEAR ---
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8); // Increased from 7
            doc.setTextColor(100, 116, 139); // Slate 500
            // Position roughly at 55% of width
            const rightX = x + (w * 0.55);
            doc.text('Vs Last Year', rightX, y + 27);

            const lyText = `${trendInfo.ly > 0 ? '+' : ''}${trendInfo.ly.toFixed(1)}%`;
            if (trendInfo.ly > 0) doc.setTextColor(22, 163, 74);
            else if (trendInfo.ly < 0) doc.setTextColor(220, 38, 38);
            else doc.setTextColor(148, 163, 184);

            doc.setFontSize(10); // Increased
            doc.setFont('helvetica', 'bold');
            doc.text(lyText, rightX, y + 32);
        }
    };

    const drawHorizontalBarChart = (x: number, y: number, w: number, h: number, data: { label: string, value: number }[], title: string) => {
        // Container
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, y, w, h, 2, 2, 'FD');

        // Title
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.text(title, x + 5, y + 8);

        const maxVal = Math.max(...data.map(d => d.value), 1);
        let curY = y + 15;
        const barHeight = 8;
        const gap = 6;

        data.forEach((d, i) => {
            if (curY + barHeight > y + h) return;

            // Label (truncate)
            doc.setFontSize(8);
            doc.setTextColor(71, 85, 105);
            doc.setFont('helvetica', 'normal');
            const safeLabel = d.label.length > 15 ? d.label.substring(0, 14) + '..' : d.label;
            doc.text(safeLabel, x + 5, curY + 5);

            // Bar
            const barMaxW = w - 60;
            const barW = (d.value / maxVal) * barMaxW;
            const barX = x + 35; // Space for label

            doc.setFillColor(59, 130, 246); // Blue
            doc.roundedRect(barX, curY, barW, barHeight, 1, 1, 'F');

            // Value
            doc.setTextColor(100, 116, 139);
            doc.text(`${d.value.toLocaleString(undefined, { notation: 'compact' })}`, barX + barW + 2, curY + 5);

            curY += barHeight + gap;
        });
    };

    // Simple Line/Area Chart for Daily Trend
    const drawDailyAreaChart = (x: number, y: number, w: number, h: number, data: { label: string, value: number }[], title: string) => {
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, y, w, h, 2, 2, 'FD');

        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.text(title, x + 5, y + 8);

        if (data.length < 2) return;

        const chartX = x + 10;
        const chartY = y + 15;
        const chartW = w - 15;
        const chartH = h - 25; // Space for x-labels
        const chartBottom = chartY + chartH;

        const maxVal = Math.max(...data.map(d => d.value), 1);

        // Draw Area
        const stepX = chartW / (data.length - 1);

        doc.setDrawColor(59, 130, 246);
        doc.setLineWidth(0.3);
        doc.setFillColor(219, 234, 254); // Light Blue Fill

        const points: [number, number][] = [];
        data.forEach((d, i) => {
            const px = chartX + (i * stepX);
            const py = chartBottom - ((d.value / maxVal) * chartH);
            points.push([px, py]);
        });

        // Fill path
        doc.lines(points.map((p, i) => {
            if (i === 0) return [0, 0]; // Start implicit? No, lines needs segment vectors. 
            // Better to purely iterate and draw lines for JSpdf
            return [p[0] - points[i - 1][0], p[1] - points[i - 1][1]];
        }), points[0][0], points[0][1], [1, 1]); // Scale 1,1
        // Note: `lines` in jspdf is tricky for filling polygons properly without closePath. 
        // Let's stick to simple Line visualization.

        points.forEach((p, i) => {
            if (i === 0) return;
            const prev = points[i - 1];
            doc.line(prev[0], prev[1], p[0], p[1]);
        });

        // X-Axis Labels (Show only 5 or so)
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        const skip = Math.ceil(data.length / 5);
        data.forEach((d, i) => {
            if (i % skip === 0 || i === data.length - 1) {
                const px = chartX + (i * stepX);
                doc.text(d.label.split('/')[0] + '/' + d.label.split('/')[1], px, chartBottom + 5, { align: 'center' });
            }
        });
    };

    // Header
    // doc.addImage('https://i.ibb.co/6r65S9g/logo.png', 'PNG', 15, 15, 20, 20); // Placeholder
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59);
    doc.text('Collections Analysis Report', 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Period: ${formatDate(startDate!)} - ${formatDate(endDate!)}`, 105, 27, { align: 'center' });
    if (filters.salesRep) doc.text(`Sales Rep: ${filters.salesRep}`, 105, 32, { align: 'center' });


    // --- EXECUTIVE SUMMARY PAGE ---
    let y = 40;

    const cardW = 58;
    const cardH = 35; // Slightly shorter to fit 3 rows
    const gap = 6;
    const rowGap = 50; // Space between rows (includes title)

    // Helper to draw a full row of metrics
    const drawMetricsRow = (
        rowY: number,
        title: string,
        metrics: { total: number, count: number, uniqueCustomers: number },
        trends: {
            rev?: number, count?: number, cust?: number,
            revLY?: number, countLY?: number, custLY?: number
        } | null,
        periodType: 'Current' | 'Previous' | 'LastYear'
    ) => {
        // Row Title
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.text(title, 14, rowY - 5);

        // 1. Collections (Blue)
        let revTrend = null;
        if (periodType === 'Current' && trends && trends.rev !== undefined && trends.revLY !== undefined) {
            revTrend = { prev: trends.rev, ly: trends.revLY };
        }

        drawModernCard(
            14, rowY, cardW, cardH,
            'Total Collections',
            `${metrics.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
            revTrend,
            [59, 130, 246]
        );

        // 2. Customers (Green)
        let custTrend = null;
        if (periodType === 'Current' && trends && trends.cust !== undefined && trends.custLY !== undefined) {
            custTrend = { prev: trends.cust, ly: trends.custLY };
        }

        drawModernCard(
            14 + cardW + gap, rowY, cardW, cardH,
            'Active Customers',
            `${metrics.uniqueCustomers}`,
            custTrend,
            [16, 185, 129]
        );

        // 3. Transactions (Orange)
        let payTrend = null;
        if (periodType === 'Current' && trends && trends.count !== undefined && trends.countLY !== undefined) {
            payTrend = { prev: trends.count, ly: trends.countLY };
        }

        drawModernCard(
            14 + (cardW + gap) * 2, rowY, cardW, cardH,
            'Payment Count',
            `${metrics.count}`,
            payTrend,
            [249, 115, 22]
        );
    };

    // Row 1: Current
    drawMetricsRow(
        y,
        `Current Period (${formatDate(startDate!)} - ${formatDate(endDate!)})`,
        curMet,
        {
            rev: revenueTrend, cust: custTrend, count: countTrend,
            revLY: revenueTrendLY, custLY: custTrendLY, countLY: countTrendLY
        },
        'Current'
    );

    // Row 2: Previous
    y += rowGap;
    drawMetricsRow(
        y,
        `Previous Period (${formatDate(prevStartDate)} - ${formatDate(prevEndDate)})`,
        prevMet,
        null,
        'Previous'
    );

    // Row 3: Last Year
    y += rowGap;
    drawMetricsRow(
        y,
        `Same Period Last Year (${formatDate(lyStartDate)} - ${formatDate(lyEndDate)})`,
        lyMet,
        null,
        'LastYear'
    );



    // Add page break before Daily Analysis
    doc.addPage();
    y = 20;

    // --- DAILY ANALYSIS PAGE ---
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text('Daily Breakdown', 105, y, { align: 'center' });
    y += 8;

    if (days.length > 0) {
        // Chart removed

        // 2. Table
        const tableData = days.map(d => {
            const diffPrev = d.previous > 0 ? ((d.current - d.previous) / d.previous) * 100 : 0;
            const diffLy = d.lastYear > 0 ? ((d.current - d.lastYear) / d.lastYear) * 100 : 0;

            return [
                d.label,
                `${d.current.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                `${d.previous.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                `${diffPrev >= 0 ? '+' : ''}${diffPrev.toFixed(1)}%`,
                `${d.lastYear.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                `${diffLy >= 0 ? '+' : ''}${diffLy.toFixed(1)}%`
            ];
        });

        autoTable(doc, {
            startY: y,
            margin: { left: 22 },
            head: [['Date', 'Current', 'Same Date Previous Month', 'MoM %', 'Last Year', 'YoY %']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246], halign: 'center', valign: 'middle' },
            bodyStyles: { halign: 'center', valign: 'middle' },
            columnStyles: {
                0: { halign: 'center', cellWidth: 25 },
                1: { halign: 'center', cellWidth: 30 },
                2: { halign: 'center', cellWidth: 30 },
                3: { halign: 'center', cellWidth: 25 },
                4: { halign: 'center', cellWidth: 30 },
                5: { halign: 'center', cellWidth: 25 }
            },
            didParseCell: (data) => {
                if (data.section === 'body') {
                    // Check for Sunday Highlight
                    const dateStr = String((data.row.raw as any)[0]);
                    const parts = dateStr.split('/');
                    if (parts.length === 3) {
                        const dt = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                        if (dt.getDay() === 0) {
                            data.cell.styles.fillColor = [255, 237, 213]; // Orange 100
                        }
                    }

                    // Existing Color Logic for Trends
                    if (data.column.index === 3 || data.column.index === 5) {
                        const txt = String(data.cell.raw);
                        if (txt.includes('+')) data.cell.styles.textColor = [22, 163, 74];
                        else if (txt.includes('-')) data.cell.styles.textColor = [220, 38, 38];
                        else data.cell.styles.textColor = [100, 116, 139];
                    }
                }
            }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFillColor(255, 237, 213); // Orange 100
        doc.rect(14, finalY, 4, 4, 'F');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139); // Slate 500
        doc.text('Orange highlighted rows indicate Sundays', 20, finalY + 3);
    }

    // Add page break before Weekly Analysis
    doc.addPage();
    y = 20;

    // --- WEEKLY ANALYSIS PAGE ---
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text('Weekly Breakdown', 105, y, { align: 'center' });
    y += 8;

    if (weeks.length > 0) {
        // 1. Chart
        // Show latest 8 weeks if period is long
        const weeksForChart = weeks.length > 8 ? weeks.slice(-8) : weeks;
        const chartTitleW = weeks.length > 8 ? 'Collections Trend (Last 8 Weeks)' : 'Collections Trend (Weekly)';

        // Clone and format labels for Chart (Year under Week)
        const chartWeeks = weeksForChart.map(w => ({
            ...w,
            label: w.label.replace(' / ', '\n')
        }));
        drawBarChart(doc, 15, y, 180, 80, chartWeeks, chartTitleW);
        y += 110; // Increased spacing to avoid overlap with x-axis labels

        // 2. Table
        const tableData = weeks.map(w => {
            const diffPrev = w.previous > 0 ? ((w.current - w.previous) / w.previous) * 100 : 0;
            const diffLy = w.lastYear > 0 ? ((w.current - w.lastYear) / w.lastYear) * 100 : 0;

            return [
                `${w.label}\n(${formatDate(w.start)} - ${formatDate(w.end)})`,
                `${w.current.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                `${w.previous.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                `${diffPrev >= 0 ? '+' : ''}${diffPrev.toFixed(1)}%`,
                `${w.lastYear.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                `${diffLy >= 0 ? '+' : ''}${diffLy.toFixed(1)}%`
            ];
        });

        autoTable(doc, {
            startY: y,
            head: [['Week', 'Current', 'Previous', 'WoW %', 'Last Year', 'YoY %']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246], halign: 'center', valign: 'middle' },
            bodyStyles: { halign: 'center', valign: 'middle' },
            columnStyles: {
                0: { halign: 'center', cellWidth: 30 },
                1: { halign: 'center', cellWidth: 30 },
                2: { halign: 'center', cellWidth: 30 },
                3: { halign: 'center', cellWidth: 30 },
                4: { halign: 'center', cellWidth: 30 },
                5: { halign: 'center', cellWidth: 30 }
            },
            didParseCell: (data) => {
                if (data.section === 'body' && (data.column.index === 3 || data.column.index === 5)) {
                    const txt = String(data.cell.raw);
                    if (txt.includes('+')) data.cell.styles.textColor = [22, 163, 74];
                    else if (txt.includes('-')) data.cell.styles.textColor = [220, 38, 38];
                    else data.cell.styles.textColor = [100, 116, 139];
                }
            }
        });
    }

    // --- MONTHLY ANALYSIS PAGE ---
    if (months.length > 0) {
        doc.addPage();
        doc.setFontSize(16);
        doc.setTextColor(30, 41, 59);
        doc.text('Monthly Analysis', 105, 20, { align: 'center' });

        // 1. Chart
        // Show latest 8 months if period is long
        const monthsForChart = months.length > 8 ? months.slice(-8) : months;
        const chartTitleM = months.length > 8 ? 'Collections Trend (Last 8 Months)' : 'Collections Trend (Monthly)';

        drawBarChart(doc, 15, 28, 180, 80, monthsForChart, chartTitleM);

        // 2. Table
        const tableDataM = months.map(m => {
            const diffPrev = m.previous > 0 ? ((m.current - m.previous) / m.previous) * 100 : 0;
            const diffLy = m.lastYear > 0 ? ((m.current - m.lastYear) / m.lastYear) * 100 : 0;

            return [
                m.label,
                `${m.current.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                `${m.previous.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                `${diffPrev >= 0 ? '+' : ''}${diffPrev.toFixed(1)}%`,
                `${m.lastYear.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                `${diffLy >= 0 ? '+' : ''}${diffLy.toFixed(1)}%`
            ];
        });

        autoTable(doc, {
            startY: 140, // Increased spacing for Monthly table (Chart at 30 + 80 + 30 buffer)
            head: [['Month', 'Current', 'Previous', 'MoM %', 'Last Year', 'YoY %']],
            body: tableDataM,
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246], halign: 'center', valign: 'middle' },
            bodyStyles: { halign: 'center', valign: 'middle' },
            columnStyles: {
                0: { halign: 'center' }
            },
            didParseCell: (data) => {
                if (data.section === 'body' && (data.column.index === 3 || data.column.index === 5)) {
                    const txt = String(data.cell.raw);
                    if (txt.includes('+')) data.cell.styles.textColor = [22, 163, 74];
                    else if (txt.includes('-')) data.cell.styles.textColor = [220, 38, 38];
                    else data.cell.styles.textColor = [100, 116, 139];
                }
            }
        });
    }

    // --- ALL CUSTOMERS PAGE ---
    // If user filtered by date, show list of customers who paid IN THAT DATE RANGE
    doc.addPage('a4', 'landscape');
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    const pageW = doc.internal.pageSize.width;
    doc.text('Customer Payment List', pageW / 2, 20, { align: 'center' });

    // Removed specific period text as requested

    // Build Matching Map for Invoice Lookups (for Active Months)
    const matchingMapC = new Map<string, { date: Date, type: string }>();
    allData.forEach(row => {
        if (row.matching && (row.debit || 0) > 0) {
            const d = parseDate(row.date);
            const t = getInvoiceType(row);
            if (d) {
                const current = matchingMapC.get(row.matching);
                if (!current || d < current.date) {
                    matchingMapC.set(row.matching, { date: d, type: t });
                }
            }
        }
    });

    const historyMap = new Map<string, number[]>();
    baseData.forEach(p => {
        const d = parseDate(p.date);
        if (d) {
            const list = historyMap.get(p.customerName) || [];
            list.push(d.getTime());
            historyMap.set(p.customerName, list);
        }
    });
    // Sort histories descending
    historyMap.forEach(list => list.sort((a, b) => b - a));

    const customerMap = new Map<string, { total: number, count: number, dates: number[], months: Set<string> }>();

    // Only process filtered range for this list
    baseData.forEach(p => {
        const d = parseDate(p.date);
        if (d && d >= startDate! && d <= endDate!) {
            const val = (p.credit || 0) - (p.debit || 0);
            const curr = customerMap.get(p.customerName) || { total: 0, count: 0, dates: [], months: new Set() };

            curr.total += val;
            curr.count += 1;
            curr.dates.push(d.getTime());

            // Resolve Matching Month
            let mKey = '9_Unmatched';
            if (p.matching && p.matching !== 'Unmatched') {
                // Check OB direct
                if (p.matching.startsWith('OB')) {
                    mKey = '0_OB';
                } else {
                    const matchInfo = matchingMapC.get(p.matching);
                    if (matchInfo) {
                        if (matchInfo.type === 'OB') {
                            mKey = '0_OB';
                        } else {
                            // Format YYYY-MM
                            const y = matchInfo.date.getFullYear();
                            const m = matchInfo.date.getMonth() + 1;
                            mKey = `1_${y}-${String(m).padStart(2, '0')}`;
                        }
                    }
                }
            }
            curr.months.add(mKey);

            customerMap.set(p.customerName, curr);
        }
    });

    const custRows = Array.from(customerMap.entries())
        .filter(([_, stats]) => stats.total > 0.01) // Show only positive contributors
        .sort((a, b) => b[1].total - a[1].total)
        .map(([name, s], i) => {
            const sortedKeys = Array.from(s.months).sort();
            const monthStr = sortedKeys.map(k => {
                if (k === '0_OB') return 'OB';
                if (k === '9_Unmatched') return 'Unmatched';
                // 1_YYYY-MM
                const parts = k.split('_')[1].split('-');
                const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
                return date.toLocaleString('en-US', { month: 'short', year: '2-digit' });
            }).join(', ');

            // Calculate Gap (Using Full History)
            let gapStr = 'No Payment Before';
            const sortedPeriodDates = s.dates.sort((a, b) => b - a);
            const latestMs = sortedPeriodDates[0];

            const allHistory = historyMap.get(name);
            if (allHistory) {
                // Find first date strictly less than latestMs
                const prevMs = allHistory.find(t => t < latestMs);
                if (prevMs) {
                    const diffMs = latestMs - prevMs;
                    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                    gapStr = `${diffDays} Days`;
                }
            }

            const uniqueDates = Array.from(new Set(sortedPeriodDates.map(ms => formatDate(new Date(ms)))));
            const paymentDatesStr = uniqueDates.join(', ');

            return [
                i + 1,
                name,
                paymentDatesStr,
                gapStr,
                `${s.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                s.count,
                monthStr
            ];
        });

    autoTable(doc, {
        startY: 28,
        head: [['#', 'Customer Name', 'Payment Dates', 'Gap', 'Total Paid', 'Count', 'Matching Months']],
        body: custRows,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], halign: 'center', valign: 'middle' },
        bodyStyles: { halign: 'center', valign: 'middle' },
        margin: { left: 8, right: 8 },
        columnStyles: {
            1: { halign: 'center', cellWidth: 70 } // Customer Name fixed width
        }
    });

    // --- COLLECTION QUALITY ANALYSIS (Debt Age) ---
    doc.addPage('a4', 'portrait');
    y = 20;

    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text('Collection Quality Analysis (Debt Age)', 105, y, { align: 'center' });

    // 1. Build Matching Map (Invoice Date & Type) from FULL DATA
    const matchingMap = new Map<string, { date: Date, type: string }>();
    allData.forEach(row => {
        if (row.matching && (row.debit || 0) > 0) {
            const d = parseDate(row.date);
            const t = getInvoiceType(row);
            if (d) {
                const current = matchingMap.get(row.matching);
                if (!current || d < current.date) { // Find Oldest Debit date logic
                    matchingMap.set(row.matching, { date: d, type: t });
                }
            }
        }
    });

    // 2. Buckets & Month Breakdown
    const buckets: Record<string, number> = {
        'Current Month Inv': 0,
        '1 Month Old Inv': 0,
        '2 Months Old Inv': 0,
        '3 Months Old Inv': 0,
        '4 Months Old Inv': 0,
        '5 Months Old Inv': 0,
        '6+ Months Old Inv': 0,
        'Opening Balance (OB)': 0,
        'Unmatched': 0
    };
    const monthTotals = new Map<string, { sortKey: number, amount: number, label: string }>();
    let totalQualityCollected = 0;

    baseData.forEach(row => {
        const credit = (row.credit || 0) - (row.debit || 0);

        // Count POSITIVE collections
        if (credit > 0) {
            const payDate = parseDate(row.date);

            // STRICTLY Respect Filter Period for this analysis
            if (payDate && startDate && endDate) {
                if (payDate < startDate || payDate > endDate) return;
            }

            // Handle Unmatched
            if (!row.matching || row.matching === 'Unmatched' || row.matching === '') {
                buckets['Unmatched'] += credit;

                const uKey = 'Unmatched';
                const currentU = monthTotals.get(uKey) || { sortKey: -99999999999, amount: 0, label: 'Unmatched' };
                currentU.amount += credit;
                monthTotals.set(uKey, currentU);

                totalQualityCollected += credit;
                return;
            }

            const matchInfo = matchingMap.get(row.matching);

            // Check based on matched Invoice Type first, then fallback to string matching
            const isOB = (matchInfo && matchInfo.type === 'OB') || row.matching.startsWith('OB');

            if (isOB) {
                buckets['Opening Balance (OB)'] += credit;
                // Add to Month Map (OB special case)
                const obKey = 'OB';
                const currentOb = monthTotals.get(obKey) || { sortKey: -9999999999, amount: 0, label: 'Opening Balance' };
                currentOb.amount += credit;
                monthTotals.set(obKey, currentOb);

                totalQualityCollected += credit;
            } else {
                const payDate = parseDate(row.date);
                const invDate = matchInfo?.date;

                if (invDate && payDate) {
                    const monthsDiff = getDiffMonths(payDate, invDate);

                    // Add to buckets
                    if (monthsDiff <= 0) buckets['Current Month Inv'] += credit;
                    else if (monthsDiff === 1) buckets['1 Month Old Inv'] += credit;
                    else if (monthsDiff === 2) buckets['2 Months Old Inv'] += credit;
                    else if (monthsDiff === 3) buckets['3 Months Old Inv'] += credit;
                    else if (monthsDiff === 4) buckets['4 Months Old Inv'] += credit;
                    else if (monthsDiff === 5) buckets['5 Months Old Inv'] += credit;
                    else buckets['6+ Months Old Inv'] += credit;

                    // Add to Invoice Month Map (Table)
                    const mLabel = invDate.toLocaleString('en-US', { month: 'short', year: 'numeric' });
                    const mKey = `${invDate.getFullYear()}-${invDate.getMonth()}`;
                    const sortKey = invDate.getTime();

                    const currentM = monthTotals.get(mKey) || { sortKey, amount: 0, label: mLabel };
                    currentM.amount += credit;
                    monthTotals.set(mKey, currentM);

                    totalQualityCollected += credit;
                }
            }
        }
    });

    // 3. Prepare Data for Chart/Table - Filter out zero values for cleaner chart
    // 3. Prepare Data for Chart matching Table (Invoice Month Breakdown)
    // Filter and Sort from monthTotals
    const allMonthEntries = Array.from(monthTotals.values());
    const obEntry = allMonthEntries.find(m => m.label === 'Opening Balance');
    const unmEntry = allMonthEntries.find(m => m.label === 'Unmatched');

    // Sort standard months Descending (Newest First)
    const stdMonthEntries = allMonthEntries
        .filter(m => m.label !== 'Opening Balance' && m.label !== 'Unmatched')
        .sort((a, b) => b.sortKey - a.sortKey); // All months for accurate "6+" Sum

    const qualityData: { label: string, value: number }[] = [];

    // Order: Standard Months Mapped to Age Buckets -> OB -> Unmatched

    if (stdMonthEntries.length > 0) {
        // Current (Index 0)
        qualityData.push({ label: 'Current Month Inv', value: stdMonthEntries[0].amount });

        // 1-5 Months
        for (let i = 1; i < 6 && i < stdMonthEntries.length; i++) {
            const lbl = i === 1 ? '1 Month Old Inv' : `${i} Months Old Inv`;
            qualityData.push({ label: lbl, value: stdMonthEntries[i].amount });
        }

        // 6+ (Rest)
        let restVal = 0;
        for (let i = 6; i < stdMonthEntries.length; i++) {
            restVal += stdMonthEntries[i].amount;
        }
        if (restVal > 0) {
            qualityData.push({ label: '6+ Months Old Inv', value: restVal });
        }
    }

    if (obEntry) qualityData.push({ label: 'Opening Balance (OB)', value: obEntry.amount });
    if (unmEntry) qualityData.push({ label: 'Unmatched', value: unmEntry.amount });

    y += 5;

    // Modern Vertical Column Chart
    if (qualityData.length > 0) {
        // Dimensions
        // Dimensions
        const chartH = 70;
        const chartW = 180;
        const pageW = 210;
        const startX = (pageW - chartW) / 2;

        // Title Removed
        y += 3; // Minimal spacing

        // Chart Area (Background)
        doc.setFillColor(250, 250, 252);
        doc.roundedRect(startX, y, chartW, chartH + 20, 3, 3, 'F');

        const maxQVal = Math.max(...qualityData.map(d => d.value), 1);
        const colWidth = (chartW - 20) / qualityData.length; // Spread columns
        const barWidth = colWidth * 0.6; // Bar is 60% of slot width
        const bottomY = y + chartH;

        let curX = startX + 10; // Padding left

        qualityData.forEach(d => {
            const valH = (d.value / maxQVal) * (chartH - 15); // Leave space for top labels
            const barX = curX + (colWidth - barWidth) / 2;
            const barY = bottomY - valH;

            // Color Logic
            if (d.label === 'Opening Balance (OB)') doc.setFillColor(16, 185, 129); // Emerald
            else if (d.label === '6+ Months Old Inv') doc.setFillColor(34, 197, 94); // Green
            else if (d.label === 'Current Month Inv') doc.setFillColor(59, 130, 246); // Blue
            else if (d.label === 'Unmatched') doc.setFillColor(239, 68, 68); // Red
            else doc.setFillColor(148, 163, 184); // Slate

            // Draw Bar
            if (valH > 0) {
                // Rounded top corners manually or just rect
                doc.roundedRect(barX, barY, barWidth, valH, 1, 1, 'F');

                // Value Label (Top of bar)
                doc.setFontSize(8);
                doc.setTextColor(71, 85, 105);
                doc.setFont('helvetica', 'bold');
                const valStr = `${d.value.toLocaleString(undefined, { notation: 'compact' })}`;
                doc.text(valStr, barX + barWidth / 2, barY - 2, { align: 'center' });
            }

            // X-Axis Label (Bottom)
            doc.setFontSize(7);
            doc.setTextColor(100, 116, 139);
            doc.setFont('helvetica', 'normal');

            // Clearer Labels (Restored Age Logic)
            let displayLabel = d.label;
            if (d.label === 'Current Month Inv') displayLabel = 'Current\nMonth';
            else if (d.label === 'Opening Balance (OB)') displayLabel = 'Opening\nBalance';
            else if (d.label === 'Unmatched') displayLabel = 'Unmatched';
            else displayLabel = d.label.replace(' Old Inv', '').replace('Months', 'Mths').replace('Month', 'Mth');

            const lines = doc.splitTextToSize(displayLabel, colWidth + 5);
            doc.text(lines, barX + barWidth / 2, bottomY + 5, { align: 'center', lineHeightFactor: 1.1 });

            curX += colWidth;
        });

        y += chartH + 30; // Move Y past chart
    }

    // Table
    // Table: Detailed Invoice Months
    const sortedMonths = Array.from(monthTotals.values())
        .sort((a, b) => b.sortKey - a.sortKey);

    const monthTableData = sortedMonths.map(d => {
        const share = totalQualityCollected > 0 ? (d.amount / totalQualityCollected) * 100 : 0;
        return [
            d.label,
            `${d.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
            `${share.toFixed(1)}%`
        ];
    });

    // Add Total Row
    monthTableData.push([
        'Total Analyzed',
        `${totalQualityCollected.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        '100.0%'
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Invoice Month', 'Amount Collected', 'Share %']],
        body: monthTableData,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], halign: 'center', valign: 'middle' },
        bodyStyles: { halign: 'center', valign: 'middle' },
        didParseCell: (data) => {
            if (data.section === 'body') {
                const label = String((data.row.raw as any)[0]);

                // Color Highlights
                if (label === 'Opening Balance') {
                    data.cell.styles.textColor = [16, 185, 129];
                    data.cell.styles.fontStyle = 'bold';
                } else if (label === 'Unmatched') {
                    data.cell.styles.textColor = [239, 68, 68]; // Red
                    data.cell.styles.fontStyle = 'bold';
                }

                // Total Row
                if (data.row.index === sortedMonths.length) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [241, 245, 249];
                }
            }
        }
    });

    // --- SALES REPRESENTATIVE ANALYSIS ---
    doc.addPage('a4', 'portrait'); // Ensure portrait
    y = 20;

    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text('Sales Representative Performance', 105, y, { align: 'center' });
    y += 10;

    // 1. Data Aggregation
    const repMap = new Map<string, { total: number, count: number, customers: Set<string> }>();

    baseData.forEach(p => {
        // Check Date Range
        const d = parseDate(p.date);
        if (!d) return;
        // Respect Start/End Date derived earlier
        if (startDate && d < startDate) return;
        if (endDate && d > endDate) return;

        const rep = p.salesRep && p.salesRep.trim() ? p.salesRep.trim() : 'Unknown';
        const val = (p.credit || 0) - (p.debit || 0);

        if (!repMap.has(rep)) repMap.set(rep, { total: 0, count: 0, customers: new Set() });
        const stat = repMap.get(rep)!;
        stat.total += val;
        stat.count++;
        stat.customers.add(p.customerName);
    });

    const repData = Array.from(repMap.entries())
        .map(([name, s]) => ({
            name,
            total: s.total,
            count: s.count,
            uniqueCust: s.customers.size,
            avgVal: s.count > 0 ? s.total / s.count : 0
        }))
        .filter(d => d.total > 0.1) // Filter out zero/negative
        .sort((a, b) => b.total - a.total);

    // 2. Top Performers Cards Removed as per request

    // 3. Horizontal Chart (Top 10)
    if (repData.length > 0) {
        // 3. Horizontal Chart (Top 10)
        const chartData = repData.map(r => ({ label: r.name, value: r.total }));
        const chartH = Math.min(250, chartData.length * 15 + 20); // Dynamic height (15 unit/item to fit 8mm bar + 6mm gap)
        drawHorizontalBarChart(15, y, 180, chartH, chartData, '');

        y += chartH + 15;
    }

    // 4. Detailed Table
    const grandTotalRep = repData.reduce((acc, curr) => acc + curr.total, 0); // Total from filtered data

    const repRows = repData.map((r, i) => {
        const share = grandTotalRep > 0 ? (r.total / grandTotalRep) * 100 : 0;
        return [
            i + 1,
            r.name,
            `${r.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
            r.count,
            r.uniqueCust,
            // Removed Avg/Txn
            `${share.toFixed(1)}%`
        ];
    });

    const totalTxns = repData.reduce((acc, curr) => acc + curr.count, 0);
    const totalClients = repData.reduce((acc, curr) => acc + curr.uniqueCust, 0);

    // Add Total Row
    repRows.push([
        '',
        'Total',
        `${grandTotalRep.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        totalTxns,
        totalClients,
        '100.0%'
    ]);

    autoTable(doc, {
        startY: y,
        head: [['#', 'Sales Rep', 'Total Collected', 'Txns', 'Clients', 'Share %']],
        body: repRows,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], halign: 'center', valign: 'middle' },
        bodyStyles: { halign: 'center', valign: 'middle' },
        columnStyles: {},
        didParseCell: (data) => {
            if (data.section === 'body') {
                // Highlight Top 3 (if not Total row)
                if (data.row.index < repRows.length - 1 && data.row.index < 3) {
                    if (data.column.index === 0) {
                        data.cell.styles.fontStyle = 'bold';
                        if (data.row.index === 0) data.cell.styles.textColor = [217, 119, 6]; // Dark Gold
                    }
                }

                // Total Row Styling
                if (data.row.index === repRows.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [241, 245, 249]; // Slate 50
                    if (data.column.index === 1) data.cell.styles.halign = 'center'; // Center "Total" text
                }
            }
        }
    });

    // Footer / Page Numbers
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const pWidth = doc.internal.pageSize.width;
        const pHeight = doc.internal.pageSize.height;
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount}`, pWidth - 15, pHeight - 7, { align: 'right' });
    }

    doc.save(`Collections_Analysis_${new Date().toISOString().split('T')[0]}.pdf`);
};
