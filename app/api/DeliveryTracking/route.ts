import { NextResponse } from 'next/server';
import { app_lpos_supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// ── GET /api/DeliveryTracking ──────────────────────────────────
// Returns all delivery records from web_DELIVERYTRACKING and customers from bhs_CUSTOMERS
export async function GET() {
    try {
        const [ordersRes, customersRes] = await Promise.all([
            app_lpos_supabase
                .from('web_DELIVERYTRACKING')
                .select('*')
                .order('CREATED_AT', { ascending: false }),
            (app_lpos_supabase
                .from('bhs_CUSTOMERS')
                .select('ID, "CUSTOMER NAME", "CUSTOMER CITY"') as any)
        ]);

        if (ordersRes.error) throw ordersRes.error;
        if (customersRes.error) throw customersRes.error;

        // Build a map: customer ID → customer Name for fast resolution
        const customerMap = new Map<string, string>();
        customersRes.data?.forEach((c: any) => {
            if (c.ID) {
                customerMap.set(c.ID.toString().trim().toLowerCase(), c['CUSTOMER NAME']);
            }
        });

        const merged = ordersRes.data?.map(o => {
            const customerIdKey = (o.CUSTOMER_ID || '').toString().trim().toLowerCase();
            const resolvedCustomerName = customerMap.get(customerIdKey) || o.CUSTOMER_ID || 'Unknown Customer';

            return {
                id: o.ID,
                lpoId: o.ID,
                lpo: o.LPO_NUMBER || '',
                date: o.LPO_DATE || '',
                deliveryDate: o.DELIVERY_DATE || '',
                customer: resolvedCustomerName, // Name for display
                customerId: o.CUSTOMER_ID || '', // Keep original ID/name for editing
                lpoVal: Number(o.LPO_AMOUNT) || 0,
                invoiceVal: 0,
                invoiceDate: '',
                invoiceNumber: '',
                status: (o.STATUS || 'pending').toLowerCase(),
                reship: false,
                notes: '',
                missing: [],
                shippedItems: [],
                canceledItems: [],
                createdAt: o.CREATED_AT,
                updatedAt: o.UPDATED_AT
            };
        });

        const mappedCustomers = customersRes.data?.map((c: any) => ({
            customerId: c.ID,
            customerName: c['CUSTOMER NAME'],
            customerCity: c['CUSTOMER CITY'] || 'Unknown'
        })) || [];

        mappedCustomers.sort((a: any, b: any) => 
            (a.customerName || '').localeCompare(b.customerName || '', undefined, { sensitivity: 'base' })
        );

        return NextResponse.json({ orders: merged || [], customers: mappedCustomers });
    } catch (error: any) {
        console.error('GET /api/DeliveryTracking error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch delivery data' }, { status: 500 });
    }
}

// ── POST /api/DeliveryTracking ─────────────────────────────────
// Add new record(s) to web_DELIVERYTRACKING
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action } = body;

        if (action === 'add_lpo') {
            const { lpos } = body;

            if (lpos && Array.isArray(lpos)) {
                const rowsToInsert = lpos.map(lpo => ({
                    LPO_NUMBER: lpo.lpoNumber || '',
                    LPO_DATE: lpo.lpoDate || '',
                    DELIVERY_DATE: lpo.lpoDeliveryDate || '',
                    CUSTOMER_ID: lpo.customerName || '', // customerName parameter holds customerId or customerName
                    LPO_AMOUNT: Number(lpo.lpoValue) || 0,
                    STATUS: (lpo.status || 'pending').toLowerCase(),
                    POSTPONED_DATE: lpo.postponedDate || ''
                }));

                const { data, error } = await app_lpos_supabase
                    .from('web_DELIVERYTRACKING')
                    .insert(rowsToInsert)
                    .select();

                if (error) throw error;
                return NextResponse.json({ success: true, count: rowsToInsert.length, data });
            } else {
                const { lpoNumber, lpoDate, lpoDeliveryDate, customerName, lpoValue, status, postponedDate } = body;

                if (!lpoNumber || !lpoDate || !customerName || !lpoValue) {
                    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
                }

                const rowToInsert = {
                    LPO_NUMBER: lpoNumber,
                    LPO_DATE: lpoDate,
                    DELIVERY_DATE: lpoDeliveryDate || '',
                    CUSTOMER_ID: customerName,
                    LPO_AMOUNT: Number(lpoValue) || 0,
                    STATUS: (status || 'pending').toLowerCase(),
                    POSTPONED_DATE: postponedDate || ''
                };

                const { data, error } = await app_lpos_supabase
                    .from('web_DELIVERYTRACKING')
                    .insert(rowToInsert)
                    .select();

                if (error) throw error;
                return NextResponse.json({ success: true, data });
            }
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (error: any) {
        console.error('POST /api/DeliveryTracking error:', error);
        return NextResponse.json({ error: error.message || 'Failed to save data' }, { status: 500 });
    }
}

// ── PUT /api/DeliveryTracking ──────────────────────────────────
// Update record fields by ID
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, rowIndex, status, deliveryDate, postponedDate, lpoNumber, lpoDate, customerId, lpoValue } = body;

        const rowId = id || rowIndex;
        if (!rowId) {
            return NextResponse.json({ error: 'ID is required for update' }, { status: 400 });
        }

        const updateFields: any = {};
        if (status !== undefined) {
            updateFields.STATUS = status.toLowerCase();
        }
        if (deliveryDate !== undefined) {
            updateFields.DELIVERY_DATE = deliveryDate;
        }
        if (postponedDate !== undefined) {
            updateFields.POSTPONED_DATE = postponedDate;
            updateFields.DELIVERY_DATE = postponedDate; // update DELIVERY_DATE when postponed
        }
        if (lpoNumber !== undefined) {
            updateFields.LPO_NUMBER = lpoNumber;
        }
        if (lpoDate !== undefined) {
            updateFields.LPO_DATE = lpoDate;
        }
        if (customerId !== undefined) {
            updateFields.CUSTOMER_ID = customerId;
        }
        if (lpoValue !== undefined) {
            updateFields.LPO_AMOUNT = Number(lpoValue) || 0;
        }

        const { data, error } = await app_lpos_supabase
            .from('web_DELIVERYTRACKING')
            .update(updateFields)
            .eq('ID', rowId)
            .select();

        if (error) throw error;
        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('PUT /api/DeliveryTracking error:', error);
        return NextResponse.json({ error: error.message || 'Failed to update record' }, { status: 500 });
    }
}

// ── DELETE /api/DeliveryTracking ───────────────────────────────
// Delete record by ID
export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const { id, rowIndex } = body;
        const rowId = id || rowIndex;

        if (!rowId) {
            return NextResponse.json({ error: 'ID is required for delete' }, { status: 400 });
        }

        const { data, error } = await app_lpos_supabase
            .from('web_DELIVERYTRACKING')
            .delete()
            .eq('ID', rowId)
            .select();

        if (error) throw error;
        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('DELETE /api/DeliveryTracking error:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete record' }, { status: 500 });
    }
}
