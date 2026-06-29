import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/utils/stripe/server';
import { createServiceRoleClient } from '@/utils/supabase/service-role';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature provided' },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  // Use service role client to bypass RLS
  const supabase = createServiceRoleClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Update payment status to completed
        const { error: updateError } = await supabase
          .from('payments')
          .update({
            status: 'completed',
            paid_at: new Date().toISOString(),
            stripe_payment_id: session.payment_intent as string,
            metadata: {
              ...session.metadata,
              payment_status: session.payment_status,
            },
          })
          .eq('stripe_session_id', session.id);

        if (updateError) {
          console.error('Failed to update payment:', updateError);
          return NextResponse.json(
            { error: 'Failed to update payment' },
            { status: 500 }
          );
        }

        console.log(`Payment completed for session: ${session.id}`);
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Update payment status to failed
        const { error: updateError } = await supabase
          .from('payments')
          .update({
            status: 'failed',
            metadata: {
              ...session.metadata,
              reason: 'Session expired',
            },
          })
          .eq('stripe_session_id', session.id);

        if (updateError) {
          console.error('Failed to update expired session:', updateError);
        }

        console.log(`Session expired: ${session.id}`);
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // Update payment with payment intent ID if not already set
        const { error: updateError } = await supabase
          .from('payments')
          .update({
            stripe_payment_id: paymentIntent.id,
          })
          .eq('stripe_session_id', paymentIntent.metadata?.sessionId)
          .is('stripe_payment_id', null);

        if (updateError) {
          console.error('Failed to update payment intent:', updateError);
        }

        console.log(`Payment intent succeeded: ${paymentIntent.id}`);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // Update payment status to failed
        const { error: updateError } = await supabase
          .from('payments')
          .update({
            status: 'failed',
            metadata: {
              error: paymentIntent.last_payment_error?.message || 'Payment failed',
            },
          })
          .eq('stripe_payment_id', paymentIntent.id);

        if (updateError) {
          console.error('Failed to update failed payment:', updateError);
        }

        console.log(`Payment failed: ${paymentIntent.id}`);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        
        // Update payment status to refunded
        const { error: updateError } = await supabase
          .from('payments')
          .update({
            status: 'refunded',
            metadata: {
              refund_amount: charge.amount_refunded,
              refunded_at: new Date().toISOString(),
            },
          })
          .eq('stripe_payment_id', charge.payment_intent as string);

        if (updateError) {
          console.error('Failed to update refunded payment:', updateError);
        }

        console.log(`Charge refunded: ${charge.id}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
