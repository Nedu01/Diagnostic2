export type BandKey = 'strong' | 'solid' | 'needs_work' | 'concern'
export type OverallKey = 'strong' | 'good' | 'gaps' | 'concern'
export type Pillar = 'Clarity' | 'Freedom' | 'Capacity' | 'Intention' | 'Unity'
export type AnswerValue = 0 | 1 | 2

/** Completed answer set: length 20, index = questionId - 1. */
export type Answers = AnswerValue[]

export interface Band<K extends string> {
  key: K
  label: string
  min: number
}

export interface ScaleOption {
  value: AnswerValue
  label: string
  text: string
}

export interface Question {
  id: number
  pillar: Pillar
  text: string
}

export interface DiagnosticConfig {
  meta: {
    id: string
    version: number
    title: string
    subtitle: string
    author: string
    authorTitle: string
    motto: string
    sourceUrl: string
    resultsGuideUrl: string
    shareText: string
  }
  scale: { type: string; options: ScaleOption[] }
  pillars: Pillar[]
  questions: Question[]
  scoring: {
    perQuestionMax: number
    perPillarMax: number
    totalMax: number
    pillarBands: Band<BandKey>[]
    overallBands: Band<OverallKey>[]
  }
  overallFeedback: Record<OverallKey, string>
  pillarFeedback: Record<Pillar, Record<BandKey, string>>
  welcome: { paragraphs: string[]; cta: string }
}

export interface PillarResult {
  score: number
  band: Band<BandKey>
}

export interface DiagnosticResult {
  total: number
  overall: Band<OverallKey>
  pillars: Record<Pillar, PillarResult>
}

/** Band-only view of a result, e.g. decoded from a share code. */
export interface BandsResult {
  overall: OverallKey
  pillars: Record<Pillar, BandKey>
}
