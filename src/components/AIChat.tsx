import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { 
  MessageSquare, Send, X, Bot, User, FileText, BarChart3, 
  Loader2, RefreshCw, Download, Eye, Settings, AlertCircle, Upload as UploadIcon
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  context?: {
    uploadId?: string
    courseName?: string
    responseCount?: number
  }
}

interface AIChatProps {
  isOpen: boolean
  onClose: () => void
  onApiStatusChange?: () => void
}

export default function AIChat({ isOpen, onClose, onApiStatusChange }: AIChatProps) {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [uploads, setUploads] = useState<any[]>([])
  const [selectedUpload, setSelectedUpload] = useState<string>('')
  const [apiStatus, setApiStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      // Prevent background scrolling
      document.body.style.overflow = 'hidden'
      
      loadUploads()
      checkApiStatus()
      
      // Add welcome message
      if (messages.length === 0) {
        setMessages([{
          id: '1',
          role: 'assistant',
          content: `Hello! I'm your AI assistant for survey analysis. I can help you:

• Analyze survey responses and identify trends
• Generate insights from your course evaluations
• Answer questions about specific uploads or participants
• Create summaries and reports
• Suggest improvements based on feedback

What would you like to know about your survey data?`,
          timestamp: new Date()
        }])
      }
    } else {
      // Restore background scrolling
      document.body.style.overflow = 'unset'
    }

    // Cleanup function to restore scrolling when component unmounts
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const checkApiStatus = async () => {
    try {
      setApiStatus('checking')
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log('No user found')
        setApiStatus('disconnected')
        onApiStatusChange?.()
        return
      }

      console.log('Checking API status for user:', user.id)

      // Get user settings to check OpenAI configuration
      const { data: settings, error } = await supabase
        .from('user_settings')
        .select('openai_enabled, openai_api_key, openai_model')
        .eq('user_id', user.id)
        .maybeSingle()

      console.log('Settings query result:', { settings, error })

      if (error) {
        console.error('Error checking API status:', error)
        setApiStatus('disconnected')
        onApiStatusChange?.()
        return
      }

      // If no settings record exists, user hasn't configured anything yet
      if (!settings) {
        console.log('No settings found for user')
        setApiStatus('disconnected')
        onApiStatusChange?.()
        return
      }

      // Check if OpenAI is enabled and API key is configured
      const hasApiKey = settings.openai_api_key && settings.openai_api_key.trim().length > 10
      const isEnabled = settings.openai_enabled === true

      console.log('API Status check:', {
        hasApiKey: !!hasApiKey,
        isEnabled,
        keyLength: settings.openai_api_key?.length || 0
      })

      if (isEnabled && hasApiKey) {
        console.log('API is connected')
        setApiStatus('connected')
      } else {
        console.log('API is disconnected - enabled:', isEnabled, 'hasKey:', !!hasApiKey)
        setApiStatus('disconnected')
      }
      
      // Notify parent component of status change
      onApiStatusChange?.()
    } catch (error) {
      console.error('Error checking API status:', error)
      setApiStatus('disconnected')
      onApiStatusChange?.()
    }
  }

  const loadUploads = async () => {
    try {
      const { data, error } = await supabase
        .from('course_uploads')
        .select('id, course_name, processed_forms, processing_status')
        .eq('processing_status', 'completed')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUploads(data || [])
    } catch (error: any) {
      console.error('Error loading uploads:', error)
    }
  }

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    // Check API status before sending
    if (apiStatus === 'disconnected') {
      toast.error('OpenAI is not configured. Please set up your API key in Settings.')
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date(),
      context: selectedUpload ? {
        uploadId: selectedUpload,
        courseName: uploads.find((u: any) => u.id === selectedUpload)?.course_name,
        responseCount: uploads.find((u: any) => u.id === selectedUpload)?.processed_forms
      } : undefined
    }

    setMessages((prev: Message[]) => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    try {
      // Prepare context data
      let contextData = null
      if (selectedUpload) {
        const { data: responses, error } = await supabase
          .from('survey_responses')
          .select('*')
          .eq('upload_id', selectedUpload)

        if (!error && responses) {
          contextData = {
            upload: uploads.find((u: any) => u.id === selectedUpload),
            responses: responses
          }
        }
      }

      // Get the current user's session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('User is not authenticated. Please log in again.');
      }

      const response = await fetch(`${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputMessage,
          context: contextData,
          conversationHistory: messages.slice(-10) // Last 10 messages for context
        })
      })

      const result = await response.json()

      if (result.success) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: result.response,
          timestamp: new Date()
        }
        setMessages((prev: Message[]) => [...prev, assistantMessage])
        
        // Update API status to connected if successful
        if (apiStatus !== 'connected') {
          setApiStatus('connected')
          onApiStatusChange?.()
        }
      } else {
        throw new Error(result.error || 'Failed to get AI response')
      }
    } catch (error: any) {
      console.error('Error sending message:', error)
      // Update API status based on error
      if (error.message.includes('API key') || error.message.includes('OpenAI') || error.message.includes('not configured')) {
        setApiStatus('disconnected')
        onApiStatusChange?.()
      }
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I apologize, but I encountered an error: ${error.message}. Please make sure OpenAI is configured in your settings and try again.`,
        timestamp: new Date()
      }
      setMessages((prev: Message[]) => [...prev, errorMessage])
      toast.error(`AI assistant error: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([{
      id: '1',
      role: 'assistant',
      content: `Chat cleared! How can I help you analyze your survey data?`,
      timestamp: new Date()
    }])
  }

  const goToSettings = () => {
    onClose()
    navigate('/settings')
  }

  const refreshStatus = async () => {
    console.log('Manually refreshing API status...')
    await checkApiStatus()
    toast.success('API status refreshed')
  }

  const getStatusColor = () => {
    switch (apiStatus) {
      case 'connected':
        return 'text-green-600 bg-green-100'
      case 'disconnected':
        return 'text-red-600 bg-red-100'
      case 'checking':
        return 'text-yellow-600 bg-yellow-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusText = () => {
    switch (apiStatus) {
      case 'connected':
        return 'AI Connected'
      case 'disconnected':
        return 'AI Disconnected'
      case 'checking':
        return 'Checking...'
      default:
        return 'Unknown'
    }
  }

  const suggestedQuestions = [
    "What are the overall satisfaction trends?",
    "Which courses have the highest ratings?",
    "What are the most common suggestions for improvement?",
    "Show me the average ratings for each question",
    "What do participants learn most from the training?",
    "Are there any concerning feedback patterns?"
  ]

  // Handle file upload from chat
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file')
      return
    }
    setUploading(true)
    try {
      // Get user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')
      // Upload to storage
      const filePath = `${user.id}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage.from('survey-pdfs').upload(filePath, file)
      if (uploadError) throw uploadError
      // Create course_uploads record
      const { data: uploadRecord, error: insertError } = await supabase
        .from('course_uploads')
        .insert({
          user_id: user.id,
          course_name: file.name.replace(/\.pdf$/i, ''),
          file_name: file.name,
          file_url: `/storage/v1/object/public/survey-pdfs/${filePath}`,
          processing_status: 'pending',
          created_by: user.id
        })
        .select()
        .maybeSingle()
      if (insertError || !uploadRecord) throw insertError || new Error('Failed to create upload record')
      // Show status in chat
      setMessages((prev: Message[]) => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `PDF uploaded: ${file.name}. Processing will begin shortly. You can ask questions about this document once processing is complete.`,
        timestamp: new Date()
      }])
      // Optionally, poll for processing completion and set as context
      pollProcessingStatus(uploadRecord.id, file.name)
    } catch (error: any) {
      toast.error('Upload failed: ' + error.message)
      setMessages((prev: Message[]) => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Failed to upload PDF: ${error.message}`,
        timestamp: new Date()
      }])
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Poll for processing completion
  const pollProcessingStatus = async (uploadId: string, fileName: string) => {
    let attempts = 0
    const maxAttempts = 30
    const delay = 4000
    while (attempts < maxAttempts) {
      await new Promise(res => setTimeout(res, delay))
      const { data, error } = await supabase
        .from('course_uploads')
        .select('id, processing_status')
        .eq('id', uploadId)
        .maybeSingle()
      if (error) break
      if (data && data.processing_status === 'completed') {
        setMessages((prev: Message[]) => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: `PDF processing complete for: ${fileName}. You can now ask questions about this document.`,
          timestamp: new Date()
        }])
        setSelectedUpload(uploadId)
        loadUploads()
        return
      }
      if (data && data.processing_status === 'failed') {
        setMessages((prev: Message[]) => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: `PDF processing failed for: ${fileName}. Please try again or check your document format.`,
          timestamp: new Date()
        }])
        return
      }
      attempts++
    }
    setMessages((prev: Message[]) => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content: `PDF processing timed out for: ${fileName}. Please try again later.`,
      timestamp: new Date()
    }])
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Bot className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">AI Survey Assistant</h2>
              <div className="flex items-center space-x-2 mt-1">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
                  <div className={`w-2 h-2 rounded-full mr-1 ${
                    apiStatus === 'connected' ? 'bg-green-500' : 
                    apiStatus === 'disconnected' ? 'bg-red-500' : 'bg-yellow-500'
                  } ${apiStatus === 'checking' ? 'animate-pulse' : ''}`}></div>
                  {getStatusText()}
                </span>
                {apiStatus === 'disconnected' && (
                  <button
                    onClick={goToSettings}
                    className="text-xs text-blue-600 hover:text-blue-700 underline"
                  >
                    Configure
                  </button>
                )}
                <button
                  onClick={refreshStatus}
                  className="text-xs text-gray-600 hover:text-gray-700 underline"
                  title="Refresh status"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={goToSettings}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              title="Settings"
            >
              <Settings className="h-5 w-5" />
            </button>
            <button
              onClick={clearChat}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              title="Clear chat"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* API Status Warning */}
        {apiStatus === 'disconnected' && (
          <div className="p-4 bg-red-50 border-b border-red-200 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <div className="flex-1">
                <p className="text-sm text-red-800">
                  OpenAI is not configured. Please set up your API key in Settings to use the AI assistant.
                </p>
              </div>
              <button
                onClick={goToSettings}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
              >
                Go to Settings
              </button>
            </div>
          </div>
        )}

        {/* Context Selector */}
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Analyze specific course:</label>
            <select
              value={selectedUpload}
              onChange={(e) => setSelectedUpload(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={apiStatus === 'disconnected'}
            >
              <option value="">All courses</option>
              {uploads.map(upload => (
                <option key={upload.id} value={upload.id}>
                  {upload.course_name} ({upload.processed_forms} responses)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Messages - This is the main scrollable area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex items-start space-x-3 max-w-4xl ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  message.role === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {message.role === 'user' ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                </div>
                <div className={`rounded-xl p-4 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
                  {message.context && (
                    <div className="mt-2 text-xs opacity-75">
                      Analyzing: {message.context.courseName} ({message.context.responseCount} responses)
                    </div>
                  )}
                  <div className={`text-xs mt-2 ${
                    message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-start space-x-3 max-w-4xl">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="bg-gray-100 text-gray-900 rounded-xl p-4">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Analyzing your data...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Questions */}
        {messages.length <= 1 && apiStatus === 'connected' && (
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <p className="text-sm font-medium text-gray-700 mb-3">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => setInputMessage(question)}
                  className="text-xs px-3 py-2 bg-white border border-gray-300 rounded-full hover:bg-gray-50 transition-colors text-gray-700"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-6 border-t border-gray-200 flex-shrink-0">
          <div className="flex space-x-4 items-center">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={apiStatus === 'connected' ? "Ask me anything about your survey data..." : "Please configure OpenAI in Settings to use the AI assistant"}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:text-gray-500"
              rows={3}
              disabled={isLoading || apiStatus === 'disconnected'}
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading || apiStatus === 'disconnected'}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              <Send className="h-5 w-5" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || apiStatus === 'disconnected'}
              className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              title="Upload PDF Document"
            >
              <UploadIcon className="h-5 w-5 mr-2" />
              {uploading ? 'Uploading...' : 'Upload Document'}
            </button>
            <input
              type="file"
              accept="application/pdf"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          </div>
        </div>
      </div>
    </div>
  )
}