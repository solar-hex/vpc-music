'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, MessageCircle, X, Loader2, Zap, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { menuSlideIn, fadeInUp, springUp } from '@/lib/animations'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  actionable?: boolean
  action?: {
    type: 'create-plan' | 'create-song' | 'modify-plan' | 'generate-setlist' | 'sync-action'
    data?: Record<string, any>
  }
}

interface AIPromptAction {
  id: string
  icon: React.ReactNode
  label: string
  description: string
  action: string
}

const QUICK_ACTIONS: AIPromptAction[] = [
  {
    id: 'create-plan',
    icon: '📋',
    label: 'Create Plan',
    description: 'Generate a new implementation plan',
    action: 'Create a new plan for...',
  },
  {
    id: 'add-song',
    icon: '🎵',
    label: 'Add Song',
    description: 'Add songs to your library',
    action: 'Add these songs to the library...',
  },
  {
    id: 'generate-setlist',
    icon: '📍',
    label: 'Generate Setlist',
    description: 'Create a new worship setlist',
    action: 'Generate a setlist with...',
  },
  {
    id: 'enhance-feature',
    icon: '✨',
    label: 'Enhance Feature',
    description: 'Request new app features',
    action: 'Add feature to the app...',
  },
]

export function AIChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hey! I can help you create plans, add songs, generate setlists, and enhance the app. What would you like to do?',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  const processPrompt = async (text: string) => {
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    // Simulate AI processing
    setTimeout(() => {
      let actionableResponse = false
      let action: Message['action'] = undefined

      // Parse intent from prompt
      const lowerText = text.toLowerCase()
      
      if (lowerText.includes('create') && lowerText.includes('plan')) {
        actionableResponse = true
        action = {
          type: 'create-plan',
          data: {
            title: text,
            description: `Plan based on: ${text}`,
            status: 'draft',
          },
        }
      } else if (lowerText.includes('add') && (lowerText.includes('song') || lowerText.includes('music'))) {
        actionableResponse = true
        action = {
          type: 'create-song',
          data: {
            title: text.replace(/add|song|music|to/gi, '').trim(),
          },
        }
      } else if (lowerText.includes('setlist') || lowerText.includes('worship')) {
        actionableResponse = true
        action = {
          type: 'generate-setlist',
          data: {
            description: text,
          },
        }
      } else if (lowerText.includes('feature') || lowerText.includes('enhance') || lowerText.includes('add')) {
        actionableResponse = true
        action = {
          type: 'sync-action',
          data: {
            actionType: 'feature-request',
            description: text,
          },
        }
      }

      const assistantResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: generateResponse(text, action),
        timestamp: new Date(),
        actionable: actionableResponse,
        action,
      }

      setMessages(prev => [...prev, assistantResponse])
      setIsLoading(false)
    }, 800)
  }

  const generateResponse = (prompt: string, action?: Message['action']): string => {
    const responses: Record<string, string> = {
      'create-plan': `I'll create a new plan for you! This will be added to your View Plans section and you can start tracking progress immediately.`,
      'create-song': `Perfect! I'll add this song to your library so you can use it in setlists and access it anytime.`,
      'generate-setlist': `Great idea! I'll generate a worship setlist based on your preferences. You can customize it after.`,
      'sync-action': `Noted! I'll pass this feature request to the team. This will help improve the app for everyone.`,
    }

    if (action?.type) {
      return responses[action.type] || `I'll help you with that right away!`
    }

    return `Got it! I understand you want to ${prompt}. Let me help you with that. You can use the quick actions above or describe in more detail what you'd like to do.`
  }

  const handleSendMessage = () => {
    if (input.trim() && !isLoading) {
      processPrompt(input)
    }
  }

  const handleQuickAction = (action: AIPromptAction) => {
    if (!isLoading) {
      processPrompt(action.action)
    }
  }

  const handleCopyAction = (messageId: string, actionData: string) => {
    navigator.clipboard.writeText(JSON.stringify(actionData, null, 2))
    setCopiedId(messageId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <>
      {/* Chat Bubble Toggle */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-6 right-6 z-40 p-3 rounded-full bg-[#C09060] text-white shadow-lg hover:shadow-xl transition-all"
        aria-label="Open AI chat"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close" initial={{ rotate: -90 }} animate={{ rotate: 0 }} exit={{ rotate: 90 }}>
              <X className="h-6 w-6" />
            </motion.div>
          ) : (
            <motion.div key="open" initial={{ rotate: -90 }} animate={{ rotate: 0 }} exit={{ rotate: 90 }}>
              <MessageCircle className="h-6 w-6" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            {...menuSlideIn}
            className="fixed bottom-24 right-6 z-40 w-96 h-[600px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/50">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-[#C09060]" />
                <h3 className="font-semibold text-white">AI Assistant</h3>
              </div>
              <motion.button
                onClick={() => setIsOpen(false)}
                whileHover={{ rotate: 90 }}
                className="p-1 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-4 w-4 text-slate-400" />
              </motion.button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              <AnimatePresence>
                {messages.map((msg, idx) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={cn(
                      'flex gap-2',
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-xs px-4 py-2.5 rounded-lg text-sm leading-relaxed',
                        msg.role === 'user'
                          ? 'bg-[#C09060] text-white rounded-br-none'
                          : 'bg-slate-700/50 text-slate-100 rounded-bl-none'
                      )}
                    >
                      {msg.content}
                      {msg.actionable && msg.action && (
                        <motion.button
                          onClick={() => handleCopyAction(msg.id, msg.action?.data)}
                          whileHover={{ scale: 1.1 }}
                          className="ml-2 inline-flex items-center gap-1 px-2 py-1 mt-2 text-xs bg-slate-600/50 hover:bg-slate-600 rounded transition-colors"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="h-3 w-3" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              Copy
                            </>
                          )}
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-2 items-center text-slate-500"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Processing your request...</span>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions (show when no messages or at start) */}
            {messages.length <= 1 && !isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-4 py-3 border-t border-slate-700 space-y-2"
              >
                <p className="text-xs text-slate-500 font-semibold">Quick Actions</p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_ACTIONS.map((action) => (
                    <motion.button
                      key={action.id}
                      onClick={() => handleQuickAction(action)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="p-2 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 transition-colors text-left text-xs"
                    >
                      <div className="text-lg mb-1">{action.icon}</div>
                      <div className="font-semibold text-slate-100">{action.label}</div>
                      <div className="text-slate-500 text-[0.7rem]">{action.description}</div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Input Area */}
            <div className="border-t border-slate-700 bg-slate-800/50 p-3">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Describe what you need..."
                  className="flex-1 px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#C09060] transition-colors"
                />
                <motion.button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || isLoading}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    input.trim() && !isLoading
                      ? 'bg-[#C09060] text-white hover:bg-[#B8860B]'
                      : 'bg-slate-700/30 text-slate-500 cursor-not-allowed'
                  )}
                >
                  <Send className="h-5 w-5" />
                </motion.button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Chat with AI to create plans, add songs, and enhance your experience
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
