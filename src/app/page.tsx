// page.tsx
'use client'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import About from './components/about'
import Projects from './components/projects'

export default function Home() {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-100" >

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 backdrop-blur-md bg-slate-900/95 border-b border-slate-700/50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="text-2xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
              <Image
                src="/logo.png"
                alt="Logo"
                className="object-cover rounded-full"
                width={60}
                height={60}
              />
            </div>
            <div className="hidden md:flex space-x-8">
              <a href="#about" className="text-slate-200 hover:text-purple-400 transition-colors font-medium">About</a>
              <a href="#projects" className="text-slate-200 hover:text-purple-400 transition-colors font-medium">Projects</a>
              <a href="#skills" className="text-slate-200 hover:text-purple-400 transition-colors font-medium">Skills</a>
              <a href="https://tidycal.com/loveondev" target='_blank' className="text-slate-200 hover:text-purple-400 transition-colors font-medium">Contact</a>
              <a href="/auth/login" className="text-slate-200 hover:text-purple-400 transition-colors font-medium">Login</a>
            </div>
          </div>
        </div>
      </nav>

      <section className="pt-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid items-center">
            <div className="space-y-8 text-center">
              <div className="space-y-6">
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 inline-block text-transparent bg-clip-text">
                  Love On Dev
                </h1>
                <h2 className="text-2xl md:text-3xl lg:text-4xl font-semibold text-slate-700 leading-tight">
                  Collaborative Technical Solutions for Mission-Driven Organizations
                </h2>
                <p className="text-xl md:text-2xl text-slate-600 leading-relaxed max-w-3xl mx-auto">
                  Hi, I&apos;m Paul Hartman—a technical consultant specializing in practical solutions for small businesses and nonprofits.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button className="z-10 px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-full hover:from-purple-700 hover:to-indigo-700 hover:scale-105 transition-all shadow-lg hover:shadow-xl" onClick={() => {
                  window.open('https://tidycal.com/loveondev', '_blank')
                }}>
                  Book a Discovery Call
                </button>
                <button className="px-8 py-4 border-2 border-purple-600 text-purple-600 font-semibold rounded-full hover:bg-purple-600 hover:text-white hover:scale-105 transition-all shadow-md" onClick={() => {
                  const servicesSection = document.getElementById('projects')
                  servicesSection?.scrollIntoView({ behavior: 'smooth' })
                }}>
                  View Services
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      <About />
      <Projects />
      <section id="skills" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
              Skills & Technologies
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-purple-600 to-indigo-600 mx-auto rounded-full"></div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'Inclusive Design', color: 'from-blue-400 to-cyan-400' },
              { name: 'Accessibility (WCAG)', color: 'from-green-400 to-emerald-400' },
              { name: 'Community Building', color: 'from-pink-400 to-rose-400' },
              { name: 'Mentorship', color: 'from-purple-400 to-indigo-400' },
              { name: 'React/Next.js', color: 'from-blue-500 to-purple-500' },
              { name: 'TypeScript', color: 'from-indigo-400 to-purple-400' },
              { name: 'Node.js', color: 'from-yellow-400 to-orange-400' },
              { name: 'Open Source', color: 'from-orange-400 to-red-400' },
            ].map((skill, index) => (
              <div
                key={skill.name || index}
                className="p-6 rounded-xl bg-gradient-to-br from-slate-50 to-white border border-slate-200 hover:border-purple-300 hover:shadow-lg transition-all duration-300 hover:scale-105"
              >
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${skill.color} mb-4 flex items-center justify-center`}>
                  <div className="w-6 h-6 bg-white/40 rounded"></div>
                </div>
                <h3 className="text-slate-800 font-semibold text-lg">{skill.name}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}