'use client'

import { redirect } from 'next/navigation'
import { useEffect } from 'react'

export default function ClientsRedirect() {
  useEffect(() => {
    redirect('/admin')
  }, [])

  return null
}
