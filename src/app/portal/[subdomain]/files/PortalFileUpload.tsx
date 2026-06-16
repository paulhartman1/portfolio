'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/utils/supabase/client'

type Props = {
  projectId: string
}

export default function PortalFileUpload({ projectId }: Props) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState('other')
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!file) return

    setUploading(true)
    setMessage(null)

    const {
      data: { user },
    } = await supabaseBrowser.auth.getUser()

    if (!user) {
      setMessage('You must be logged in to upload files.')
      setUploading(false)
      return
    }

    const safeName = file.name.replace(/\s+/g, '-')
    const objectPath = `${projectId}/${Date.now()}-${safeName}`

    const { error: uploadError } = await supabaseBrowser.storage
      .from('client-files')
      .upload(objectPath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      setMessage(uploadError.message)
      setUploading(false)
      return
    }

    const { error: insertError } = await supabaseBrowser.from('project_files').insert({
      project_id: projectId,
      uploader_id: user.id,
      file_name: file.name,
      file_path: objectPath,
      bucket_name: 'client-files',
      category,
      mime_type: file.type || null,
      file_size: file.size,
    })

    if (insertError) {
      setMessage(insertError.message)
      setUploading(false)
      return
    }

    setFile(null)
    setMessage('File uploaded successfully.')
    setUploading(false)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="block text-white/80 text-sm mb-1">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white [&>option]:bg-gray-900"
        >
          <option value="logos">Logos</option>
          <option value="photos">Photos</option>
          <option value="copy">Copy</option>
          <option value="brand">Brand docs</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div>
        <label className="block text-white/80 text-sm mb-1">File</label>
        <input
          type="file"
          required
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white file:mr-4 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-white/20 file:text-white"
        />
      </div>

      <button
        type="submit"
        disabled={uploading || !file}
        className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold disabled:opacity-60"
      >
        {uploading ? 'Uploading...' : 'Upload file'}
      </button>

      {message && <p className="text-white/80 text-sm">{message}</p>}
    </form>
  )
}
