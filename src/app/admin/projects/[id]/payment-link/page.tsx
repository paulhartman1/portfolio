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
  const projectId = params.id as string

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

  const canceled = searchParams.get('canceled')

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
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto">
          <p className="text-red-600">{error || 'Project not found'}</p>
          <Link href="/admin/projects" className="text-blue-600 hover:underline mt-4 inline-block">
            ← Back to Projects
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href={`/admin/projects/${projectId}`} className="text-blue-600 hover:underline">
            ← Back to {project.name}
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-2">Create Payment Link</h1>
        <p className="text-gray-600 mb-8">
          Generate a Stripe Checkout link for <strong>{project.name}</strong>
        </p>

        {canceled && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-6">
            <p className="text-yellow-800">Payment was canceled</p>
          </div>
        )}

        {checkoutUrl ? (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-green-600">✓ Payment Link Created</h2>
            
            <div className="bg-gray-50 p-4 rounded mb-4 break-all">
              <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                {checkoutUrl}
              </a>
            </div>

            <div className="flex gap-3">
              <button
                onClick={copyToClipboard}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Copy Link
              </button>
              <button
                onClick={() => setCheckoutUrl('')}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
              >
                Create Another
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateLink} className="bg-white rounded-lg shadow p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Amount (USD) *
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="5000.00"
              />
              <p className="text-sm text-gray-500 mt-1">Enter amount in dollars (e.g., 5000 for $5,000)</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Description *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={3}
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="Project kickoff payment for..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Payment Type *
              </label>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as 'project' | 'retainer')}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="project">Project Payment</option>
                <option value="retainer">Monthly Retainer</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Customer Email *
              </label>
              {clients.length > 0 ? (
                <select
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2"
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
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="client@example.com"
                />
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-4">
                <p className="text-red-800">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={creating}
              className="w-full bg-blue-600 text-white px-4 py-3 rounded font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating...' : 'Generate Payment Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
