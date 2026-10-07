import type { Metadata } from 'next'
import Link from 'next/link'
import { Ext, LegalPage, Section, listClass } from '../components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What UtilityLab stores, what reaches a server, and what never leaves your browser.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      lede="UtilityLab has no accounts, no cookies and no analytics. Your studies stay in your browser. The only time study data leaves your computer is when you choose to push a survey to your own LimeSurvey server."
    >
      <Section title="What stays in your browser">
        <p>
          UtilityLab saves your work in your browser’s local storage, on your device only. It is not sent to us, and we
          cannot see it. This covers:
        </p>
        <ul className={listClass}>
          <li>your studies, their earlier designs and the list of studies;</li>
          <li>small settings, such as your theme choice and which notices you have dismissed;</li>
          <li>
            the LimeSurvey address, username and survey ID you last used, to save retyping. Your LimeSurvey password is
            never stored.
          </li>
        </ul>
        <p>
          This data stays until you delete it. Clearing your browser’s data for this site removes it, and Safari may
          remove it after seven days without a visit. To keep a copy, or to move a study to another computer, download it
          as a project file (<strong className="font-semibold text-ink">Studies → Download</strong>). Project files
          leave out your LimeSurvey username.
        </p>
      </Section>

      <Section title="What reaches a server">
        <p>
          <strong className="font-semibold text-ink">Loading the site.</strong> UtilityLab is hosted by Vercel. Like any
          website host, Vercel processes standard request information, such as your IP address, browser and the page
          requested, to deliver the site and protect it from abuse. See{' '}
          <Ext href="https://vercel.com/legal/privacy-policy">Vercel’s privacy policy</Ext>. UtilityLab itself adds no
          analytics, tracking or cookies, and its fonts are served from this site, not from Google.
        </p>
        <p>
          <strong className="font-semibold text-ink">Pushing to LimeSurvey (only if you use it).</strong> When you press
          Push or Test connection, your browser sends your LimeSurvey address, username, password and survey ID, and the
          study’s choice tasks, to a server function run by Vercel in Frankfurt, Germany (EU). The function passes them to
          your LimeSurvey server, returns the result to you, and then forgets them: UtilityLab does not store or log
          them. To limit abuse, it keeps your network address in the server’s memory for about ten minutes, and never writes it anywhere. If you would rather
          nothing leave your browser, download the LimeSurvey file (LSS) and import it yourself.
        </p>
        <p>
          <strong className="font-semibold text-ink">Feedback.</strong> The Feedback form does not send anything
          itself: it opens GitHub in a new tab with your text filled in, so GitHub receives that text, and the app
          version and browser if you leave them ticked, when its page loads. Nothing is published until you submit it
          there, under{' '}
          <Ext href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">GitHub’s privacy statement</Ext>.
        </p>
        <p>
          <strong className="font-semibold text-ink">Images you link.</strong> If you add an image address to an
          alternative, attribute or level, your browser loads the image from that site, which can then see your IP
          address. The same happens for respondents when an exported survey shows the image. Host images on your survey
          platform if that matters for your study.
        </p>
      </Section>

      <Section title="Exports and your respondents">
        <p>
          Qualtrics, LimeSurvey and Sawtooth files are created in your browser. Once you import them, that platform’s
          terms apply. UtilityLab never sees your respondents or their answers: they are collected by your survey
          platform under your study’s own data protection arrangements.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          Apart from the hosting provider’s request logs, UtilityLab holds no personal data about you, so there is
          nothing for us to access, correct or delete. Your browser data is under your control: you can delete studies in
          the app or clear the site’s data in your browser at any time.
        </p>
        <p>
          UtilityLab is open source, so all of the above can be checked in the{' '}
          <Ext href="https://github.com/acesonic7/utilitylab">source code</Ext>. Questions can be raised as a{' '}
          <Ext href="https://github.com/acesonic7/utilitylab/issues">GitHub issue</Ext>, or privately with the
          maintainer, <Ext href="https://github.com/acesonic7">Ioannis Tsouros</Ext>.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If this page changes, the date at the top changes too, and every earlier version is kept in the project’s
          history on GitHub. See also the <Link href="/terms" className="text-ink underline decoration-line-2 underline-offset-[3px]">terms and disclaimer</Link>.
        </p>
      </Section>
    </LegalPage>
  )
}
