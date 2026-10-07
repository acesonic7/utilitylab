import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Ext, LegalPage, Section, listClass } from '../components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Methods',
  description:
    'How UtilityLab models choices, computes the D-error, generates and checks designs, and assigns blocks, with its limitations and references.',
  alternates: { canonical: '/methods' },
}

const UPDATED = '7 October 2026'

function M({ children }: { children: ReactNode }) {
  return <span className="font-mono text-13 text-ink">{children}</span>
}

function Eq({ children }: { children: ReactNode }) {
  return (
    <p className="overflow-x-auto rounded-card border border-line bg-surface-2 px-4 py-3 text-center font-mono text-13 text-ink">
      {children}
    </p>
  )
}

function Cite({ id, children }: { id: string; children: ReactNode }) {
  return (
    <a href={`#ref-${id}`} className="text-ink underline decoration-line-2 underline-offset-[3px] hover:decoration-ink-3">
      {children}
    </a>
  )
}

const th = 'border-b border-line-2 px-3 py-2 text-left text-12 font-semibold text-ink'
const td = 'border-b border-line px-3 py-2 align-top'

export default function MethodsPage() {
  return (
    <LegalPage
      title="Methods"
      updated={UPDATED}
      lede={
        <>
          What UtilityLab computes, exactly as the code does it: the choice model, the D-error, how designs are
          generated and checked, and how blocks reach respondents. Read it with one caution in mind: a D-efficient design
          is only as good as the priors it was built on (<Cite id="walker2018">Walker et al., 2018</Cite>).
        </>
      }
    >
      <Section title="1. The choice model">
        <p>
          UtilityLab scores designs under a multinomial logit (MNL) model. The utility of alternative <M>j</M> in choice
          task <M>s</M> is <M>V_sj = β′x_sj</M>, and the choice probabilities are the usual logit probabilities. The
          coding of <M>x_sj</M> is:
        </p>
        <ul className={listClass}>
          <li>
            <strong className="font-semibold text-ink">Numeric attributes</strong> enter linearly with one parameter, in the
            value entered (for example minutes or euros), without centring or scaling.
          </li>
          <li>
            <strong className="font-semibold text-ink">Categorical and boolean attributes</strong> are dummy coded with
            L − 1 parameters. The base is the first level in the attribute’s level order. For a yes/no attribute that is the
            first level listed (by default “Yes”), so its parameter reads “No vs Yes”.
          </li>
          <li>
            <strong className="font-semibold text-ink">Attribute parameters are generic</strong>: one parameter (or set of
            dummy parameters) per attribute, shared by every alternative it applies to, in labeled experiments too.
            Alternative-specific attribute parameters and interactions are not supported.
          </li>
          <li>
            An attribute that does not apply to an alternative contributes zeros for that alternative.
            <strong className="font-semibold text-ink"> Context variables are not part of the model</strong>: they are
            shown to respondents but do not enter the D-error.
          </li>
          <li>
            <strong className="font-semibold text-ink">Pivoted attributes</strong> enter with the values as entered (the
            offsets or multipliers), not the values a respondent sees after pivoting on a reference.
          </li>
        </ul>
        <p>Constants depend on the experiment type and on whether there is an opt-out:</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-13">
            <thead>
              <tr>
                <th className={th}>Experiment</th>
                <th className={th}>Constants</th>
                <th className={th}>Reference (utility 0)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={td}>Labeled, no opt-out</td>
                <td className={td}>One per alternative except the last</td>
                <td className={td}>The last alternative in the list</td>
              </tr>
              <tr>
                <td className={td}>Labeled, with opt-out</td>
                <td className={td}>One per designed alternative</td>
                <td className={td}>The opt-out</td>
              </tr>
              <tr>
                <td className={td}>Unlabeled, no opt-out</td>
                <td className={td}>None</td>
                <td className={td}>—</td>
              </tr>
              <tr>
                <td className={td}>Unlabeled, with opt-out</td>
                <td className={td}>One, shared by the designed alternatives</td>
                <td className={td}>The opt-out</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          The opt-out has no attribute levels and a utility of zero. The number of parameters <M>K</M> counts the
          constants and the attribute parameters.
        </p>
      </Section>

      <Section title="2. The D-error">
        <p>
          For a design with choice tasks <M>s = 1…S</M>, UtilityLab builds the MNL Fisher information matrix (
          <Cite id="huber1996">Huber &amp; Zwerina, 1996</Cite>)
        </p>
        <Eq>F(β) = Σ_s X_s′ ( diag(P_s) − P_s P_s′ ) X_s</Eq>
        <p>
          where <M>X_s</M> stacks the coded alternatives of choice task <M>s</M> (opt-out included) and <M>P_s</M> holds
          their choice probabilities at the priors <M>β</M>. The asymptotic variance–covariance (AVC) matrix is its
          inverse, and the D-error is
        </p>
        <Eq>D-error = det( F(β)⁻¹ )^(1/K) = det( F(β) )^(−1/K)</Eq>
        <p>
          Following <Cite id="walker2018">Walker et al. (2018)</Cite> and{' '}
          <Cite id="rose2009">Rose and Bliemer (2009)</Cite>, the D-error is a{' '}
          <strong className="font-semibold text-ink">
            D<sub>z</sub>-error
          </strong>{' '}
          when every prior is zero and a{' '}
          <strong className="font-semibold text-ink">
            D<sub>p</sub>-error
          </strong>{' '}
          when the priors are fixed, non-zero values. UtilityLab labels it accordingly. It does not compute a Bayesian D
          <sub>b</sub>-error.
        </p>
        <ul className={listClass}>
          <li>
            The information is summed over <strong className="font-semibold text-ink">all choice tasks of all blocks</strong>
            , as if one respondent answered the whole design. Blocks play no part in it.
          </li>
          <li>
            Lower is better, but only like for like: adding choice tasks lowers the D-error, so compare designs with the same
            number of choice tasks, the same model (attributes, coding, constants) and the same priors.
          </li>
          <li>
            The log-determinant is computed by a Cholesky factorisation. If a pivot is below 10⁻¹⁰ of the largest diagonal
            element the information matrix is treated as singular: the design does not identify every parameter, and the
            D-error is shown as “not computable” rather than as a misleading number.
          </li>
          <li>The D-error is computed for any design, generated or uploaded.</li>
        </ul>
      </Section>

      <Section title="3. Priors, and why D-efficiency is not the whole story">
        <p>
          Priors are fixed point values, entered per attribute parameter on the utility scale (per unit for numeric
          attributes, relative to the base level for dummy-coded ones). Constants always have a prior of zero. With every
          prior at zero, the D<sub>z</sub>-optimal design is the one that would be efficient if no attribute mattered: a
          starting point, not a design tuned to any particular preferences.
        </p>
        <p>
          A D-efficient design built on non-zero priors concentrates its choice tasks where those priors make the
          alternatives close in utility. That is efficient if the priors are right and can be poor if they are wrong.{' '}
          <Cite id="walker2018">Walker et al. (2018)</Cite> show this for a binary mode choice with travel time and cost,
          where the parameter of interest is the value of time (VOT):
        </p>
        <ul className={listClass}>
          <li>
            The D-efficient design built on a prior VOT of $20/hour was the most efficient design when the true VOT was
            roughly $10–30/hour, became the least efficient outside about $5–40/hour, and estimation degraded markedly above
            about $50/hour.
          </li>
          <li>
            Orthogonal and random designs were robust over a much wider range of true VOT. Bayesian efficient designs were
            more robust than D-efficient ones, depending on the prior’s variance, and two-stage designs (priors from a small
            first sample) were not more robust than uninformative designs.
          </li>
          <li>
            Their conclusion: arguably, “the random design (which is the easiest to generate) performs as well as any
            design”, and any design does better once choice tasks in which one alternative dominates the other are removed.
            They recommend efficient designs only when the priors are excellent.
          </li>
        </ul>
        <p>What this means in UtilityLab:</p>
        <ul className={listClass}>
          <li>
            Use non-zero priors only when you are confident in them, for example from a pilot or a closely comparable study.
            Otherwise prefer zero priors, the balanced search or a random design.
          </li>
          <li>
            Check robustness yourself: keep the design and change the priors. Diagnostics recomputes the D-error of the same
            design at the new values, which is the analytical check Walker et al. use. If it rises sharply for plausible
            alternative values, the design is fragile.
          </li>
          <li>
            In unlabeled experiments, look at the dominance check and avoid choice tasks with a dominant alternative (
            <Cite id="bliemer2017">Bliemer, Rose &amp; Chorus, 2017</Cite>).
          </li>
        </ul>
      </Section>

      <Section title="4. Generating a design">
        <p>All three methods take the number of choice tasks and blocks, record their random seed, and can be reproduced by entering that seed again with the same structure and version.</p>
        <ul className={listClass}>
          <li>
            <strong className="font-semibold text-ink">D-efficient search.</strong> A coordinate-exchange algorithm (
            <Cite id="meyer1995">Meyer &amp; Nachtsheim, 1995</Cite>) that minimises the D-error at the current priors. Each
            start is a random design; each pass visits every choice task, designed alternative and applicable attribute and
            tries every other level, keeping the change that most lowers the D-error (or, when constraints are set, one that removes a violation). It stops after a pass without
            improvement, or after 30 passes. Several random starts are run (5 by default) and the best is kept. The result
            is a locally optimal, D-efficient design, not a proven D-optimal one. A run is refused when the design cannot
            identify every parameter: fewer choice tasks than <M>⌈K / (J − 1)⌉</M>, an attribute with fewer than two levels
            for an alternative it applies to, or fewer than two alternatives.
          </li>
          <li>
            <strong className="font-semibold text-ink">Balanced search.</strong> Draws many random designs (1,000 by
            default) and keeps the one with the lowest weighted score of level-balance deviation, largest within-alternative
            correlation, dominance relations and pairs of identical alternatives. The weights can be changed.
          </li>
          <li>
            <strong className="font-semibold text-ink">Random.</strong> Draws every level independently and uniformly.
          </li>
        </ul>
        <p>Common to all three:</p>
        <ul className={listClass}>
          <li>
            <strong className="font-semibold text-ink">Blocks are not optimised.</strong> Choice tasks are dealt to blocks
            in turn, so block sizes differ by at most one, and the blocking is not balanced against the attributes.
          </li>
          <li>Context variables are drawn at random for each choice task; they are not optimised.</li>
          <li>
            Constraints forbid combinations of levels within an alternative. Random starts and random designs redraw a
            violating choice task up to 200 times; the D-efficient search never accepts a change that adds a violation and
            prefers changes that remove one. Any choice task that still violates a constraint is reported.
          </li>
        </ul>
        <p>
          An uploaded design (for example from Ngene or R) is used as given: UtilityLab maps it to the structure, computes
          its D-error and runs the same checks.
        </p>
      </Section>

      <Section title="5. Checking a design">
        <p>The diagnostics are heuristics. They flag patterns worth a look; they are not tests of significance.</p>
        <ul className={listClass}>
          <li>
            <strong className="font-semibold text-ink">Dominance</strong> (unlabeled experiments only, since in labeled ones
            the label itself carries utility). Alternative A dominates B in a choice task if, on every attribute, A is at
            least as good given the attribute’s preference direction and strictly better on at least one. Pairs that do not
            show the same attributes are not compared, and attributes without a preference direction count as trade-offs, so
            no dominance is declared through them.
          </li>
          <li>
            <strong className="font-semibold text-ink">Identical alternatives.</strong> Two alternatives that show the same
            level on every attribute they share.
          </li>
          <li>
            <strong className="font-semibold text-ink">Attribute correlation.</strong> Pearson’s r between each pair of
            attributes within an alternative, across all choice tasks. Numeric attributes use their values, yes/no attributes
            1 and 0, and categorical ones their level order, which treats nominal categories as ordered, so read those values
            with care. Warning above
            |r| = 0.3, concern above 0.5 (adjustable).
          </li>
          <li>
            <strong className="font-semibold text-ink">Level balance.</strong> How far each level’s count is from an equal
            share, across the whole design (not per block). Flagged above 20% (adjustable).
          </li>
          <li>
            <strong className="font-semibold text-ink">Constraints.</strong> Choice tasks that contain a forbidden
            combination, and constraints that can never match.
          </li>
          <li>
            <strong className="font-semibold text-ink">Observations per parameter</strong> = respondents × choice tasks per
            respondent ÷ K, rated low below 25, borderline from 25 and enough from 50. This is a rule of thumb, not a power
            analysis; for sample size requirements of efficient designs see{' '}
            <Cite id="rose2013">Rose and Bliemer (2013)</Cite>.
          </li>
        </ul>
        <p>
          The analyst view shows each choice task’s MNL choice probabilities at the current priors. With all priors at zero
          they are equal by construction.
        </p>
      </Section>

      <Section title="6. Fielding: blocks and answers">
        <ul className={listClass}>
          <li>
            <strong className="font-semibold text-ink">Qualtrics QSF</strong>: the blocks sit under a randomizer that
            presents one of them, evenly.
          </li>
          <li>
            <strong className="font-semibold text-ink">Qualtrics TXT</strong>: the format cannot hold survey flow, so the
            file’s setup notes explain how to add that randomizer after import.
          </li>
          <li>
            <strong className="font-semibold text-ink">LimeSurvey</strong> (file and push): a hidden question{' '}
            <M>BLK</M> draws one block at random for each respondent and is stored with the answers; only that block’s
            choice tasks are shown, in a random order. The draw is uniform, not balanced, so block sizes can come out
            unequal in a small sample.
          </li>
          <li>
            <strong className="font-semibold text-ink">Answers</strong>: each study chooses whether respondents may skip a
            choice task (optional), are prompted once before skipping (the default), or must answer.
          </li>
        </ul>
        <p>
          Pivoted attributes are exported with values resolved at one fixed reference for every respondent. Pivoting on
          each respondent’s own value needs the wiring described in the pivot wiring guide.
        </p>
      </Section>

      <Section title="7. Limitations">
        <ul className={listClass}>
          <li>MNL only, with generic attribute parameters; no alternative-specific attribute parameters or interactions.</li>
          <li>Fixed point priors only; no Bayesian efficient designs (D<sub>b</sub>-error), and no priors on constants.</li>
          <li>Blocks and context variables are assigned at random or in turn, not optimised.</li>
          <li>Pivoted attributes are modelled on the offsets or multipliers entered, not on respondents’ resolved values.</li>
          <li>Correlations for categorical attributes use level order.</li>
          <li>
            The Qualtrics and Sawtooth exports follow those platforms’ published formats but have not been tested on live
            accounts; the LimeSurvey exports have.
          </li>
        </ul>
      </Section>

      <Section title="8. Reporting">
        <p>
          The Export step generates a methods paragraph for your paper from the study: the experiment, the design and how
          it was generated (with its seed), the D<sub>z</sub>- or D<sub>p</sub>-error, the response requirement and the
          check results. Review it before use, and cite the UtilityLab version you used: each release has its own DOI (see{' '}
          <Ext href="https://github.com/acesonic7/utilitylab#how-to-cite">How to cite</Ext>). The source code of
          everything described here is open, in <Ext href="https://github.com/acesonic7/utilitylab/tree/main/lib">lib/</Ext>.
        </p>
      </Section>

      <Section title="References">
        <ol className="list-decimal space-y-2 pl-5 marker:text-ink-3">
          <li id="ref-bliemer2017">
            Bliemer, M. C. J., Rose, J. M., &amp; Chorus, C. G. (2017). Detecting dominance in stated choice data and
            accounting for dominance-based scale differences in logit models. <em>Transportation Research Part B:
            Methodological</em>, 102, 83–104.{' '}
            <Ext href="https://doi.org/10.1016/j.trb.2017.05.005">doi:10.1016/j.trb.2017.05.005</Ext>
          </li>
          <li id="ref-huber1996">
            Huber, J., &amp; Zwerina, K. (1996). The importance of utility balance in efficient choice designs.{' '}
            <em>Journal of Marketing Research</em>, 33(3), 307–317.
          </li>
          <li id="ref-meyer1995">
            Meyer, R. K., &amp; Nachtsheim, C. J. (1995). The coordinate-exchange algorithm for constructing exact optimal
            experimental designs. <em>Technometrics</em>, 37(1), 60–69.{' '}
            <Ext href="https://doi.org/10.1080/00401706.1995.10485889">doi:10.1080/00401706.1995.10485889</Ext>
          </li>
          <li id="ref-rose2009">
            Rose, J. M., &amp; Bliemer, M. C. J. (2009). Constructing efficient stated choice experimental designs.{' '}
            <em>Transport Reviews</em>, 29(5), 587–617.
          </li>
          <li id="ref-rose2013">
            Rose, J. M., &amp; Bliemer, M. C. J. (2013). Sample size requirements for stated choice experiments.{' '}
            <em>Transportation</em>, 40(5), 1021–1041.
          </li>
          <li id="ref-walker2018">
            Walker, J. L., Wang, Y., Thorhauge, M., &amp; Ben-Akiva, M. (2018). D-efficient or deficient? A robustness
            analysis of stated choice experimental designs. <em>Theory and Decision</em>, 84(2), 215–238.{' '}
            <Ext href="https://doi.org/10.1007/s11238-017-9647-3">doi:10.1007/s11238-017-9647-3</Ext> (open access:{' '}
            <Ext href="https://hdl.handle.net/1721.1/114301">MIT DSpace</Ext>)
          </li>
        </ol>
        <p className="text-12 text-ink-3">
          See also the <Link href="/terms" className="underline decoration-line-2 underline-offset-[3px]">terms and disclaimer</Link>.
        </p>
      </Section>
    </LegalPage>
  )
}
