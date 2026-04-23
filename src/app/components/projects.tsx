import Link from 'next/link'

export default function Projects() {
  const projects = [
    {
      id: 1,
      title: 'Firehouse Arts',
      description: 'A vibrant community platform for artists and creators to collaborate, share work, and build inclusive creative spaces.',
      url: 'https://firehousearts.loveondev.com',
      tags: ['Community', 'Arts', 'Inclusive Design', 'React'],
      color: 'from-orange-400 to-red-400'
    },
    {
      id: 2,
      title: 'Rush N Dush',
      description: 'Fast-paced delivery and logistics platform designed with accessibility and user experience at its core.',
      url: 'https://rushndush.com',
      tags: ['Logistics', 'Delivery', 'UX Design', 'Performance'],
      color: 'from-blue-400 to-cyan-400'
    }
  ]

  return (
    <section id="projects" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent via-purple-900/20 to-transparent">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">
            Featured Projects
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-pink-400 to-orange-400 mx-auto rounded-full"></div>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8">
          {projects.map((project) => (
            <a
              key={project.id}
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group"
            >
              <div className="relative p-8 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/20 hover:border-white/40 hover:bg-gradient-to-br hover:from-white/15 hover:to-white/10 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/20 h-full flex flex-col">
                {/* Gradient accent */}
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${project.color} opacity-0 group-hover:opacity-10 rounded-full blur-3xl transition-opacity duration-300`}></div>
                
                <div className="relative z-10">
                  {/* Color indicator */}
                  <div className={`w-2 h-12 bg-gradient-to-b ${project.color} rounded-full mb-6`}></div>
                  
                  {/* Title */}
                  <h3 className="text-3xl font-bold text-white mb-3 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-pink-400 group-hover:to-orange-400 group-hover:bg-clip-text transition-all duration-300">
                    {project.title}
                  </h3>
                  
                  {/* Description */}
                  <p className="text-lg text-white/80 mb-6 group-hover:text-white/90 transition-colors duration-300">
                    {project.description}
                  </p>
                  
                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    {project.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 text-sm rounded-full bg-white/10 text-white/80 border border-white/20 group-hover:bg-white/20 group-hover:text-white transition-colors duration-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  
                  {/* Link indicator */}
                  <div className="flex items-center gap-2 text-white/60 group-hover:text-white transition-colors duration-300">
                    <span>Visit Project</span>
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
