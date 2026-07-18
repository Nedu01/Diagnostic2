import raw from '../../../content/diagnostic-config.json'
import type { DiagnosticConfig } from './types'

export const config = raw as unknown as DiagnosticConfig
