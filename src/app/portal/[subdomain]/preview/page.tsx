import { getPortalContext } from '../_lib'
import PreviewWorkspace from './PreviewWorkspace'

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain } = await params
  const { project, supabase, hasAccess } = await getPortalContext(subdomain)

  if (!hasAccess) return null

  const { data: comments } = await supabase
    .from('review_comments')
    .select('id, url, comment_text, priority, status, created_at, x_position, y_position, viewport_width')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })
    .limit(50)
  return (
    <PreviewWorkspace
      projectId={project.id}
      projectName={project.name}
      previewUrl={project.url}
      subdomain={subdomain}
      initialComments={comments || []}
    />
  )
}
