// page.tsx
'use client'
import { useState } from 'react'
import Image from 'next/image'
import About from './components/about'
import QuickHelpForm from './components/quick-help-form'

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showHelpForm, setShowHelpForm] = useState(false)

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
            
            {/* Desktop Menu */}
            <div className="hidden md:flex space-x-8">
              <a href="#about" className="text-slate-200 hover:text-purple-400 transition-colors font-medium">About</a>
              <a href="#services" className="text-slate-200 hover:text-purple-400 transition-colors font-medium">Services</a>
              <a href="https://tidycal.com/loveondev" target='_blank' className="text-slate-200 hover:text-purple-400 transition-colors font-medium">Get Help</a>
            </div>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-slate-200 hover:text-purple-400 transition-colors p-2"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-slate-700/50">
              <div className="flex flex-col space-y-4">
                <a 
                  href="#about" 
                  className="text-slate-200 hover:text-purple-400 transition-colors font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  About
                </a>
                <a 
                  href="#services" 
                  className="text-slate-200 hover:text-purple-400 transition-colors font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Services
                </a>
                <a 
                  href="https://tidycal.com/loveondev" 
                  target='_blank' 
                  className="text-slate-200 hover:text-purple-400 transition-colors font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Get Help
                </a>
              </div>
            </div>
          )}
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
                  Your Neighborhood Tech Person
                </h2>
                <p className="text-xl md:text-2xl text-slate-600 leading-relaxed max-w-3xl mx-auto">
                  Hi, I&apos;m Paul—a local software engineer helping people with WiFi, home automation, tech fixes, and small business tech support.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button 
                  className="z-10 px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-full hover:from-purple-700 hover:to-indigo-700 hover:scale-105 transition-all shadow-lg hover:shadow-xl" 
                  onClick={() => setShowHelpForm(true)}
                >
                  Get Help Now
                </button>
                <button 
                  className="px-8 py-4 border-2 border-purple-600 text-purple-600 font-semibold rounded-full hover:bg-purple-600 hover:text-white hover:scale-105 transition-all shadow-md" 
                  onClick={() => window.open('https://tidycal.com/loveondev', '_blank')}
                >
                  Meet With Me
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      <About />
      
      {showHelpForm && <QuickHelpForm onClose={() => setShowHelpForm(false)} />}
      
      <section id="services" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
              How I Can Help
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-6">
              Most jobs take 1-2 hours. First diagnostic is free—I&apos;ll figure out what&apos;s wrong and give you a quote before doing any work.
            </p>
            <div className="w-24 h-1 bg-gradient-to-r from-purple-600 to-indigo-600 mx-auto rounded-full"></div>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {[
              { 
                icon: '📶',
                name: 'WiFi Setup & Troubleshooting', 
                description: 'Slow internet? Dead zones? Unreliable connection? I\'ll get your WiFi working properly.',
                price: '$75-150',
                color: 'from-blue-400 to-cyan-400' 
              },
              { 
                icon: '🏠',
                name: 'Smart Home Setup', 
                description: 'Smart lights, thermostats, security cameras, voice assistants—I\'ll set it all up and show you how to use it.',
                price: '$100-300',
                color: 'from-purple-400 to-indigo-400' 
              },
              { 
                icon: '💳',
                name: 'Stripe Integration Help', 
                description: 'Need to accept payments on your website? Stripe checkout broken? I can fix it.',
                price: '$200-500',
                color: 'from-green-400 to-emerald-400' 
              },
              { 
                icon: '💻',
                name: 'General Tech Support', 
                description: 'Computer issues, printer setup, software problems, data backup—if it\'s tech, I can probably help.',
                price: '$75-150/hr',
                color: 'from-pink-400 to-rose-400' 
              },
            ].map((service, index) => (
              <div
                key={service.name || index}
                className="p-8 rounded-xl bg-white border border-slate-200 hover:border-purple-300 hover:shadow-xl transition-all duration-300 hover:scale-105"
              >
                <div className="text-5xl mb-4">{service.icon}</div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3">{service.name}</h3>
                <p className="text-lg text-slate-600 leading-relaxed mb-4">{service.description}</p>
                <p className="text-xl font-bold text-purple-600">{service.price}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}