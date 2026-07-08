
import Image from 'next/image'
import { useEffect } from 'react'
export default function About() {
  useEffect(() => {
    const section = document.getElementById('about')
    if (!section) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            document.body.classList.add('blend-darken')
          } else {
            document.body.classList.remove('blend-darken')
          }
        })
      },
      { threshold: 1 } // trigger when 30% visible
    )

    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="about" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent to-white">
      <div className="max-w-7xl mx-auto ">
        <div className="text-center mb-16 ">
          <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            About Me
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-pink-400 to-purple-400 mx-auto rounded-full"></div>
        </div>
        <div className="grid lg:grid-cols-3 gap-8  ">
          <div className="lg:col-span-2 space-y-6 p-8 bg-white rounded-xl border border-slate-200 shadow-lg">
            <p className={`text-lg text-slate-700 leading-relaxed`}>
              I&apos;m a software engineer with 10+ years of experience, but I&apos;m also your neighbor who gets it.
              Technology should just work—and when it doesn&apos;t, you shouldn&apos;t have to spend hours on hold or
              watch confusing YouTube tutorials. I show up, fix the problem, and explain it in plain English.
            </p>
            <p className="text-lg text-slate-700 leading-relaxed">
              Whether it&apos;s getting your WiFi to reach the back bedroom, setting up smart lights that actually turn on,
              or helping your small business accept payments online—I&apos;ve got you. No tech jargon, no judgment,
              just friendly help when you need it. <strong>First diagnostic is always free</strong>—I&apos;ll figure out what&apos;s wrong
              and give you a clear quote before doing any work.
            </p>
          </div>
          <div className="relative">
            <div className="relative w-full h-80 rounded-xl overflow-hidden border-4 border-white shadow-2xl hidden lg:block bg-gradient-to-br from-purple-50 to-indigo-100">
              <Image
                src="/aiheadshot.png"
                alt="Paul Hartman - Technical Consultant at Love On Dev"
                fill
                objectFit='contain'
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}