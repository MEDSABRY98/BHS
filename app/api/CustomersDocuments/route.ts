import { NextResponse } from 'next/server';
import { getCustomerDocuments, updateCustomerDocument } from '@/lib/googleSheets';

export async function GET() {
  try {
    const data = await getCustomerDocuments();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error in customers-documents API:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { rowIndex, ...data } = body;
    const result = await updateCustomerDocument(rowIndex, data);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error in customers-documents API:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
