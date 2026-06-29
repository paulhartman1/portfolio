import { Metadata } from 'next'
import Link from 'next/link'
import { getBlogPosts } from '@/lib/blog'

export const metadata: Metadata = {
  title: 'Blog | Love On Dev',
  description: 'Technical insights on building practical solutions for small businesses and nonprofits. Tips on web development, database design, and system integration.',
}

export default function BlogPage() {
  const posts = getBlogPosts()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-100">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 backdrop-blur-md bg-slate-900/95 border-b border-slate-700/50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
              Love On Dev
            </Link>
            <div className="flex space-x-8">
              <Link href="/" className="text-slate-200 hover:text-purple-400 transition-colors font-medium">
                Home
              </Link>
              <Link href="/blog" className="text-purple-400 font-medium">
                Blog
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 inline-block text-transparent bg-clip-text mb-4">
            Blog
          </h1>
          <p className="text-xl text-slate-600">
            Practical insights for humans and their businesses on navigating a complex digital world
          </p>
        </div>
      </section>

      {/* Blog Posts */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {posts.length === 0 ? (
            <div className="bg-white rounded-xl p-8 shadow-md text-center">
              <p className="text-slate-600 text-lg">No blog posts yet. Check back soon!</p>
            </div>
          ) : (
            <div className="space-y-8">
              {posts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="block bg-white rounded-xl p-8 shadow-md hover:shadow-xl transition-all hover:scale-[1.02]"
                >
                  <article>
                    <div className="flex items-center gap-4 text-sm text-slate-500 mb-3">
                      <time dateTime={post.date}>
                        {new Date(post.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </time>
                      <span>•</span>
                      <span>{post.readingTime}</span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3 hover:text-purple-600 transition-colors">
                      {post.title}
                    </h2>
                    <p className="text-lg text-slate-600 mb-4">{post.description}</p>
                    {post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {post.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
