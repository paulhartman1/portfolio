// page.tsx
'use client'
import { useState, useEffect } from 'react'



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