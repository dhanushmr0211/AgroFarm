import { useEffect, useState } from 'react'
import { Bot, ExternalLink, X } from 'lucide-react'

const assistantUrl = 'https://agro-rag.vercel.app/'

const AIAssistant = () => {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) return undefined

    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  return (
    <>
      <button
        type="button"
        className="ai-assistant-bubble"
        onClick={() => setIsOpen(true)}
        aria-label="Open AI assistant"
        aria-expanded={isOpen}
      >
        <Bot size={23} strokeWidth={2.2} />
        <span className="ai-assistant-bubble-label">Ask Agro AI</span>
      </button>

      {isOpen && (
        <div className="ai-assistant-overlay" role="presentation" onMouseDown={() => setIsOpen(false)}>
          <section
            className="ai-assistant-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-assistant-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="ai-assistant-header">
              <div className="ai-assistant-heading">
                <span className="ai-assistant-icon" aria-hidden="true">
                  <Bot size={19} />
                </span>
                <div>
                  <h2 id="ai-assistant-title">Agro AI Assistant</h2>
                  <p>Here to help with your farm journey</p>
                </div>
              </div>
              <div className="ai-assistant-actions">
                <a
                  href={assistantUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ai-assistant-icon-button"
                  aria-label="Open assistant in a new tab"
                  title="Open in a new tab"
                >
                  <ExternalLink size={17} />
                </a>
                <button
                  type="button"
                  className="ai-assistant-icon-button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close AI assistant"
                  title="Close assistant"
                >
                  <X size={19} />
                </button>
              </div>
            </header>
            <iframe
              className="ai-assistant-frame"
              src={assistantUrl}
              title="Agro AI Assistant"
              allow="clipboard-read; clipboard-write"
            />
          </section>
        </div>
      )}
    </>
  )
}

export default AIAssistant