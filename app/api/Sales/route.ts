import { NextResponse } from 'next/server';
import { bhs_supabas } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

// تحديد مسار فولدر الكاش
const CACHE_DIR = path.join(process.cwd(), 'app', 'api', 'Sales', 'Cache');
const SALES_CACHE_FILE = path.join(CACHE_DIR, 'sales_data.json');
const MONTHS_CACHE_FILE = path.join(CACHE_DIR, 'months_data.json');

// التأكد من وجود فولدر الكاش
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const refresh = searchParams.get('refresh') === 'true';

    // -------------------------------------------------------------
    // مسار تجميع الشهور (Months Aggregation)
    // -------------------------------------------------------------
    if (action === 'months') {
      // إرجاع الكاش فوراً لو متاح ومفيش طلب refresh
      if (!refresh && fs.existsSync(MONTHS_CACHE_FILE)) {
        const cachedData = fs.readFileSync(MONTHS_CACHE_FILE, 'utf-8');
        return NextResponse.json(JSON.parse(cachedData));
      }

      // جلب البيانات من الداتا بيز في حالة الـ refresh أو عدم وجود الكاش
      const { data, error } = await bhs_supabas.rpc('get_sales_months_summary');
      if (error) throw error;

      const monthsList = (data || []).map((row: any) => ({
        year: Number(row.year),
        month: Number(row.month),
        count: Number(row.count),
      }));

      // تحديث الكاش
      fs.writeFileSync(MONTHS_CACHE_FILE, JSON.stringify({ data: monthsList }, null, 2));
      return NextResponse.json({ data: monthsList });
    }

    // -------------------------------------------------------------
    // مسار جلب المبيعات بالكامل (All Sales Data)
    // -------------------------------------------------------------
    
    // إرجاع الكاش فوراً لو متاح ومفيش طلب refresh
    if (!refresh && fs.existsSync(SALES_CACHE_FILE)) {
      const cachedData = fs.readFileSync(SALES_CACHE_FILE, 'utf-8');
      return NextResponse.json(JSON.parse(cachedData));
    }

    // عشان نتجنب الـ timeout في جلب 70 الف صف، هنجيب الـ count الأول
    // ونستخدم limit / range بشكل متتالي
    const { count, error: countErr } = await bhs_supabas
      .from('web_Sales_DB')
      .select('ID', { count: 'exact', head: true });
      
    if (countErr) throw countErr;
    
    const totalCount = count || 0;
    const batchSize = 1000;
    const numPages = Math.ceil(totalCount / batchSize);
    
    let rawData: any[] = [];
    
    // سحب البيانات على شكل دفعات متتالية لتجنب إرهاق السيرفر (بدل Promise.all)
    for (let i = 0; i < numPages; i++) {
      const start = i * batchSize;
      const end = start + batchSize - 1;
      
      const { data, error } = await bhs_supabas
        .from('web_Sales_DB')
        .select(`
          ID,
          "INVOICE DATE",
          "INVOICE NUMBER",
          "PRODUCT TAG",
          "PRODUCT COST",
          "PRODUCT PRICE",
          AMOUNT,
          QTY,
          customer:bhs_CUSTOMERS (
            ID,
            "CUSTOMER ID",
            "CUSTOMER MAIN NAME",
            "CUSTOMER SUB NAME",
            "CUSTOMER CITY"
          ),
          product:bhs_PRODUCTS (
            ID,
            "PRODUCT ID",
            "PRODUCT BARCODE",
            "PRODUCT NAME"
          )
        `)
        .range(start, end);

      if (error) throw error;
      if (data) rawData = rawData.concat(data);
    }

    // ترتيب وتنظيف البيانات
    const formattedData = rawData.map((item: any) => ({
      invoiceDate: item["INVOICE DATE"] || '',
      invoiceNumber: item["INVOICE NUMBER"] || '',
      customerId: item.customer?.["CUSTOMER ID"] || '',
      customerMainName: item.customer?.["CUSTOMER MAIN NAME"] || 'Unknown',
      customerName: item.customer?.["CUSTOMER SUB NAME"] || 'Unknown',
      area: item.customer?.["CUSTOMER CITY"] || '',
      market: '', 
      salesRep: '', 
      merchandiser: '', 
      productId: item.product?.["PRODUCT ID"] || '',
      barcode: item.product?.["PRODUCT BARCODE"] || '',
      product: item.product?.["PRODUCT NAME"] || 'Unknown Product',
      productTag: item["PRODUCT TAG"] || '',
      productCost: Number(item["PRODUCT COST"]) || 0,
      productPrice: Number(item["PRODUCT PRICE"]) || 0,
      amount: Number(item.AMOUNT) || 0,
      qty: Number(item.QTY) || 0
    }));

    // تحديث ملف الكاش
    fs.writeFileSync(SALES_CACHE_FILE, JSON.stringify({ data: formattedData }, null, 2));

    return NextResponse.json({ data: formattedData });

  } catch (error: any) {
    console.error('API Error fetching sales:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales data', details: error.message || error },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    if (!year || !month) {
      return NextResponse.json({ error: 'Year and Month are required' }, { status: 400 });
    }

    const y = parseInt(year);
    const m = parseInt(month);
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const endDate = m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, '0')}-01`;

    const { error } = await bhs_supabas
      .from('web_Sales_DB')
      .delete()
      .gte('INVOICE DATE', startDate)
      .lt('INVOICE DATE', endDate);

    if (error) throw error;

    // بمجرد حدوث تعديل أو حذف، نقوم بمسح الكاش عشان يتم بناءه من جديد المرة الجاية
    if (fs.existsSync(SALES_CACHE_FILE)) fs.unlinkSync(SALES_CACHE_FILE);
    if (fs.existsSync(MONTHS_CACHE_FILE)) fs.unlinkSync(MONTHS_CACHE_FILE);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Error deleting month sales:', error);
    return NextResponse.json(
      { error: 'Failed to delete month sales data', details: error.message || error },
      { status: 500 }
    );
  }
}
