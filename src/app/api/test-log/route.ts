import { NextResponse } from 'next/server';

export async function GET() {
  console.log('🧪 TEST LOG - If you see this, logging works!');
  console.error('🧪 TEST ERROR - If you see this, error logging works!');
  
  return NextResponse.json({ 
    message: 'Check your terminal for log messages',
    timestamp: new Date().toISOString()
  });
}
