import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Button,
  Empty,
  Input,
  Layout,
  List,
  Typography,
} from 'antd'
import {
  DeleteOutlined,
  MessageOutlined,
  PlusOutlined,
  SendOutlined,
} from '@ant-design/icons'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

type ChatSession = {
  id: string
  title: string
  messages: Message[]
}

const createChat = (): ChatSession => ({
  id: crypto.randomUUID(),
  title: 'Новий чат',
  messages: [],
})

const initialChat = createChat()

function normalizeLatexDelimiters(markdown: string): string {
  return markdown
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, formula: string) => {
      return `$$\n${formula.trim()}\n$$`
    })
    .replace(/\\\(([\s\S]*?)\\\)/g, (_match, formula: string) => {
      return `$${formula}$`
    })
}

function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([initialChat])
  const [activeChatId, setActiveChatId] = useState(initialChat.id)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const activeChat = useMemo(
    () => sessions.find((session) => session.id === activeChatId),
    [activeChatId, sessions],
  )

  function updateActiveChat(update: (chat: ChatSession) => ChatSession) {
    setSessions((current) =>
      current.map((chat) => (chat.id === activeChatId ? update(chat) : chat)),
    )
  }

  function createNewChat() {
    const chat = createChat()
    setSessions((current) => [chat, ...current])
    setActiveChatId(chat.id)
    setInput('')
  }

  function deleteChat(chatId: string) {
    setSessions((current) => {
      const remaining = current.filter((chat) => chat.id !== chatId)
      if (remaining.length === 0) {
        const newChat = createChat()
        setActiveChatId(newChat.id)
        return [newChat]
      }

      if (chatId === activeChatId) {
        setActiveChatId(remaining[0].id)
      }
      return remaining
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = input.trim()

    if (!message || isLoading || !activeChat) {
      return
    }

    updateActiveChat((chat) => ({
      ...chat,
      title: chat.messages.length === 0 ? message.slice(0, 40) : chat.title,
      messages: [...chat.messages, { role: 'user', content: message }],
    }))
    setInput('')
    setIsLoading(true)
    let assistantMessageAdded = false

    try {
      const response = await fetch(`${API_URL}/chat/stream`, {
        method: 'POST',
        headers: {
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({ message }),
      })

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }
      if (!response.body) {
        throw new Error('The response does not contain a readable stream')
      }

      updateActiveChat((chat) => ({
        ...chat,
        messages: [...chat.messages, { role: 'assistant', content: '' }],
      }))
      assistantMessageAdded = true

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        buffer += decoder.decode(value, { stream: !done })

        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''

        for (const event of events) {
          const line = event
            .split('\n')
            .find((currentLine) => currentLine.startsWith('data: '))

          if (!line) {
            continue
          }

          const data = line.slice('data: '.length)
          if (data === '[DONE]') {
            continue
          }

          const parsed: { content?: string; error?: string } = JSON.parse(data)
          if (parsed.error) {
            throw new Error(parsed.error)
          }

          if (parsed.content) {
            updateActiveChat((chat) => {
              const lastMessage = chat.messages.at(-1)
              if (!lastMessage || lastMessage.role !== 'assistant') {
                return chat
              }

              return {
                ...chat,
                messages: [
                  ...chat.messages.slice(0, -1),
                  { ...lastMessage, content: lastMessage.content + parsed.content },
                ],
              }
            })
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() => resolve()),
            )
          }
        }

        if (done) {
          break
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      updateActiveChat((chat) => ({
        ...chat,
        messages: [
          ...(assistantMessageAdded ? chat.messages.slice(0, -1) : chat.messages),
          { role: 'assistant', content: `Помилка: ${errorMessage}` },
        ],
      }))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Layout className="app-layout">
      <Layout.Sider className="chat-sidebar" theme="light" width={280}>
        <div className="sidebar-content">
          <div className="sidebar-brand">
            <span className="brand-mark">L</span>
            <div>
              <Typography.Text strong>LLM Follow-up</Typography.Text>
              <Typography.Text type="secondary">Твої розмови</Typography.Text>
            </div>
          </div>

          <Button
            block
            icon={<PlusOutlined />}
            className="new-chat-button"
            onClick={createNewChat}
          >
            Новий чат
          </Button>

          <Typography.Text type="secondary" className="history-label">
            Історія чатів
          </Typography.Text>
          <List
            className="chat-history"
            dataSource={sessions}
            locale={{ emptyText: 'Історія порожня' }}
            renderItem={(chat) => (
              <List.Item
                className={chat.id === activeChatId ? 'active-chat' : ''}
                onClick={() => !isLoading && setActiveChatId(chat.id)}
              >
                <MessageOutlined />
                <span className="chat-title">{chat.title}</span>
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  disabled={isLoading}
                  onClick={(event) => {
                    event.stopPropagation()
                    deleteChat(chat.id)
                  }}
                />
              </List.Item>
            )}
          />
        </div>
      </Layout.Sider>

      <Layout>
        <Layout.Header className="chat-header">
          <div>
            <Typography.Text className="eyebrow">LLM FOLLOW-UP</Typography.Text>
            <Typography.Title level={1}>Основний чат</Typography.Title>
            <Typography.Paragraph>
              Постав запитання моделі, а згодом виділи фрагмент для follow-up гілки.
            </Typography.Paragraph>
          </div>
        </Layout.Header>

        <Layout.Content className="chat-content">
          <div className="messages" aria-live="polite">
            {!activeChat?.messages.length && (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Тут з&apos;явиться історія діалогу"
              />
            )}
            {activeChat?.messages.map((message, index) => (
              <article
                className={`message ${message.role}`}
                key={`${activeChat.id}-${message.role}-${index}`}
              >
                <span className="message-role">
                  {message.role === 'user' ? 'Ти' : 'AI'}
                </span>
                <div className="message-content">
                  {message.role === 'assistant' ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {normalizeLatexDelimiters(message.content)}
                    </ReactMarkdown>
                  ) : (
                    <p>{message.content}</p>
                  )}
                </div>
              </article>
            ))}
            {isLoading && <p className="loading">Модель готує відповідь...</p>}
          </div>
        </Layout.Content>

        <Layout.Footer className="chat-footer">
          <form className="chat-form" onSubmit={handleSubmit}>
            <Input.TextArea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Напиши повідомлення..."
              autoSize={{ minRows: 2, maxRows: 6 }}
              disabled={isLoading}
              onPressEnter={(event) => {
                if (!event.shiftKey) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
            />
            <Button
              type="primary"
              htmlType="submit"
              icon={<SendOutlined />}
              loading={isLoading}
              disabled={!input.trim()}
            >
              Надіслати
            </Button>
          </form>
          <Typography.Text type="secondary" className="composer-hint">
            Enter — надіслати, Shift + Enter — новий рядок
          </Typography.Text>
        </Layout.Footer>
      </Layout>
    </Layout>
  )
}

export default App
