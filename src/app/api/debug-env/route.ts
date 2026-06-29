import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
    webhookSecretPrefix: process.env.STRIPE_WEBHOOK_SECRET?.substring(0, 15) || 'NOT SET',
    hasStripeSecret: !!process.env.STRIPE_SECRET_KEY,
    hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
