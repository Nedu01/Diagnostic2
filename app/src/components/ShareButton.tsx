import { useState } from 'react'
import { shareResult } from '../lib/share'

export default function ShareButton({ shareCode }: { shareCode: string }) {
  const [copied, setCopied] = useState(false)

  const onShare = async () => {
    const method = await shareResult(shareCode)
    if (method === 'clipboard') {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  return (
    <div className="share">
      <button type="button" className="btn-link" onClick={onShare}>
        Share this diagnostic with a couple who needs it
      </button>
      <span role="status" className={copied ? 'share-toast' : 'visually-hidden'}>
        {copied ? 'Link copied to clipboard.' : ''}
      </span>
    </div>
  )
}
