import { NextRequest, NextResponse } from 'next/server';
import { getAllClients, addClient } from '@/lib/storage';

export async function GET() {
  try {
    const clients = await getAllClients();
    return NextResponse.json({ clients });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const client = await request.json();
    await addClient(client);
    return NextResponse.json({ success: true, client });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create client' },
      { status: 500 }
    );
  }
}