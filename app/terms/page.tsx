import type { Metadata } from 'next'
import Link from 'next/link'
import { Ext, LegalPage, Section, listClass } from '../components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Terms and disclaimer',
  description: 'The terms for using UtilityLab, and what remains your responsibility as a researcher.',
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms and disclaimer"
      lede="UtilityLab is free, open-source software for designing stated choice experiments. You can use it for any purpose, academic or commercial. In return, the design and the survey you field remain your responsibility."
    >
      <Section title="Licence">
        <p>
          The software is licensed under the{' '}
          <Ext href="https://github.com/acesonic7/utilitylab/blob/main/LICENSE">Apache License 2.0</Ext>. The hosted app
          at this address is offered on the same basis: free of charge and <strong className="font-semibold text-ink">“as is”</strong>,
          without warranties of any kind, and without liability for any loss arising from its use, as set out in sections
          7 and 8 of the licence.
        </p>
      </Section>

      <Section title="What remains your responsibility">
        <ul className={listClass}>
          <li>
            <strong className="font-semibold text-ink">Checking the design.</strong> The D-error, the diagnostics and the
            suggestions are aids, not guarantees. Check that the design suits your model, priors and sample before you
            field it.
          </li>
          <li>
            <strong className="font-semibold text-ink">Testing the survey.</strong> Import the exported files into your
            survey platform and take the survey yourself before launch: check the block assignment, the question text,
            the response requirement and every choice task.
          </li>
          <li>
            <strong className="font-semibold text-ink">Ethics and data protection.</strong> Obtaining ethics approval,
            informing respondents and handling their data are matters for you and your survey platform. UtilityLab never
            receives respondents’ data.
          </li>
          <li>
            <strong className="font-semibold text-ink">Reporting.</strong> The generated methods paragraph describes the
            design as UtilityLab built it; review it before publishing, and cite the version you used (each release has
            its own DOI).
          </li>
        </ul>
        <p>UtilityLab does not give statistical, methodological or legal advice.</p>
      </Section>

      <Section title="Survey platforms">
        <p>
          The LimeSurvey exports have been tested on a live LimeSurvey 6 server. The Qualtrics and Sawtooth exports
          follow those platforms’ published formats but have not yet been tested on live accounts, so check them with
          particular care. Platforms change their formats, and an export that worked before may need checking again.
        </p>
        <p>
          Qualtrics, LimeSurvey, Sawtooth, Ngene and other product names belong to their owners. UtilityLab is not
          affiliated with or endorsed by them.
        </p>
      </Section>

      <Section title="Availability and your data">
        <p>
          The hosted app may change, be interrupted or be discontinued without notice. Your studies are stored only in
          your browser, so keep project files of anything you need. The source code stays available on{' '}
          <Ext href="https://github.com/acesonic7/utilitylab">GitHub</Ext> and archived on Zenodo, and you can run your
          own copy. How data is handled is described on the{' '}
          <Link href="/privacy" className="text-ink underline decoration-line-2 underline-offset-[3px]">
            privacy page
          </Link>
          .
        </p>
      </Section>

      <Section title="Fair use">
        <p>
          Use the LimeSurvey push only with servers you are allowed to use, and do not use UtilityLab to probe, overload
          or attack any system. Requests may be limited or refused to protect the service.
        </p>
      </Section>
    </LegalPage>
  )
}
