'use client'

import { useEffect, useState } from 'react'
import { SITE_URL } from '@/lib/site'
import { cx } from '../ui'

// The app used to live at this address. Browser storage belongs to one address, so studies saved
// here do not appear at the new one: they move as project files. Shown only on the old address.
const OLD_HOST = 'utilitylab-ten.vercel.app'

export function MovedNotice({ className }: { className?: string }) {
  const [show, setShow] = useState(false)
  useEffect(() => setShow(window.location.hostname === OLD_HOST), [])
  if (!show) return null
  const host = new URL(SITE_URL).host
  return (
    <div role="note" className={cx('border-b border-line bg-accent/30 px-4 py-2.5 text-13 text-ink sm:px-6', className)}>
      <strong className="font-semibold">UtilityLab has moved to </strong>
      <a href={SITE_URL} className="font-semibold underline underline-offset-[3px]">
        {host}
      </a>
      <strong className="font-semibold">.</strong> Studies are saved per web address, so the ones here stay here: open
      each one, choose <strong className="font-semibold">Studies → Download</strong>, then open the file at the new
      address. This address will keep working while you move them.
    </div>
  )
}
