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

export type CreatePaymentLinkParams = {
  amount: number; // in cents
  name: string;
  metadata: Record<string, string>;
};

/**
 * Creates a Stripe Payment Link for a specific amount
 */
export async function createPaymentLink(params: CreatePaymentLinkParams) {
  const { amount, name, metadata } = params;

  // 1. Create a Price first
  const price = await stripe.prices.create({
    currency: 'usd',
    unit_amount: amount,
    product_data: {
      name,
    },
  });

  // 2. Create the Payment Link
  const paymentLink = await stripe.paymentLinks.create({
    line_items: [
      {
        price: price.id,
        quantity: 1,
      },
    ],
    metadata,
  });

  return paymentLink;
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
