import { useNavigate } from 'react-router-dom'
import { config } from '../lib/config'
import { track } from '../lib/analytics'
import { useDiagnostic, hasProgress } from '../state/useDiagnostic'
import ResumePrompt from './ResumePrompt'

const PILLAR_SUMMARIES: Record<string, string> = {
  Clarity: 'Do you both understand — in your own words — what lifelong Catholic marriage demands?',
  Freedom: 'Is this marriage your own free choice, untouched by pressure, fear, or expectation?',
  Capacity: 'Do you both have the human and emotional stability that daily married life requires?',
  Intention: 'Do you intend what the Church intends: a faithful, permanent, fruitful union with no reservations?',
  Unity: 'Are you building one life together — values, decisions, faith, and friendship aligned?',
}

export default function WelcomeScreen() {
  const navigate = useNavigate()
  const answers = useDiagnostic((s) => s.answers)
  const reset = useDiagnostic((s) => s.reset)
  const inProgress = hasProgress(answers)

  const begin = () => {
    reset()
    track('diagnostic_started')
    navigate('/quiz')
  }

  return (
    <main className="container welcome">
      <svg className="ornament" viewBox="0 0 120 40" aria-hidden="true">
        <line x1="0" y1="20" x2="50" y2="20" stroke="currentColor" strokeWidth="1" />
        <line x1="70" y1="20" x2="120" y2="20" stroke="currentColor" strokeWidth="1" />
        <circle cx="60" cy="20" r="5" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="60" cy="20" r="1.8" fill="currentColor" />
      </svg>
      <h1>{config.meta.title}</h1>
      <p className="subtitle">{config.meta.subtitle}</p>
      {config.welcome.paragraphs.map((p) => (
        <p key={p.slice(0, 24)} className="welcome-para">
          {p}
        </p>
      ))}
      <div className="pillar-preview" aria-label="The five pillars">
        {config.pillars.map((p) => (
          <span key={p}>{p}</span>
        ))}
      </div>

      {inProgress ? (
        <ResumePrompt
          onResume={() => navigate('/quiz')}
          onRestart={begin}
        />
      ) : (
        <div className="center">
          <button className="btn-primary" onClick={begin}>
            {config.welcome.cta}
          </button>
        </div>
      )}

      <section className="pillars-explainer">
        <h2>The Five Pillars of Valid Consent</h2>
        {config.pillars.map((p) => (
          <p key={p}>
            <strong className="pillar-word">{p}.</strong> {PILLAR_SUMMARIES[p]}
          </p>
        ))}
      </section>

      <footer className="signature">
        <p>{config.meta.author}</p>
        <p>{config.meta.authorTitle}</p>
        <p className="motto">{config.meta.motto}</p>
      </footer>
    </main>
  )
}
