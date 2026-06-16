import PortalFileUpload from './PortalFileUpload'
import { getPortalContext } from '../_lib'

export default async function FilesPage({
  params,
}: {
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain } = await params
  const { project, supabase, hasAccess } = await getPortalContext(subdomain)

  if (!hasAccess) return null

  const { data: files } = await supabase
    .from('project_files')
    .select('id, file_name, file_path, bucket_name, category, created_at, file_size')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })

  const signedUrls = await Promise.all(
    (files || []).map(async (file) => {
      const { data } = await supabase.storage
        .from(file.bucket_name)
        .createSignedUrl(file.file_path, 60 * 60)

      return {
        ...file,
        signedUrl: data?.signedUrl ?? null,
      }
    })
  )

  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-6">
      <section className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 h-fit">
        <h2 className="text-xl font-semibold text-white mb-2">Upload files</h2>
        <p className="text-white/75 text-sm mb-4">
          Share logos, photos, copy docs, and brand assets for your project.
        </p>
        <PortalFileUpload projectId={project.id} />
      </section>

      <section className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Shared files</h3>
        <div className="space-y-3">
          {signedUrls.map((file) => (
            <div key={file.id} className="bg-white/5 border border-white/20 rounded-lg p-4">
              <div className="flex flex-wrap gap-3 justify-between">
                <div>
                  <p className="text-white font-medium">{file.file_name}</p>
                  <p className="text-white/70 text-xs mt-1 uppercase">{file.category}</p>
                  <p className="text-white/60 text-xs mt-1">
                    {file.file_size ? `${Math.ceil(file.file_size / 1024)} KB` : 'Unknown size'} ·{' '}
                    {new Date(file.created_at).toLocaleString()}
                  </p>
                </div>
                {file.signedUrl ? (
                  <a
                    href={file.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-lg bg-white/20 text-white hover:bg-white/30 h-fit"
                  >
                    Download
                  </a>
                ) : (
                  <span className="text-white/60 text-sm h-fit">Unavailable</span>
                )}
              </div>
            </div>
          ))}
          {!signedUrls.length && (
            <p className="text-white/70 text-sm">
              No files yet. Upload assets here so everything stays in one place.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
