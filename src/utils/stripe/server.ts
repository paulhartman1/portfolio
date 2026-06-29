import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
}

// Initialize Stripe with the latest API version
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-06-24.dahlia', // Latest stable version
  typescript: true,
});

export type CreateCheckoutSessionParams = {
  projectId: string;
  amount: number; // in cents
  description: string;
  paymentType: 'project' | 'retainer';
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
};

/**
 * Creates a Stripe Checkout Session for a project payment
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<Stripe.Checkout.Session> {
  const {
    projectId,
    amount,
    description,
    paymentType,
    customerEmail,
    successUrl,
    cancelUrl,
  } = params;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: customerEmail,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: description,
            description: `${paymentType === 'project' ? 'Project Payment' : 'Retainer'} for LoveOnDev`,
          },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      projectId,
      paymentType,
    },
  });

  return session;
}

/**
 * Retrieves a Checkout Session by ID
 */
export async function getCheckoutSession(
  sessionId: string
): Promise<Stripe.Checkout.Session> {
  return await stripe.checkout.sessions.retrieve(sessionId);
}

/**
 * Retrieves a Payment Intent by ID
 */
export async function getPaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  return await stripe.paymentIntents.retrieve(paymentIntentId);
}
