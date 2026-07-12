'use server';

import { bhs_supabas } from '@/lib/supabase';

// -------------------------------------------------------------
// 1. Products Data
// -------------------------------------------------------------
export async function getProductsData(userId: string, filters: any) {
  const { invoiceType, year, month, dateFrom, dateTo, area, market, merchandiser, salesRep, productTag } = filters || {};

  const { data, error } = await bhs_supabas.rpc('get_sales_products_aggregated', {
    p_user_id: userId,
    p_invoice_type: invoiceType || 'all',
    p_year: year ? parseInt(year, 10) : null,
    p_month: month ? parseInt(month, 10) : null,
    p_date_from: dateFrom || null,
    p_date_to: dateTo || null,
    p_area: area || null,
    p_market: market || null,
    p_merchandiser: merchandiser || null,
    p_sales_rep: salesRep || null,
    p_product_tag: productTag || null
  });

  if (error) {
    console.error('RPC Error in getProductsData:', error);
    return [];
  }

  return data || [];
}

// -------------------------------------------------------------
// 2. Product Details Data
// -------------------------------------------------------------
export async function getProductDetailsData(userId: string, filters: any, productId: string) {
  const { invoiceType, year, month, dateFrom, dateTo, area, market, merchandiser, salesRep, productTag } = filters || {};

  const { data, error } = await bhs_supabas.rpc('get_sales_product_details_raw', {
    p_user_id: userId,
    p_product_id: productId,
    p_invoice_type: invoiceType || 'all',
    p_year: year ? parseInt(year, 10) : null,
    p_month: month ? parseInt(month, 10) : null,
    p_date_from: dateFrom || null,
    p_date_to: dateTo || null,
    p_area: area || null,
    p_market: market || null,
    p_merchandiser: merchandiser || null,
    p_sales_rep: salesRep || null,
    p_product_tag: productTag || null
  });

  if (error) {
    console.error('RPC Error in getProductDetailsData:', error);
    return { data: [], allData: [] };
  }

  return data || { data: [], allData: [] };
}

// -------------------------------------------------------------
// 3. Categories Data
// -------------------------------------------------------------
export async function getCategoriesData(userId: string, filters: any) {
  const { invoiceType, year, month, dateFrom, dateTo, area, market, merchandiser, salesRep, productTag } = filters || {};

  const { data, error } = await bhs_supabas.rpc('get_sales_categories_aggregated', {
    p_user_id: userId,
    p_invoice_type: invoiceType || 'all',
    p_year: year ? parseInt(year, 10) : null,
    p_month: month ? parseInt(month, 10) : null,
    p_date_from: dateFrom || null,
    p_date_to: dateTo || null,
    p_area: area || null,
    p_market: market || null,
    p_merchandiser: merchandiser || null,
    p_sales_rep: salesRep || null,
    p_product_tag: productTag || null
  });

  if (error) {
    console.error('RPC Error in getCategoriesData:', error);
    return [];
  }

  return data || [];
}

// -------------------------------------------------------------
// 4. New Listings Data
// -------------------------------------------------------------
export async function getNewListingsData(userId: string, filters: any) {
  const { year, month, dateFrom, dateTo, area, market, merchandiser, salesRep, productTag } = filters || {};

  const { data, error } = await bhs_supabas.rpc('get_sales_new_listings', {
    p_user_id: userId,
    p_year: year ? parseInt(year, 10) : null,
    p_month: month ? parseInt(month, 10) : null,
    p_date_from: dateFrom || null,
    p_date_to: dateTo || null,
    p_area: area || null,
    p_market: market || null,
    p_merchandiser: merchandiser || null,
    p_sales_rep: salesRep || null,
    p_product_tag: productTag || null
  });

  if (error) {
    console.error('RPC Error in getNewListingsData:', error);
    return [];
  }

  return data || [];
}
