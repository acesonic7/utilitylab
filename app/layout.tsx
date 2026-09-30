import type { Metadata } from 'next'
import { Bricolage_Grotesque, Fragment_Mono, Instrument_Sans } from 'next/font/google'
import './globals.css'

const display = Bricolage_Grotesque({
  subsets: ['latin', 'latin-ext'],
  axes: ['opsz', 'wdth'],
  variable: '--f-display',
  display: 'swap',
})

const ui = Instrument_Sans({
  subsets: ['latin', 'latin-ext'],
  axes: ['wdth'],
  variable: '--f-ui',
  display: 'swap',
})

const mono = Fragment_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: '400',
  variable: '--f-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'UtilityLab', template: '%s · UtilityLab' },
  description: 'Stated choice experiment designer',
}

// Runs before paint so a stored theme never flashes the other one. Without a stored override the
// page follows the system. The old key held any past choice, so dropping it resets everyone to system once.
const themeScript = `(function(){try{localStorage.removeItem('utilitylab:theme');var t=localStorage.getItem('utilitylab:theme-override');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${ui.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-paper text-ink font-sans antialiased">{children}</body>
    </html>
  )
}
