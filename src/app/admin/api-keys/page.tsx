'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

type Source = {
  id: string
  name: string
  description: string | null
  is_active: boolean
  notifications: boolean
}

// Connect to RND Supabase project
const rndSupabase = createBrowserClient(
  'https://leqhkrxarvsayegblofq.supabase.co',
  'sb_publishable_tk8tIAtG5Wlc6Kul9rI1ZA_yGHv2WDk'
)

export default function GenerateApiKeyPage() {
  const [sources, setSources] = useState<Source[]>([])
  const [selectedSourceId, setSelectedSourceId] = useState('')
  const [keyName, setKeyName] = useState('')
  const [generatedKey, setGeneratedKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingSources, setLoadingSources] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadSources()
  }, [])

  async function loadSources() {
    setLoadingSources(true)
    const { data, error } = await rndSupabase
      .from('sources')
      .select('id, name, description, is_active, notifications')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('Error loading sources:', error)
      setError('Failed to load sources')
    } else if (data) {
      setSources(data)
      if (data.length > 0) {
        setSelectedSourceId(data[0].id)
      }
    }
    setLoadingSources(false)
  }

  async function generateKey() {
    if (!selectedSourceId || !keyName.trim()) {
      setError('Please select a source and enter a key name')
      return
    }

    setLoading(true)
    setError('')
    setGeneratedKey('')

    try {
      // Generate a random API key
      const prefix = 'rnd'
      const sourceShort = sources.find(s => s.id === selectedSourceId)?.name.toLowerCase().replace(/\s+/g, '_') || 'key'
      const version = 'v1'
      const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(24)))
        .map(b => b.toString(36))
        .join('')
        .substring(0, 32)
      
      const apiKey = `${prefix}_${sourceShort}_${version}_${randomPart}`

      // Hash the key for storage
      const encoder = new TextEncoder()
      const data = encoder.encode(apiKey)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

      // Store in database
      const { error: insertError } = await rndSupabase
        .from('source_api_keys')
        .insert({
          source_id: selectedSourceId,
          key_hash: keyHash,
          name: keyName.trim(),
          active: true
        })

      if (insertError) {
        console.error('Error storing API key:', insertError)
        setError('Failed to generate API key')
      } else {
        setGeneratedKey(apiKey)
        setKeyName('')
      }
    } catch (err) {
      console.error('Error generating key:', err)
      setError('An error occurred while generating the key')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setGeneratedKey('')
    setKeyName('')
  }

  if (loadingSources) {
    return (
      <div className="max-w-2xl mx-auto">
        <p className="text-[#6B6785]">Loading sources...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white border border-[#290D47]/15 rounded-2xl p-8 shadow-sm">
        <h1 className="text-3xl font-bold mb-6 text-[#1A0F2E]">
          Generate API Key
        </h1>

        {!generatedKey ? (
          <>
            <div className="mb-6">
              <label htmlFor="source" className="block text-sm font-medium text-[#1A0F2E] mb-2">
                Source
              </label>
              <select
                id="source"
                value={selectedSourceId}
                onChange={(e) => setSelectedSourceId(e.target.value)}
                className="w-full px-3 py-2 border border-[#E8E4EF] rounded-lg text-[#1A0F2E] focus:outline-none focus:border-[#290D47] [&>option]:bg-white [&>option]:text-[#1A0F2E]"
                disabled={loading}
              >
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label htmlFor="keyName" className="block text-sm font-medium text-[#1A0F2E] mb-2">
                Key Name
              </label>
              <input
                type="text"
                id="keyName"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="Manual API Testing"
                className="w-full px-3 py-2 border border-[#E8E4EF] rounded-lg text-[#1A0F2E] placeholder:text-[#6B6785] focus:outline-none focus:border-[#290D47]"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={generateKey}
              disabled={loading || !selectedSourceId || !keyName.trim()}
              className="w-full bg-[#290D47] text-white py-2 px-4 rounded-lg hover:opacity-90 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Generating...' : 'Generate API Key'}
            </button>
          </>
        ) : (
          <>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-800 font-semibold">
                    Copy this key now. It will never be shown again.
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-6 p-4 bg-[#F8F7F5] border border-[#E8E4EF] rounded-xl">
              <code className="text-sm font-mono text-[#1A0F2E] break-all">
                {generatedKey}
              </code>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedKey)
                }}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
              >
                Copy to Clipboard
              </button>
              <button
                onClick={resetForm}
                className="flex-1 bg-white border border-[#E8E4EF] text-[#1A0F2E] py-2 px-4 rounded-lg hover:bg-[#F8F7F5] transition-colors"
              >
                Generate Another
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
