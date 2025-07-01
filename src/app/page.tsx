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
      Hi! I&apos;m {roles[currentIndex].article}
      <span className="block bg-gradient-to-r from-pink-400 via-purple-400 via-blue-400 via-green-400 via-yellow-400 to-red-400 bg-clip-text text-transparent transition-all duration-500">
        {roles[currentIndex].text}
      </span>
    </h1>
  )
}

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-900 via-purple-700 to-purple-500 p-8">
      <div className="max-w-2xl text-center text-white">
        <h1 className="text-5xl md:text-6xl font-extrabold mb-4 drop-shadow-lg">
          Paul Hartman
        </h1>
        <h2 className="text-2xl md:text-3xl mb-6 font-medium drop-shadow">
          Software Engineer • Mentor • Code Craftsman
        </h2>
        <p className="text-lg md:text-xl text-purple-100 mb-8">
          I build clean, human-centered software that helps people connect, 
          learn, and create. Specializing in communication, mentoring, and 
          transforming messy codebases into elegant systems.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <a
            href="#projects"
            className="rounded-xl bg-white/20 px-6 py-3 font-semibold text-purple-100 hover:bg-white/30 transition"
          >
            View Projects
          </a>
          <a
            href="#contact"
            className="rounded-xl border border-white/40 px-6 py-3 font-semibold text-purple-100 hover:bg-white/10 transition"
          >
            Contact Me
          </a>
        </div>
      </div>
    </main>
  )
}