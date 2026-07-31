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
      <section className="bg-white border border-[#290D47]/15 rounded-2xl p-6 h-fit shadow-sm">
        <h2 className="text-xl font-semibold text-[#1A0F2E] mb-2">Documents</h2>
        <p className="text-[#6B6785] text-sm mb-4">
          Shared artifacts for our work together — logos, photos, briefs, and other files we both
          need to find again.
        </p>
        <PortalFileUpload projectId={project.id} />
      </section>

      <section className="bg-white border border-[#290D47]/15 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-[#1A0F2E] mb-4">Shared with you</h3>
        <div className="space-y-3">
          {signedUrls.map((file) => (
            <div key={file.id} className="bg-[#F8F7F5] border border-[#E8E4EF] rounded-lg p-4">
              <div className="flex flex-wrap gap-3 justify-between">
                <div>
                  <p className="text-[#1A0F2E] font-medium">{file.file_name}</p>
                  <p className="text-[#6B6785] text-xs mt-1 uppercase">{file.category}</p>
                  <p className="text-[#6B6785] text-xs mt-1">
                    {file.file_size ? `${Math.ceil(file.file_size / 1024)} KB` : 'Unknown size'} ·{' '}
                    {new Date(file.created_at).toLocaleString()}
                  </p>
                </div>
                {file.signedUrl ? (
                  <a
                    href={file.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-lg bg-[#00F5E4] text-[#1A0F2E] hover:opacity-90 h-fit font-medium"
                  >
                    Download
                  </a>
                ) : (
                  <span className="text-[#6B6785] text-sm h-fit">Unavailable</span>
                )}
              </div>
            </div>
          ))}
          {!signedUrls.length && (
            <p className="text-[#6B6785] text-sm">
              No documents yet. Upload anything we should both be able to find here.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
