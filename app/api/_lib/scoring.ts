import raw from '../../../content/diagnostic-config.json'
import type {
  Answers,
  Band,
  DiagnosticConfig,
  DiagnosticResult,
  Pillar,
} from '../../src/lib/types'

/**
 * Self-contained copy of the scoring core from src/lib/scoring.ts for the
 * CommonJS api/ scope — importing the ESM-compiled src module from these
 * functions crashes on Vercel (ERR_REQUIRE_ESM). Keep in sync with src.
 */

const defaultConfig = raw as unknown as DiagnosticConfig

/**
 * Bands in the config are ordered by descending `min`; the first band whose
 * threshold the score meets is the match (verified by a config-invariant test).
 */
export function resolveBand<K extends string>(score: number, bands: Band<K>[]): Band<K> {
  const band = bands.find((b) => score >= b.min)
  if (!band) throw new Error(`No band for score ${score}`)
  return band
}

export function scorePillar(
  answers: Answers,
  pillar: Pillar,
  config: DiagnosticConfig = defaultConfig,
): number {
  return config.questions.reduce(
    (sum, q, i) => (q.pillar === pillar ? sum + answers[i] : sum),
    0,
  )
}

export function computeResult(
  answers: Answers,
  config: DiagnosticConfig = defaultConfig,
): DiagnosticResult {
  if (answers.length !== config.questions.length) {
    throw new Error(`Expected ${config.questions.length} answers, got ${answers.length}`)
  }
  const total = answers.reduce((a: number, b) => a + b, 0)
  const pillars = Object.fromEntries(
    config.pillars.map((pillar) => {
      const score = scorePillar(answers, pillar, config)
      return [pillar, { score, band: resolveBand(score, config.scoring.pillarBands) }]
    }),
  ) as DiagnosticResult['pillars']
  return { total, overall: resolveBand(total, config.scoring.overallBands), pillars }
}
