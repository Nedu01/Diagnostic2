import { config } from './config'
import { track } from './analytics'

export async function shareResult(shareCode: string): Promise<'native' | 'clipboard' | null> {
  const url = `${window.location.origin}/s/${shareCode}`
  const { title, shareText } = config.meta
  if (navigator.share) {
    try {
      await navigator.share({ title, text: shareText, url })
      track('result_shared', { method: 'native' })
      return 'native'
    } catch {
      return null // user cancelled the sheet
    }
  }
  await navigator.clipboard.writeText(`${shareText} ${url}`)
  track('result_shared', { method: 'clipboard' })
  return 'clipboard'
}
