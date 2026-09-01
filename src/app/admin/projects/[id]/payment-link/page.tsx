'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabaseBrowser } from '@/utils/supabase/client'

type Project = {
  id: string
  name: string
  subdomain: string | null
}

type Client = {
  email: string
  display_name: string | null
}

export default function PaymentLinkPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const projectId = (params?.id || '').toString()

  const [project, setProject] = useState<Project | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [checkoutUrl, setCheckoutUrl] = useState('')
  const [error, setError] = useState('')

  // Form fields
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [paymentType, setPaymentType] = useState<'project' | 'retainer'>('project')
  const [customerEmail, setCustomerEmail] = useState('')

  const canceled = searchParams?.get('canceled')

  useEffect(() => {
    loadProject()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  async function loadProject() {
    const { data: projectData, error: projectError } = await supabaseBrowser
      .from('projects')
      .select('id, name, subdomain')
      .eq('id', projectId)
      .single()

    if (projectError) {
      console.error('Error loading project:', projectError)
      setError('Project not found')
      setLoading(false)
      return
    }

    setProject(projectData)
    setDescription(`${projectData.name} - Payment`)

    // Load project clients
    const { data: clientRows, error: clientError } = await supabaseBrowser
      .from('project_clients')
      .select(`
        profiles:client_id (
          email,
          display_name
        )
      `)
      .eq('project_id', projectId)

    if (!clientError && clientRows) {
      const clientList = clientRows
        .map((row: { profiles: Client | Client[] | null }) => Array.isArray(row.profiles) ? row.profiles[0] : row.profiles)
        .filter((c: Client | null): c is Client => Boolean(c))
      setClients(clientList)
      
      // Auto-select first client email
      if (clientList.length > 0 && !customerEmail) {
        setCustomerEmail(clientList[0].email)
      }
    }

    setLoading(false)
  }

  async function handleCreateLink(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setCheckoutUrl('')
    setCreating(true)

    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          amount: parseFloat(amount),
          description,
          paymentType,
          customerEmail,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }

      setCheckoutUrl(data.url)
    } catch (err) {
      console.error('Error creating payment link:', err)
      setError(err instanceof Error ? err.message : 'Failed to create payment link')
    } finally {
      setCreating(false)
    }
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(checkoutUrl)
      alert('Payment link copied to clipboard!')
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <p className="text-[#6B6785]">Loading...</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="max-w-2xl mx-auto">
        <p className="text-red-700">{error || 'Project not found'}</p>
        <Link href="/admin/projects" className="text-[#290D47] hover:opacity-80 mt-4 inline-block">
          ← Back to Projects
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href={`/admin/projects/${projectId}`} className="text-[#6B6785] hover:text-[#290D47] text-sm">
          ← Back to {project.name}
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1A0F2E] mb-2">Create Payment Link</h1>
        <p className="text-[#6B6785]">
          Generate a Stripe Checkout link for <strong>{project.name}</strong>
        </p>
      </div>

      {canceled && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800">Payment was canceled</p>
        </div>
      )}

      {checkoutUrl ? (
        <div className="bg-white border border-[#290D47]/15 rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4 text-green-700">✓ Payment Link Created</h2>
          
          <div className="bg-[#F8F7F5] border border-[#E8E4EF] p-4 rounded-xl mb-4 break-all">
            <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className="text-[#290D47] hover:opacity-80">
              {checkoutUrl}
            </a>
          </div>

          <div className="flex gap-3">
            <button
              onClick={copyToClipboard}
              className="bg-[#290D47] text-white px-4 py-2 rounded-lg hover:opacity-90"
            >
              Copy Link
            </button>
            <button
              onClick={() => setCheckoutUrl('')}
              className="bg-white border border-[#E8E4EF] text-[#1A0F2E] px-4 py-2 rounded-lg hover:bg-[#F8F7F5]"
            >
              Create Another
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleCreateLink} className="bg-white border border-[#290D47]/15 rounded-2xl p-6 space-y-6 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-[#1A0F2E] mb-2">
              Amount (USD) *
            </label>
            <input
              type="number"
              step="0.01"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] placeholder:text-[#6B6785]"
              placeholder="5000.00"
            />
            <p className="text-sm text-[#6B6785] mt-1">Enter amount in dollars (e.g., 5000 for $5,000)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1A0F2E] mb-2">
              Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
              className="w-full px-4 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] placeholder:text-[#6B6785]"
              placeholder="Project kickoff payment for..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1A0F2E] mb-2">
              Payment Type *
            </label>
            <select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as 'project' | 'retainer')}
              className="w-full px-4 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] [&>option]:bg-white [&>option]:text-[#1A0F2E]"
            >
              <option value="project">Project Payment</option>
              <option value="retainer">Monthly Retainer</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1A0F2E] mb-2">
              Customer Email *
            </label>
            {clients.length > 0 ? (
              <select
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] [&>option]:bg-white [&>option]:text-[#1A0F2E]"
              >
                <option value="">Select a client...</option>
                {clients.map((client) => (
                  <option key={client.email} value={client.email}>
                    {client.display_name || client.email}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] placeholder:text-[#6B6785]"
                placeholder="client@example.com"
              />
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={creating}
            className="w-full bg-[#290D47] text-white px-4 py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating...' : 'Generate Payment Link'}
          </button>
        </form>
      )}
    </div>
  )
}
