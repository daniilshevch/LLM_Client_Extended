import { useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = input.trim()

    if (!message || isLoading) {
      return
    }

    setMessages((current) => [...current, { role: 'user', content: message }])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('http://127.0.0.1:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }

      const data: { reply: string } = await response.json()
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: data.reply },
      ])
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: `Помилка: ${errorMessage}` },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="chat-page">
      <section className="chat-card">
        <header className="chat-header">
          <p className="eyebrow">LLM FOLLOW-UP</p>
          <h1>Основний чат</h1>
          <p>Постав запитання моделі, а згодом виділи фрагмент для follow-up гілки.</p>
        </header>

        <div className="messages" aria-live="polite">
          {messages.length === 0 && (
            <p className="empty-state">Тут з&apos;явиться історія діалогу.</p>
          )}
          {messages.map((message, index) => (
            <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
              <span className="message-role">
                {message.role === 'user' ? 'Ти' : 'AI'}
              </span>
              <p>{message.content}</p>
            </article>
          ))}
          {isLoading && <p className="loading">Модель готує відповідь...</p>}
        </div>

        <form className="chat-form" onSubmit={handleSubmit}>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Напиши повідомлення..."
            rows={3}
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !input.trim()}>
            {isLoading ? 'Очікування...' : 'Надіслати'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default App
