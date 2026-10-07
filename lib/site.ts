// The public address used in link previews, robots.txt and the sitemap. Set NEXT_PUBLIC_SITE_URL
// when the app moves to its own domain.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://utilitylab-ten.vercel.app').replace(/\/+$/, '')

export const SITE_DESCRIPTION =
  'Design, check and export stated choice experiments in the browser: D-efficient designs, diagnostics and ready-to-field Qualtrics and LimeSurvey surveys. Free and open source.'
