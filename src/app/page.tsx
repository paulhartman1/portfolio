// page.tsx
'use client'
import Image from 'next/image'
import { useState, useEffect } from 'react'

const AnimatedTitle = () => {
  const roles = [
    { text: 'Ally', article: 'an' },
    { text: 'Developer', article: 'a' },
    { text: 'Father', article: 'a' },
    { text: 'Musician', article: 'a' },
    { text: 'Friend', article: 'a' }
  ]
  
  const [currentIndex, setCurrentIndex] = useState(0)
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % roles.length)
    }, 1500)
    
    return () => clearInterval(interval)
  }, [])
  
  return (
    <h1 className="text-5xl lg:text-7xl font-bold text-white leading-tight">
      Hi, I'm {roles[currentIndex].article}
      <span className="block bg-gradient-to-r from-pink-400 via-purple-400 via-blue-400 via-green-400 via-yellow-400 to-red-400 bg-clip-text text-transparent transition-all duration-500">
        {roles[currentIndex].text}
      </span>
    </h1>
  )
}

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 backdrop-blur-md bg-white/10 border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="text-2xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
              loveondev.com
            </div>
            <div className="hidden md:flex space-x-8">
              <a href="#about" className="text-white/80 hover:text-white transition-colors">About</a>
              <a href="#projects" className="text-white/80 hover:text-white transition-colors">Projects</a>
              <a href="#skills" className="text-white/80 hover:text-white transition-colors">Skills</a>
              <a href="#contact" className="text-white/80 hover:text-white transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <AnimatedTitle />
                <p className="text-xl text-white/80 leading-relaxed">
                  Building inclusive digital spaces where everyone belongs. 
                  Passionate about collaborative development, accessible design, and creating technology that brings people together.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <button className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold rounded-full hover:scale-105 transition-transform shadow-lg">
                  Let's Collaborate
                </button>
                <button className="px-8 py-4 border-2 border-white/30 text-white font-semibold rounded-full hover:bg-white/10 transition-colors">
                  Join the Community
                </button>
              </div>
            </div>
            <div className="relative">
              <div className="relative w-full h-96 lg:h-[500px] rounded-2xl overflow-hidden shadow-2xl">
                <Image
                  src="https://picsum.photos/500/600"
                  alt="Developer workspace"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-purple-900/50 to-transparent"></div>
              </div>
              {/* Floating elements */}
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-gradient-to-r from-pink-400 to-purple-400 rounded-full opacity-80 animate-bounce"></div>
              <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-gradient-to-r from-blue-400 to-green-400 rounded-full opacity-80 animate-pulse"></div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 px-4 sm:px-6 lg:px-8 bg-white/5 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">
              About Me
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-pink-400 to-purple-400 mx-auto rounded-full"></div>
          </div>
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <p className="text-lg text-white/80 leading-relaxed">
                I'm passionate about building technology that welcomes everyone. As an advocate for inclusive design 
                and collaborative development, I believe the best solutions come from diverse perspectives working together. 
                My approach combines technical excellence with empathy, ensuring every user feels valued and empowered.
              </p>
              <p className="text-lg text-white/80 leading-relaxed">
                Beyond code, I'm dedicated to fostering communities where all voices are heard. Whether mentoring new developers, 
                contributing to accessibility initiatives, or creating spaces for meaningful connection, I'm committed to 
                using technology as a force for positive change. Together, we can build a more inclusive digital world! 🌈
              </p>
            </div>
            <div className="relative">
              <div className="relative w-full h-80 rounded-xl overflow-hidden shadow-xl">
                <Image
                  src="https://picsum.photos/400/500"
                  alt="About me"
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Skills Section */}
      <section id="skills" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">
              Skills & Technologies
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-blue-400 to-green-400 mx-auto rounded-full"></div>
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
                key={skill.name}
                className="p-6 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105"
              >
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${skill.color} mb-4 flex items-center justify-center`}>
                  <div className="w-6 h-6 bg-white/30 rounded"></div>
                </div>
                <h3 className="text-white font-semibold text-lg">{skill.name}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Projects Section */}
      <section id="projects" className="py-20 px-4 sm:px-6 lg:px-8 bg-white/5 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">
              Collaborative Projects
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-green-400 to-blue-400 mx-auto rounded-full"></div>
            <p className="text-white/70 mt-4 max-w-2xl mx-auto">
              Projects built with diverse teams, focusing on accessibility, inclusion, and community impact
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { 
                title: 'Inclusive Learning Platform', 
                desc: 'Accessible education app with multi-language support and adaptive interfaces',
                impact: 'Serving 10,000+ learners globally'
              },
              { 
                title: 'Community Connection Hub', 
                desc: 'Safe space platform for underrepresented groups in tech to connect and collaborate',
                impact: 'Built with 12 volunteer developers'
              },
              { 
                title: 'Open Source Accessibility Toolkit', 
                desc: 'React components and tools for building more inclusive web applications',
                impact: '500+ GitHub stars, 15 contributors'
              },
            ].map((project, index) => (
              <div
                key={project.title}
                className="group rounded-xl overflow-hidden bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105"
              >
                <div className="relative h-48 overflow-hidden">
                  <Image
                    src={`https://picsum.photos/400/300?random=${index + 1}`}
                    alt={project.title}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-white mb-2">{project.title}</h3>
                  <p className="text-white/70 mb-2">{project.desc}</p>
                  <p className="text-sm text-green-400 mb-4 font-medium">{project.impact}</p>
                  <div className="flex gap-2">
                    <button className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white text-sm font-medium rounded-full hover:scale-105 transition-transform">
                      View Project
                    </button>
                    <button className="px-4 py-2 border border-white/30 text-white text-sm font-medium rounded-full hover:bg-white/10 transition-colors">
                      Contribute
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-8">
            Let's Build Together
          </h2>
          <p className="text-xl text-white/80 mb-12 leading-relaxed">
            Ready to create inclusive, accessible, and impactful technology? Join me in building solutions that welcome everyone and make a difference!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="px-8 py-4 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white font-semibold rounded-full hover:scale-105 transition-transform shadow-lg">
              Start Collaborating
            </button>
            <button className="px-8 py-4 border-2 border-white/30 text-white font-semibold rounded-full hover:bg-white/10 transition-colors">
              Join Our Community
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-black/20 backdrop-blur-sm border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-2xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent mb-4 md:mb-0">
              loveondev.com
            </div>
            <div className="flex gap-6">
              <a href="#" className="text-white/60 hover:text-white transition-colors">GitHub</a>
              <a href="#" className="text-white/60 hover:text-white transition-colors">LinkedIn</a>
              <a href="#" className="text-white/60 hover:text-white transition-colors">Twitter</a>
              <a href="#" className="text-white/60 hover:text-white transition-colors">Email</a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-white/10 text-center">
            <p className="text-white/60">
              © 2025 LoveOnDev. Made with 💜 and lots of rainbow magic 🌈
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}