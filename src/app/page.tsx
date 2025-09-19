// page.tsx
'use client'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import About from './components/about'
const AnimatedTitle = () => {
  const roles = [
    { text: 'ally', article: 'an' },
    { text: 'developer', article: 'a' },
    { text: 'father', article: 'a' },
    { text: 'musician', article: 'a' },
    { text: 'friend', article: 'a' }
  ]

  const [currentIndex, setCurrentIndex] = useState(0)


  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % roles.length)
    }, 1500)


    return () => clearInterval(interval)
  }, [])

  return (
    <h1 className="text-5xl lg:text-7xl font-bold  leading-tight bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-indigo-500 inline-block text-transparent bg-clip-text transition-all duration-5">
      Hi! I&apos;m {roles[currentIndex].article}
      <span className=" ">
         &nbsp;{roles[currentIndex].text}
      </span>
    </h1>
  )
}

export default function Home() {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-gradient-to-br from-black-900 from-40%  to-purple-900 to-90%" >

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 backdrop-blur-md bg-white/10 border-b border-white/20">
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
              <a href="#about" className="text-white/80 hover:text-white transition-colors">About</a>
              <a href="#skills" className="text-white/80 hover:text-white transition-colors">Skills</a>
              <a href="#contact" className="text-white/80 hover:text-white transition-colors">Contact</a>
              <a href="/auth/login" className="text-white/80 hover:text-white transition-colors">Login</a>
            </div>
          </div>
        </div>
      </nav>

       <section className="pt-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <AnimatedTitle />
                <p className="text-2xl text-white/100 leading-relaxed">
                  Building inclusive digital spaces where everyone belongs. 
                  Passionate about collaborative development, accessible design, and creating technology that brings people together
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button className="z-10 px-8 py-4 border-1 border-green-500 text-white font-semibold rounded-full hover:bg-gradient-to-br from-purple-600 via-green-900 to-pink-900 hover:scale-105 transition-transform shadow-lg" onClick={() => {
                  router.push('/auth/login')
                }}>
                  Let&apos;s Collaborate
                </button>
                <button className="px-8 py-4 border-1 border-yellow-500 text-white font-semibold rounded-full hover:bg-gradient-to-br via-orange-900 to-red-800   hover:scale-105 transition-transform shadow-lg" onClick={() => {
                  router.push('/auth/login')
                }}>
                  Join the Community
                </button>
              </div>
            </div>
       
          </div>
        </div>
      </section>
   
   <About />
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
                key={skill.name || index}
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
    </div>
  )
}