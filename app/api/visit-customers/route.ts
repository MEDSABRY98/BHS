import { NextResponse } from 'next/server';
import { getVisitCustomersData, addVisitCustomerEntry, updateVisitCustomerEntry } from '@/lib/googleSheets';

export async function GET() {
    try {
        const data = await getVisitCustomersData();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in Visit Customers GET:', error);
        return NextResponse.json({ error: 'Failed to fetch Visit Customers data' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const result = await addVisitCustomerEntry(body);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Error in Visit Customers POST:', error);
        return NextResponse.json({ error: 'Failed to add Visit Customer entry' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { rowIndex, ...entry } = body;
        if (!rowIndex) {
            return NextResponse.json({ error: 'rowIndex is required' }, { status: 400 });
        }
        const result = await updateVisitCustomerEntry(rowIndex, entry);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Error in Visit Customers PUT:', error);
        return NextResponse.json({ error: 'Failed to update Visit Customer entry' }, { status: 500 });
    }
}
