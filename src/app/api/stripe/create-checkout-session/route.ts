import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createCheckoutSession } from '@/utils/stripe/server';

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      projectId,
      amount,
      description,
      paymentType,
      customerEmail,
    } = body;

    // Validate required fields
    if (!projectId || !amount || !description || !paymentType || !customerEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate payment type
    if (!['project', 'retainer'].includes(paymentType)) {
      return NextResponse.json(
        { error: 'Invalid payment type. Must be "project" or "retainer"' },
        { status: 400 }
      );
    }

    // Verify project exists
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Create Stripe Checkout Session
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
    console.log('💳 Creating Stripe checkout session...', {
      projectId,
      amount: Math.round(amount * 100),
      description,
      paymentType,
      customerEmail,
    });
    
    const session = await createCheckoutSession({
      projectId,
      amount: Math.round(amount * 100), // Convert dollars to cents
      description,
      paymentType,
      customerEmail,
      successUrl: `${baseUrl}/admin/payments?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancelUrl: `${baseUrl}/admin/projects/${projectId}/payment-link?canceled=true`,
    });
    
    console.log('✅ Stripe session created:', session.id, session.url);

    // Store payment record in database (admin is already authenticated)
    const { error: insertError } = await supabase
      .from('payments')
      .insert({
        project_id: projectId,
        stripe_session_id: session.id,
        amount: Math.round(amount * 100),
        currency: 'usd',
        status: 'pending',
        payment_type: paymentType,
        description,
        customer_email: customerEmail,
      });

    if (insertError) {
      console.error('Failed to create payment record:', insertError);
      console.error('Payment data:', {
        project_id: projectId,
        stripe_session_id: session.id,
        amount: Math.round(amount * 100),
        currency: 'usd',
        status: 'pending',
        payment_type: paymentType,
        description,
        customer_email: customerEmail,
      });
      return NextResponse.json(
        { error: `Failed to create payment record: ${insertError.message}` },
        { status: 500 }
      );
    }

    // Return checkout session URL
    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
