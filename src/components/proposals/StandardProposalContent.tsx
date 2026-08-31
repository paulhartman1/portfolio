'use client'

type Experiment = {
  id: string
  code: string
  title: string
  slug: string
}

type Props = {
  title: string
  amount: number
  timeline: string
  experiments: Experiment[]
  stripeUrl?: string | null
  depositAmount?: number | null
  subdomain: string
}

export default function StandardProposalContent({ 
  title, 
  amount, 
  timeline, 
  experiments, 
  stripeUrl,
  depositAmount,
  subdomain
}: Props) {
  const displayDeposit = depositAmount || amount
  
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
            <p className="text-3xl font-bold text-[#27ae60]">${amount.toLocaleString()}</p>
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
        ) : (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 italic">
            Proposal is pending finalized payment link.
          </div>
        )}
      </footer>
    </div>
  )
}
