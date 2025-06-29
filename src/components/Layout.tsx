import React, { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { FileText, Database, Upload, LogOut, User, Settings as SettingsIcon, MessageSquare } from 'lucide-react'
import { supabase } from '../lib/supabase'
import AIChat from './AIChat'
import toast from 'react-hot-toast'

interface LayoutProps {
  user: any
  children: React.ReactNode
}

export default function Layout({ user, children }: LayoutProps) {
  const [showAIChat, setShowAIChat] = useState(false)
  const [apiStatus, setApiStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking')

  useEffect(() => {
    checkApiStatus()
  }, [])

  const checkApiStatus = async () => {
    try {
      setApiStatus('checking')
      
      console.log('Layout: Checking API status for user:', user.id)
      
      // Get user settings to check OpenAI configuration
      const { data: settings, error } = await supabase
        .from('user_settings')
        .select('openai_enabled, openai_api_key')
        .eq('user_id', user.id)
        .maybeSingle()

      console.log('Layout: Settings query result:', { settings, error })

      if (error) {
        console.error('Layout: Error checking API status:', error)
        setApiStatus('disconnected')
        return
      }

      // If no settings record exists, user hasn't configured anything yet
      if (!settings) {
        console.log('Layout: No settings found for user')
        setApiStatus('disconnected')
        return
      }

      // Check if OpenAI is enabled and API key is configured
      const hasApiKey = settings.openai_api_key && settings.openai_api_key.trim().length > 10
      const isEnabled = settings.openai_enabled === true

      console.log('Layout: API Status check:', {
        hasApiKey: !!hasApiKey,
        isEnabled,
        keyLength: settings.openai_api_key?.length || 0
      })

      if (isEnabled && hasApiKey) {
        console.log('Layout: API is connected')
        setApiStatus('connected')
      } else {
        console.log('Layout: API is disconnected - enabled:', isEnabled, 'hasKey:', !!hasApiKey)
        setApiStatus('disconnected')
      }
    } catch (error) {
      console.error('Layout: Error checking API status:', error)
      setApiStatus('disconnected')
    }
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      toast.success('Signed out successfully')
    } catch (error) {
      toast.error('Error signing out')
    }
  }

  const getStatusColor = () => {
    switch (apiStatus) {
      case 'connected':
        return 'bg-green-500'
      case 'disconnected':
        return 'bg-red-500'
      case 'checking':
        return 'bg-yellow-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusText = () => {
    switch (apiStatus) {
      case 'connected':
        return 'AI Connected'
      case 'disconnected':
        return 'AI Disconnected - Configure in Settings'
      case 'checking':
        return 'Checking AI Status...'
      default:
        return 'AI Status Unknown'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-2">
                <FileText className="h-8 w-8 text-blue-600" />
                <h1 className="text-xl font-bold text-gray-900">Survey Extractor</h1>
              </div>
              
              <div className="hidden md:flex space-x-6">
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    `flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`
                  }
                >
                  <Database className="h-4 w-4" />
                  <span>Dashboard</span>
                </NavLink>
                
                <NavLink
                  to="/upload"
                  className={({ isActive }) =>
                    `flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`
                  }
                >
                  <Upload className="h-4 w-4" />
                  <span>Upload PDF</span>
                </NavLink>

                <NavLink
                  to="/settings"
                  className={({ isActive }) =>
                    `flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`
                  }
                >
                  <SettingsIcon className="h-4 w-4" />
                  <span>Settings</span>
                </NavLink>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <User className="h-4 w-4" />
                <span>{user?.email}</span>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Floating AI Chat Button */}
      <button
        onClick={() => setShowAIChat(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-40 group"
        title="AI Assistant"
      >
        <MessageSquare className="h-6 w-6" />
        
        {/* API Status Indicator */}
        <div className={`absolute -top-2 -right-2 w-3 h-3 ${getStatusColor()} rounded-full ${apiStatus === 'checking' ? 'animate-pulse' : ''}`}></div>
        
        {/* Enhanced Tooltip */}
        <div className="absolute right-full mr-3 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
          <div className="font-medium">AI Survey Assistant</div>
          <div className="text-xs text-gray-300 mt-1">{getStatusText()}</div>
          <div className="absolute top-1/2 left-full w-0 h-0 border-l-4 border-l-gray-900 border-t-4 border-t-transparent border-b-4 border-b-transparent transform -translate-y-1/2"></div>
        </div>
      </button>

      {/* AI Chat Modal */}
      <AIChat 
        isOpen={showAIChat} 
        onClose={() => setShowAIChat(false)}
        onApiStatusChange={checkApiStatus}
      />
    </div>
  )
}