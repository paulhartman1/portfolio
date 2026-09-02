'use client'

type Experiment = {
  id: string
  code: string
  title: string
  slug: string
}

type Props = {
  id: string
  versionId: string
  title: string
  amount?: number | null
  timeline: string
  experiments: Experiment[]
  stripeUrl?: string | null
  depositAmount?: number | null
  subdomain: string
}

export default function StandardProposalContent({ 
  id,
  versionId,
  title, 
  amount, 
  timeline, 
  experiments, 
  stripeUrl,
  depositAmount,
  subdomain
}: Props) {
  const displayDeposit = depositAmount ?? amount ?? 0
  const amountConfigured = amount != null
  const positiveAmount = amountConfigured && amount > 0
  
  return (
    <div className="max-w-3xl mx-auto py-12 px-6 bg-[#fdfcf9] text-[#2c3e50] font-serif">
      <header className="border-b-2 border-[#ecf0f1] pb-8 mb-12">
        <h1 className="text-4xl font-normal text-[#1a1a1a] mb-4">{title}</h1>
        <p className="text-xl text-[#7f8c8d] italic">Common Ground Technology LLC</p>
      </header>

      <section className="mb-12">
        <h2 className="text-2xl font-normal border-b border-[#bdc3c7] pb-2 mb-6">Scope of Work</h2>
        <div className="space-y-4">
          {experiments.map(exp => (
            <div 
              key={exp.id} 
              className="relative flex gap-4 p-4 bg-white border border-[#e8e4ef] rounded-xl shadow-sm hover:border-[#290D47] hover:bg-[#F8F7F5] transition-all group"
            >
              {/* The actual Link that covers the card */}
              <a 
                href={`/portal/${subdomain}/experiments/${exp.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 z-10"
                aria-label={`Review details for ${exp.title}`}
              />
              
              <span className="font-mono text-xs text-[#6b6785] mt-1 group-hover:text-[#290D47]">{exp.code}</span>
              <div className="flex-1">
                <h3 className="font-semibold text-[#1a0f2e] group-hover:text-[#290D47]">{exp.title}</h3>
                <p className="text-xs text-[#6b6785] mt-1 transition-colors group-hover:text-[#290D47]">
                  Click to review experiment details →
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#ecf0f1] border-l-4 border-[#3498db] p-8 mb-12">
        <h2 className="text-xl font-bold mb-4">Investment & Timeline</h2>
        <div className="flex flex-wrap gap-8 items-center">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#7f8c8d]">Total Investment</p>
            <p className="text-3xl font-bold text-[#27ae60]">${(amount || 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-[#7f8c8d]">Estimated Timeline</p>
            <p className="text-xl font-semibold">{timeline}</p>
          </div>
        </div>
        <p className="mt-4 text-sm italic text-[#34495e]">
          Work begins immediately upon receipt of the initial deposit (${displayDeposit.toLocaleString()}).
        </p>
      </section>

      <footer className="mt-16 text-center">
        <div className="flex flex-col items-center gap-6">
          {stripeUrl ? (
            <a
              href={stripeUrl}
              className="inline-flex items-center gap-2 px-8 py-4 bg-[#290D47] text-white rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-xl no-underline"
            >
              <svg 
                viewBox="0 0 24 24" 
                width="20" 
                height="20" 
                stroke="currentColor" 
                strokeWidth="2" 
                fill="currentColor" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
              Accept & Pay Deposit
            </a>
          ) : positiveAmount ? (
            // amount > 0: show accept with pay deposit (link may or may not exist)
            // If link exists, show button; if not, show notice that link is needed
            stripeUrl ? (
              <a
                href={stripeUrl}
                className="inline-flex items-center gap-2 px-8 py-4 bg-[#290D47] text-white rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-xl no-underline"
              >
                <svg 
                  viewBox="0 0 24 24" 
                  width="20" 
                  height="20" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  fill="currentColor" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
                Accept & Pay Deposit
              </a>
            ) : (
              <div className="p-4 bg-[#E8E4EF] border border-[#290D47] rounded-lg p-3">
                <p className="text-sm font-medium text-[#1a0f2e] mb-1 uppercase tracking-wide">
                  Accept & Pay Deposit — generate a payment link to finalize
                </p>
              </div>
            )
          ) : amount === 0 ? (
            // amount is 0: proposal is free, accept with no payment required
            <form action="/api/portal/proposals/respond" method="POST" className="w-full flex flex-col items-center">
              <input type="hidden" name="proposal_id" value={id} />
              <input type="hidden" name="decision" value="accepted" />
              <input type="hidden" name="subdomain" value={subdomain} />
              <input 
                type="hidden" 
                name="back_to" 
                value={`/portal/${subdomain}/proposal/version/${versionId}`} 
              />
              
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#290D47] text-white rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-xl w-full sm:w-auto cursor-pointer"
              >
                <svg 
                  viewBox="0 0 24 24" 
                  width="20" 
                  height="20" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  fill="none" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Accept Proposal
              </button>
              <p className="text-xs text-[#6b6785] mt-3">
                No payment required — your acceptance confirms the proposed work.
              </p>
            </form>
          ) : amount == null ? (
            // amount not configured: show pending payment message
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 italic">
              Proposal is pending finalized payment link.
            </div>
          ) : null}
        </div>
        <div className="mt-4 pt-8 border-t border-[#ecf0f1] w-full max-w-sm">
          <p className="text-sm text-[#7f8c8d] mb-4 italic">
            Have questions or need adjustments to the scope?
          </p>
          <a 
            href={`/portal/${subdomain}/messages?message=${encodeURIComponent(`Hi Paul, I've reviewed the "${title}" proposal and have some questions/adjustments:`)}`}
            className="text-[#290D47] font-semibold hover:underline flex items-center justify-center gap-2"
          >
            <svg 
              viewBox="0 0 24 24" 
              width="16" 
              height="16" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            Discuss this proposal
          </a>
        </div>
      </footer>
    </div>
  )
}
