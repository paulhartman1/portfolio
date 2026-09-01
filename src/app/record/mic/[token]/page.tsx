import MicRecorderClient from './MicRecorderClient'

// Deliberately outside /admin and /portal -- this page must be reachable
// from a phone with no CGT login at all. Everything it needs (which
// recording, whether the link is still valid) comes from the token itself.
export default async function PhoneMicPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <MicRecorderClient token={token} />
}
