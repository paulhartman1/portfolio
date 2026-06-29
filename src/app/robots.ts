import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/dashboard/', '/portal/', '/auth/'],
      },
    ],
    sitemap: 'https://loveondev.com/sitemap.xml',
  }
}
