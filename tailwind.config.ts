import type { Config } from 'tailwindcss'

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  // `dark:` follows the same rule as the tokens: explicit data-theme wins, otherwise the OS preference.
  darkMode: [
    'variant',
    [
      '@media (prefers-color-scheme: dark) { &:not([data-theme="light"] *) }',
      '&:is([data-theme="dark"] *)',
    ],
  ],
  theme: {
    extend: {
      colors: {
        paper: token('paper'),
        surface: {
          DEFAULT: token('surface'),
          2: token('surface-2'),
          3: token('surface-3'),
        },
        ink: {
          DEFAULT: token('ink'),
          2: token('ink-2'),
          3: token('ink-3'),
          4: token('ink-4'),
        },
        line: {
          DEFAULT: token('line'),
          2: token('line-2'),
        },
        accent: {
          DEFAULT: token('accent'),
          edge: token('accent-edge'),
          ink: token('accent-ink'),
        },
        alt: {
          1: token('alt-1'),
          2: token('alt-2'),
          3: token('alt-3'),
          4: token('alt-4'),
          5: token('alt-5'),
          6: token('alt-6'),
          x: token('alt-x'),
        },
        risk: { DEFAULT: token('risk'), bg: token('risk-bg') },
        caution: { DEFAULT: token('caution'), bg: token('caution-bg') },
        ok: { DEFAULT: token('ok'), bg: token('ok-bg') },
      },
      fontFamily: {
        display: ['var(--f-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['var(--f-ui)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--f-mono)', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
      fontSize: {
        '12': ['12px', '16px'],
        '13': ['13px', '18px'],
        '14': ['14px', '20px'],
        '16': ['16px', '22px'],
        '20': ['20px', '26px'],
        '26': ['26px', '32px'],
        '30': ['30px', '34px'],
        '34': ['34px', '38px'],
        '42': ['42px', '46px'],
      },
      letterSpacing: {
        display: '-0.03em',
        title: '-0.022em',
        stat: '-0.02em',
        caps: '0.05em',
      },
      borderRadius: {
        bar: '3px',
        tick: '4px',
        ctl: '6px',
        well: '8px',
        card: '10px',
        panel: '12px',
        hero: '16px',
        pill: '999px',
      },
      boxShadow: {
        hairline: '0 0 0 1px rgb(var(--line))',
        'hairline-2': '0 0 0 1px rgb(var(--line-2))',
        // Raised already includes the hairline ring, as on the respondent card.
        raised: '0 0 0 1px rgb(var(--line)), var(--e-raised)',
        pressed: '0 0 0 1px rgb(var(--line-2)), 0 1px 2px rgb(var(--ink) / 0.06)',
      },
    },
  },
  plugins: [],
}
export default config
