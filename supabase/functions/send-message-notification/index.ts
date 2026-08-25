// Triggered by a Postgres AFTER INSERT trigger on public.client_messages
// (see supabase/migrations/*_add_message_email_notifications.sql).
//
// Two directions:
//   - Admin sent the message  -> email the client(s) the admin explicitly
//     selected via `notify_recipient_ids` (opt-in, per message).
//   - Client sent the message -> email the project's `notification_email`,
//     if one is set.
//
// Auth: this function does not verify a Supabase JWT (verify_jwt = false in
// config.toml). Instead the calling trigger attaches a shared secret header
// (`x-webhook-secret`) that must match the WEBHOOK_SECRET function secret.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET')
const RESEND_PORTAL_API_KEY = Deno.env.get('RESEND_PORTAL_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://loveondev.com'
const FROM_ADDRESS = Deno.env.get('NOTIFICATION_FROM_ADDRESS') ?? 'paul@loveondev.com'

type MessagePayload = {
  id: string
  project_id: string
  sender_id: string
  message: string
  created_at: string
  notify_recipient_ids: string[] | null
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function sendEmail(to: string[], subject: string, html: string) {
  if (!RESEND_PORTAL_API_KEY) {
    console.error('RESEND_PORTAL_API_KEY is not set; skipping email send.')
    return
  }
  if (to.length === 0) return

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_PORTAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    console.error(`Resend send failed (${response.status}): ${body}`)
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const providedSecret = req.headers.get('x-webhook-secret')
  if (!WEBHOOK_SECRET || providedSecret !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return new Response('Server misconfigured', { status: 500 })
  }

  let payload: MessagePayload
  try {
    payload = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const [{ data: sender }, { data: project }] = await Promise.all([
    supabase.from('profiles').select('id, display_name, email, is_admin').eq('id', payload.sender_id).maybeSingle(),
    supabase
      .from('projects')
      .select('id, name, subdomain, notification_email')
      .eq('id', payload.project_id)
      .maybeSingle(),
  ])

  if (!sender || !project) {
    console.error('Could not resolve sender or project for message', payload.id)
    return new Response('Not found', { status: 200 })
  }

  const senderName = sender.display_name || sender.email || 'Someone'
  const messageHtml = escapeHtml(payload.message).replace(/\n/g, '<br />')

  if (sender.is_admin) {
    const recipientIds = payload.notify_recipient_ids ?? []
    if (recipientIds.length === 0) {
      return new Response('No recipients selected; nothing to send.', { status: 200 })
    }

    const { data: recipients } = await supabase
      .from('profiles')
      .select('id, email, display_name')
      .in('id', recipientIds)

    const emails = (recipients ?? []).map((r) => r.email).filter(Boolean) as string[]

    const portalLink = project.subdomain
      ? `${SITE_URL}/portal/${project.subdomain}/messages`
      : SITE_URL

    await sendEmail(
      emails,
      `New message on ${project.name}`,
      `
        <p><strong>${escapeHtml(senderName)}</strong> sent a new message on <strong>${escapeHtml(project.name)}</strong>:</p>
        <blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #290D47;background:#F8F7F5;">${messageHtml}</blockquote>
        <p><a href="${portalLink}">View and reply in your project portal</a></p>
      `
    )

    return new Response('Client notification sent.', { status: 200 })
  }

  // Sender is a client -> notify the project's business notification address.
  if (!project.notification_email) {
    return new Response('No notification_email configured for this project; nothing to send.', { status: 200 })
  }

  const adminLink = `${SITE_URL}/admin/projects/${project.id}`

  await sendEmail(
    [project.notification_email],
    `New client message on ${project.name}`,
    `
      <p><strong>${escapeHtml(senderName)}</strong> sent a new message on <strong>${escapeHtml(project.name)}</strong>:</p>
      <blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #290D47;background:#F8F7F5;">${messageHtml}</blockquote>
      <p><a href="${adminLink}">View and reply in the admin dashboard</a></p>
    `
  )

  return new Response('Project notification sent.', { status: 200 })
})
