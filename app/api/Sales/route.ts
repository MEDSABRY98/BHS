import { NextResponse } from 'next/server';
import { bhs_supabas } from '@/lib/supabase';

export async function GET() {
  try {
    // 1. Get the total count of sales records first
    const { count, error: countErr } = await bhs_supabas
      .from('web_Sales_DB')
      .select('*', { count: 'exact', head: true });
      
    if (countErr) throw countErr;
    
    const totalCount = count || 0;
    const batchSize = 1000;
    const numPages = Math.ceil(totalCount / batchSize);
    
    // 2. Fetch pages in parallel batches to handle the Supabase 1000-row limit
    const promises = [];
    for (let i = 0; i < numPages; i++) {
      const start = i * batchSize;
      const end = start + batchSize - 1;
      promises.push(
        bhs_supabas
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
          .range(start, end)
      );
    }
    
    const results = await Promise.all(promises);
    let rawData: any[] = [];
    for (const res of results) {
      if (res.error) throw res.error;
      rawData = rawData.concat(res.data || []);
    }

    // Map relational table format to match client expectations
    const formattedData = rawData.map((item: any) => ({
      invoiceDate: item["INVOICE DATE"] || '',
      invoiceNumber: item["INVOICE NUMBER"] || '',
      customerId: item.customer?.["CUSTOMER ID"] || '',
      customerMainName: item.customer?.["CUSTOMER MAIN NAME"] || 'Unknown',
      customerName: item.customer?.["CUSTOMER SUB NAME"] || 'Unknown',
      area: item.customer?.["CUSTOMER CITY"] || '',
      market: '', // Keeping empty as it is no longer stored
      salesRep: '', // Keeping empty as it is no longer stored
      merchandiser: '', // Keeping empty as it is no longer stored
      productId: item.product?.["PRODUCT ID"] || '',
      barcode: item.product?.["PRODUCT BARCODE"] || '',
      product: item.product?.["PRODUCT NAME"] || 'Unknown Product',
      productTag: item["PRODUCT TAG"] || '',
      productCost: Number(item["PRODUCT COST"]) || 0,
      productPrice: Number(item["PRODUCT PRICE"]) || 0,
      amount: Number(item.AMOUNT) || 0,
      qty: Number(item.QTY) || 0
    }));

    return NextResponse.json({ data: formattedData });
  } catch (error: any) {
    console.error('API Error fetching sales:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch sales data',
        details: error.message || error
      },
      { status: 500 }
    );
  }
}

