import type { Metadata } from 'next'
import { Bricolage_Grotesque, Fragment_Mono, Instrument_Sans } from 'next/font/google'
import './globals.css'
import { SITE_DESCRIPTION, SITE_URL } from '@/lib/site'

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
  metadataBase: new URL(SITE_URL),
  title: { default: 'UtilityLab · Stated choice experiment designer', template: '%s · UtilityLab' },
  description: SITE_DESCRIPTION,
  applicationName: 'UtilityLab',
  authors: [{ name: 'Ioannis Tsouros', url: 'https://github.com/acesonic7' }],
  keywords: [
    'stated choice experiment',
    'discrete choice experiment',
    'stated preference',
    'experimental design',
    'D-efficient design',
    'choice modelling',
    'Qualtrics',
    'LimeSurvey',
  ],
  openGraph: {
    type: 'website',
    siteName: 'UtilityLab',
    title: 'UtilityLab · Stated choice experiment designer',
    description: SITE_DESCRIPTION,
    url: '/',
    locale: 'en',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UtilityLab · Stated choice experiment designer',
    description: SITE_DESCRIPTION,
  },
}

// Runs before paint so a stored theme never flashes the other one. Without a stored override the
// page follows the system. The old key held any past choice, so dropping it resets everyone to system once.
const themeScript = `(function(){try{localStorage.removeItem('utilitylab:theme');var t=localStorage.getItem('utilitylab:theme-override');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}})();`

// Also before paint: marks a browser with no saved study, so the shell skeleton stays hidden
// and the landing screen opens on a clean page. Mirrors hasStoredStudies in lib/library.
const firstVisitScript = `(function(){var n=0;try{var s=localStorage;for(var i=0;i<s.length;i++){var k=s.key(i)||'';if(k==='utilitylab:project'||k.indexOf('utilitylab:study:')===0){n=1;break}}}catch(e){}if(!n)document.documentElement.setAttribute('data-first-visit','')})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${ui.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript + firstVisitScript }} />
      </head>
      <body className="bg-paper text-ink font-sans antialiased">{children}</body>
    </html>
  )
}
