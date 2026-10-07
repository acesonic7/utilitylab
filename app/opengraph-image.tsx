import { ImageResponse } from 'next/og'

export const alt = 'UtilityLab: design, check and export stated choice experiments in the browser'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const INK = '#14161A'
const PAPER = '#F3F3EF'
const CITRON = '#D3F15B'
const MUTED = '#9C9EA5'

// Matrix U: the mark from app/components/Logo.tsx, cell by cell.
const CELLS: [number, number, string][] = [
  [0, 0, PAPER],
  [0, 1, PAPER],
  [0, 2, CITRON],
  [1, 2, PAPER],
  [2, 0, PAPER],
  [2, 1, PAPER],
  [2, 2, PAPER],
]

function Mark({ px }: { px: number }) {
  const cell = px * 0.18
  const gap = px * 0.05
  const pad = (px - 3 * cell - 2 * gap) / 2
  return (
    <div style={{ width: px, height: px, borderRadius: px * 0.24, background: INK, position: 'relative', display: 'flex' }}>
      {CELLS.map(([c, r, color]) => (
        <div
          key={`${c}${r}`}
          style={{
            position: 'absolute',
            left: pad + c * (cell + gap),
            top: pad + r * (cell + gap),
            width: cell,
            height: cell,
            borderRadius: cell * 0.26,
            background: color,
          }}
        />
      ))}
    </div>
  )
}

const GLYPHS = ['#2F5FD0', '#E0592A', '#12926A', '#A8327E']

type Font = { name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' }

// The app's own faces, fetched once at build time. Without a browser user agent Google Fonts
// serves TrueType, which the image renderer reads; if the fetch fails the default font is used.
async function googleFont(family: string, weight: 400 | 700): Promise<Font | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}`)).text()
    const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1]
    if (!url) return null
    return { name: family, data: await (await fetch(url)).arrayBuffer(), weight, style: 'normal' }
  } catch {
    return null
  }
}

export default async function OpengraphImage() {
  const fonts = (
    await Promise.all([
      googleFont('Bricolage Grotesque', 700),
      googleFont('Bricolage Grotesque', 400),
      googleFont('Instrument Sans', 400),
    ])
  ).filter((f): f is Font => f !== null)
  const display = fonts.some((f) => f.name === 'Bricolage Grotesque') ? 'Bricolage Grotesque' : 'sans-serif'
  const text = fonts.some((f) => f.name === 'Instrument Sans') ? 'Instrument Sans' : 'sans-serif'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: PAPER,
          padding: '72px 80px',
          color: INK,
          fontFamily: text,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <Mark px={112} />
          <div style={{ display: 'flex', fontSize: 64, letterSpacing: -2, fontFamily: display }}>
            <span style={{ fontWeight: 700 }}>Utility</span>
            <span style={{ fontWeight: 400, color: '#44474F' }}>Lab</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ display: 'flex', fontSize: 58, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1.5, maxWidth: 1000, fontFamily: display }}>
            Design, check and export stated choice experiments.
          </div>
          <div style={{ display: 'flex', fontSize: 30, color: '#44474F', lineHeight: 1.35, maxWidth: 1000 }}>
            Efficient or random designs, diagnostics, and ready-to-field Qualtrics and LimeSurvey surveys, in the browser.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 26, color: '#62656E' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {GLYPHS.map((c) => (
              <div key={c} style={{ width: 18, height: 18, borderRadius: 9, background: c }} />
            ))}
            <span style={{ marginLeft: 10 }}>Free and open source</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: MUTED }} />
            <span>www.utilitylab.space</span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  )
}
