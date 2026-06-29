'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabaseBrowser } from '@/utils/supabase/client'

type Payment = {
  id: string
  project_id: string
  stripe_session_id: string | null
  stripe_payment_id: string | null
  amount: number
  currency: string
  status: string
  payment_type: string
  description: string | null
  customer_email: string
  paid_at: string | null
  created_at: string
  project: {
    name: string
  } | null
}

export default function AdminPaymentsPage() {
  const searchParams = useSearchParams()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  
  const sessionId = searchParams.get('session_id')
  const success = searchParams.get('success')

  useEffect(() => {
    loadPayments()
  }, [])

  async function loadPayments() {
    const { data, error } = await supabaseBrowser
      .from('payments')
      .select(`
        id,
        project_id,
        stripe_session_id,
        stripe_payment_id,
        amount,
        currency,
        status,
        payment_type,
        description,
        customer_email,
        paid_at,
        created_at,
        project:project_id (
          name
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading payments:', error)
      setLoading(false)
      return
    }

    // Normalize the project data (could be array from join)
    const normalized = (data as any[]).map((payment) => ({
      ...payment,
      project: Array.isArray(payment.project) ? payment.project[0] : payment.project,
    }))

    setPayments(normalized)
    setLoading(false)
  }

  const filteredPayments = payments.filter((payment) => {
    if (statusFilter === 'all') return true
    return payment.status === statusFilter
  })

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100)
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      failed: 'bg-red-100 text-red-800 border-red-200',
      refunded: 'bg-gray-100 text-gray-800 border-gray-200',
    }
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <div className="text-white text-center py-12">Loading payments...</div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Payments</h1>
        <p className="text-white/80">View and manage all project payments</p>
      </div>

      {success && sessionId && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <h3 className="text-green-800 font-semibold mb-1">✓ Payment Successful</h3>
          <p className="text-green-700 text-sm">
            The payment has been completed. The client will receive a receipt from Stripe.
          </p>
        </div>
      )}

      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        {/* Filters */}
        <div className="mb-6 flex gap-2">
          {['all', 'pending', 'completed', 'failed', 'refunded'].map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === filter
                  ? 'bg-white/20 text-white'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>

        {/* Payments Table */}
        {filteredPayments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/60">No payments found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/20 text-left">
                  <th className="pb-3 text-white/70 font-medium text-sm">Project</th>
                  <th className="pb-3 text-white/70 font-medium text-sm">Amount</th>
                  <th className="pb-3 text-white/70 font-medium text-sm">Customer</th>
                  <th className="pb-3 text-white/70 font-medium text-sm">Type</th>
                  <th className="pb-3 text-white/70 font-medium text-sm">Status</th>
                  <th className="pb-3 text-white/70 font-medium text-sm">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} className="border-b border-white/10">
                    <td className="py-4">
                      <Link
                        href={`/admin/projects/${payment.project_id}`}
                        className="text-blue-200 hover:text-blue-100 font-medium"
                      >
                        {payment.project?.name || 'Unknown Project'}
                      </Link>
                      {payment.description && (
                        <p className="text-white/50 text-xs mt-1">{payment.description}</p>
                      )}
                    </td>
                    <td className="py-4 text-white font-mono">
                      {formatAmount(payment.amount, payment.currency)}
                    </td>
                    <td className="py-4 text-white/80 text-sm">{payment.customer_email}</td>
                    <td className="py-4">
                      <span className="text-white/70 text-sm capitalize">
                        {payment.payment_type}
                      </span>
                    </td>
                    <td className="py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold uppercase border ${getStatusBadge(
                          payment.status
                        )}`}
                      >
                        {payment.status}
                      </span>
                    </td>
                    <td className="py-4 text-white/70 text-sm">
                      {payment.paid_at
                        ? new Date(payment.paid_at).toLocaleDateString()
                        : new Date(payment.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
