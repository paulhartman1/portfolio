
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
    <section id="about" className="py-20 px-4 sm:px-6 lg:px-8 ">
      <div className="max-w-7xl mx-auto ">
        <div className="text-center mb-16 ">
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">
            About Me
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-pink-400 to-purple-400 mx-auto rounded-full"></div>
        </div>
        <div className="grid lg:grid-cols-3 gap-8  ">
          <div className="lg:col-span-2 space-y-6 backdrop-blur-sm  rounded-xl  shadow-lg">
            <p className={`text-lg text-white/100 leading-relaxed`}>
              I&apos;m passionate about building technology that welcomes everyone. As an advocate for inclusive design
              and collaborative development, I believe the best solutions come from diverse perspectives working together.
              My approach combines technical excellence with empathy, ensuring every user feels valued and empowered.
            </p>
            <p className="text-lg text-white/100 leading-relaxed">
              Beyond code, I&apos;m dedicated to fostering communities where all voices are heard. Whether mentoring new developers,
              contributing to accessibility initiatives, or creating spaces for meaningful connection, I&apos;m committed to
              using technology as a force for positive change. Together, we can build a more inclusive digital world! 🌈
            </p>
          </div>
          <div className="relative">
            <div className="relative w-full h-80 rounded-xl overflow-hidden shadow-xl hidden lg:block ">
              <Image
                src="/aiheadshot.png"
                alt="About me"
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