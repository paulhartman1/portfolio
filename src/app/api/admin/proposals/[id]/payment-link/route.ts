import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createPaymentLink } from '@/utils/stripe/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // 1. Verify admin session
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) return new NextResponse('Forbidden', { status: 403 })

  // 2. Fetch proposal data
  const { data: proposal, error: fetchError } = await supabase
    .from('proposals')
    .select('id, title, amount, deposit_amount, project_id')
    .eq('id', id)
    .single()

  if (fetchError || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  // 3. Generate Stripe Payment Link
  const deposit = proposal.deposit_amount ?? proposal.amount
  if (deposit == null || Number(deposit) <= 0) {
    return NextResponse.json(
      { error: 'Set an amount or deposit amount on this proposal before generating a payment link.' },
      { status: 400 }
    )
  }

  try {
    const amountInCents = Math.round(Number(deposit) * 100)

    const paymentLink = await createPaymentLink({
      amount: amountInCents,
      name: `Deposit: ${proposal.title}`,
      metadata: {
        proposal_id: proposal.id,
        project_id: proposal.project_id,
        type: 'proposal_deposit'
      }
    })

    // 4. Update proposal with the link
    const { error: updateError } = await supabase
      .from('proposals')
      .update({ stripe_payment_link_url: paymentLink.url })
      .eq('id', id)

    if (updateError) throw updateError

    return NextResponse.json({ url: paymentLink.url })
  } catch (error) {
    console.error('Error generating Stripe link:', error)
    return NextResponse.json({ error: 'Failed to generate Stripe link' }, { status: 500 })
  }
}
