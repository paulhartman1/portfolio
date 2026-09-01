import { Html, Head, Main, NextScript } from 'next/document'

// next-pwa still asks Next.js for the legacy document during production
// page-data collection, even though the application uses the App Router.
// Keep this minimal so it supplies that required module without changing the
// App Router's root layout or page markup.
export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
