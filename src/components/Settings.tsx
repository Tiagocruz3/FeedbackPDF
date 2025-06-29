import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Settings as SettingsIcon, Save, Eye, EyeOff, TestTube, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface SettingsData {
  openai_api_key?: string
  openai_model?: string
  openai_enabled?: boolean
  ocr_confidence_threshold?: number
  auto_retry?: boolean
  processing_timeout?: number
}

interface OpenAIModel {
  id: string
  object: string
  created: number
  owned_by: string
  root: string
  parent: string | null
}

export default function Settings() {
  const [settings, setSettings] = useState<SettingsData>({
    openai_api_key: '',
    openai_model: 'gpt-4o',
    openai_enabled: false,
    ocr_confidence_threshold: 0.7,
    auto_retry: true,
    processing_timeout: 300
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [availableModels, setAvailableModels] = useState<OpenAIModel[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  useEffect(() => {
    if (settings.openai_api_key && settings.openai_api_key.trim().length > 10 && !settings.openai_enabled) {
      setSettings((prev: SettingsData) => ({ ...prev, openai_enabled: true }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.openai_api_key])

  // Fetch available models from OpenAI API when API key is present
  useEffect(() => {
    const fetchModels = async () => {
      if (!settings.openai_api_key || settings.openai_api_key.trim().length < 10) {
        setAvailableModels([])
        return
      }
      setModelsLoading(true)
      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${settings.openai_api_key}`,
            'Content-Type': 'application/json',
          },
        })
        if (!response.ok) throw new Error('Failed to fetch models')
        const data = await response.json()
        // Filter for chat/completion models only
        const chatModels = data.data.filter((model: OpenAIModel) =>
          model.id.startsWith('gpt-')
        )
        setAvailableModels(chatModels)
      } catch (err: any) {
        setAvailableModels([])
        toast.error('Could not fetch available OpenAI models: ' + err.message)
      } finally {
        setModelsLoading(false)
      }
    }
    fetchModels()
  }, [settings.openai_api_key])

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('No user found')
        return
      }

      console.log('Loading settings for user:', user.id)

      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      console.log('Settings query result:', { data, error })

      if (error) {
        console.error('Error loading settings:', error)
        toast.error('Error loading settings: ' + error.message)
        return
      }

      if (data) {
        console.log('Found existing settings:', data)
        setSettings({
          openai_api_key: data.openai_api_key || '',
          openai_model: data.openai_model || 'gpt-4o',
          openai_enabled: data.openai_enabled || false,
          ocr_confidence_threshold: data.ocr_confidence_threshold || 0.7,
          auto_retry: data.auto_retry !== false,
          processing_timeout: data.processing_timeout || 300
        })
      } else {
        console.log('No existing settings found, using defaults')
        // Keep default settings - no need to create record until user saves
      }
    } catch (error: any) {
      console.error('Error loading settings:', error)
      toast.error('Error loading settings: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    if (settings.openai_api_key && !settings.openai_enabled) {
      toast.error('You have entered an API key but have not enabled OpenAI. Please enable OpenAI to use the chatbot.');
      return;
    }
    try {
      setSaving(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      console.log('Saving settings for user:', user.id)
      console.log('Settings to save:', settings)

      // Use upsert to insert or update the settings record
      const { data, error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          openai_api_key: settings.openai_api_key || null,
          openai_model: settings.openai_model || 'gpt-4o',
          openai_enabled: settings.openai_enabled || false,
          ocr_confidence_threshold: settings.ocr_confidence_threshold || 0.7,
          auto_retry: settings.auto_retry !== false,
          processing_timeout: settings.processing_timeout || 300,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select()

      console.log('Save result:', { data, error })

      if (error) {
        console.error('Error saving settings:', error)
        throw error
      }

      console.log('Settings saved successfully')
      toast.success('Settings saved successfully')
      
      // Reload settings to confirm they were saved
      await loadSettings()
    } catch (error: any) {
      console.error('Error saving settings:', error)
      toast.error('Error saving settings: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const testOpenAIConnection = async () => {
    if (!settings.openai_api_key) {
      toast.error('Please enter an OpenAI API key first')
      return
    }

    try {
      setTesting(true)
      setTestResult(null)

      console.log('Testing OpenAI connection...')

      const response = await fetch(`${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/test-openai`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(import.meta as any).env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: settings.openai_api_key,
          model: settings.openai_model
        })
      })

      const result = await response.json()
      console.log('Test result:', result)

      if (result.success) {
        setTestResult({ success: true, message: 'OpenAI connection successful!' })
        toast.success('OpenAI connection test passed')
      } else {
        setTestResult({ success: false, message: result.error || 'Connection failed' })
        toast.error('OpenAI connection test failed: ' + (result.error || 'Unknown error'))
      }
    } catch (error: any) {
      console.error('Error testing connection:', error)
      const message = error.message || 'Connection test failed'
      setTestResult({ success: false, message })
      toast.error('Error testing connection: ' + message)
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Configure your PDF processing and AI integration settings</p>
      </div>

      {/* OpenAI Configuration */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-green-100 p-2 rounded-lg">
            <SettingsIcon className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">OpenAI Integration</h2>
            <p className="text-gray-600">Use GPT-4 for advanced OCR and intelligent data extraction</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Enable OpenAI */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Enable OpenAI Processing</label>
              <p className="text-sm text-gray-500">Use AI for enhanced PDF text extraction and survey parsing</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.openai_enabled}
                onChange={(e) => setSettings({ ...settings, openai_enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              OpenAI API Key *
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={settings.openai_api_key}
                onChange={(e) => setSettings({ ...settings, openai_api_key: e.target.value })}
                placeholder="sk-..."
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showApiKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Get your API key from{' '}
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
                OpenAI Platform
              </a>
            </p>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              OpenAI Model
            </label>
            <select
              value={settings.openai_model}
              onChange={(e) => setSettings({ ...settings, openai_model: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={modelsLoading || !availableModels.length}
            >
              {modelsLoading && <option>Loading models...</option>}
              {!modelsLoading && availableModels.length === 0 && <option>No models found</option>}
              {!modelsLoading && availableModels.map(model => (
                <option key={model.id} value={model.id}>
                  {model.id}
                </option>
              ))}
            </select>
            <p className="text-sm text-gray-500 mt-1">
              {modelsLoading ? 'Fetching available models from OpenAI...' : 'Select the model you want to use for chat and PDF extraction.'}
            </p>
          </div>

          {/* Test Connection */}
          <div>
            <div className="flex items-center space-x-3">
              <button
                onClick={testOpenAIConnection}
                disabled={testing || !settings.openai_api_key}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <TestTube className={`h-4 w-4 ${testing ? 'animate-spin' : ''}`} />
                <span>{testing ? 'Testing...' : 'Test Connection'}</span>
              </button>
              
              {testResult && (
                <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
                  testResult.success 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {testResult.success ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <span className="text-sm">{testResult.message}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Processing Settings */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Processing Settings</h2>
        
        <div className="space-y-6">
          {/* OCR Confidence Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              OCR Confidence Threshold: {(settings.ocr_confidence_threshold! * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0.5"
              max="0.95"
              step="0.05"
              value={settings.ocr_confidence_threshold}
              onChange={(e) => setSettings({ ...settings, ocr_confidence_threshold: parseFloat(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>50% (More text, less accurate)</span>
              <span>95% (Less text, more accurate)</span>
            </div>
          </div>

          {/* Auto Retry */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Auto-retry on Failures</label>
              <p className="text-sm text-gray-500">Automatically retry processing if temporary errors occur</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.auto_retry}
                onChange={(e) => setSettings({ ...settings, auto_retry: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Processing Timeout */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Processing Timeout (seconds)
            </label>
            <input
              type="number"
              min="60"
              max="600"
              value={settings.processing_timeout}
              onChange={(e) => setSettings({ ...settings, processing_timeout: parseInt(e.target.value) })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-sm text-gray-500 mt-1">
              Maximum time to wait for PDF processing to complete (60-600 seconds)
            </p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save className={`h-4 w-4 ${saving ? 'animate-spin' : ''}`} />
          <span>{saving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>

      {/* Information Panel */}
      <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">About OpenAI Integration</h3>
        <div className="space-y-2 text-blue-800">
          <p>• <strong>Enhanced Accuracy:</strong> GPT-4 can understand context and extract data more accurately than traditional OCR</p>
          <p>• <strong>Intelligent Parsing:</strong> AI can handle variations in form layouts and handwriting</p>
          <p>• <strong>Data Validation:</strong> Automatic validation and correction of extracted survey responses</p>
          <p>• <strong>Cost:</strong> OpenAI charges per token used. Typical survey processing costs $0.01-0.05 per page</p>
          <p>• <strong>Privacy:</strong> Your API key is encrypted and stored securely. PDFs are processed through OpenAI's API</p>
        </div>
      </div>
    </div>
  )
}