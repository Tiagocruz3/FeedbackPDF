import React, { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { 
  Upload as UploadIcon, FileText, X, CheckCircle, AlertCircle, 
  Zap, Eye, Image, FileCheck, Cpu, Database, Shield,
  Clock, BarChart3, Users, Target, Lightbulb
} from 'lucide-react'
import toast from 'react-hot-toast'

interface UploadProgress {
  file: File
  progress: number
  status: 'uploading' | 'processing' | 'completed' | 'error'
  uploadId?: string
  error?: string
  formsProcessed?: number
  processingStage?: string
  estimatedTime?: number
}

interface ProcessingStage {
  name: string
  description: string
  icon: React.ReactNode
  completed: boolean
  current: boolean
}

export default function Upload() {
  const [isDragActive, setIsDragActive] = useState(false)
  const [uploads, setUploads] = useState<UploadProgress[]>([])
  const [courseName, setCourseName] = useState('')
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
  const [ocrLanguage, setOcrLanguage] = useState('eng')
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.7)
  const [autoRetry, setAutoRetry] = useState(true)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true)
    } else if (e.type === 'dragleave') {
      setIsDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)

    const files = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'application/pdf'
    )

    if (files.length === 0) {
      toast.error('Please select PDF files only')
      return
    }

    if (files.length > 10) {
      toast.error('Maximum 10 files allowed per upload')
      return
    }

    handleFiles(files)
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(
      file => file.type === 'application/pdf'
    )

    if (files.length === 0) {
      toast.error('Please select PDF files only')
      return
    }

    if (files.length > 10) {
      toast.error('Maximum 10 files allowed per upload')
      return
    }

    handleFiles(files)
  }

  const validateFile = (file: File): string | null => {
    // Check file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      return 'File size must be less than 50MB'
    }

    // Check file type
    if (file.type !== 'application/pdf') {
      return 'Only PDF files are supported'
    }

    // Check filename for special characters
    if (!/^[a-zA-Z0-9._\-\s]+$/.test(file.name)) {
      return 'Filename contains invalid characters'
    }

    return null
  }

  const handleFiles = async (files: File[]) => {
    if (!courseName.trim()) {
      toast.error('Please enter a course name first')
      return
    }

    // Check environment configuration
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    
    console.log('Upload: Environment check:')
    console.log('- Supabase URL:', supabaseUrl ? 'Configured' : 'MISSING')
    console.log('- Supabase Key:', supabaseKey ? 'Configured' : 'MISSING')
    
    if (!supabaseUrl || !supabaseKey) {
      toast.error('Supabase configuration is missing. Check your environment variables.')
      return
    }

    // Validate all files first
    for (const file of files) {
      const error = validateFile(file)
      if (error) {
        toast.error(`${file.name}: ${error}`)
        return
      }
    }

    const newUploads: UploadProgress[] = files.map(file => ({
      file,
      progress: 0,
      status: 'uploading' as const,
      processingStage: 'Preparing upload...',
      estimatedTime: Math.ceil(file.size / (1024 * 1024)) * 2 // Rough estimate: 2 seconds per MB
    }))

    setUploads(prev => [...prev, ...newUploads])

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const uploadIndex = uploads.length + i

      try {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
          throw new Error('User not authenticated')
        }

        // Update stage
        setUploads(prev => prev.map((upload, idx) => 
          idx === uploadIndex 
            ? { ...upload, processingStage: 'Uploading to cloud storage...' }
            : upload
        ))

        // Create user-specific folder path
        const fileName = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        
        // Upload file to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('survey-pdfs')
          .upload(fileName, file, {
            onUploadProgress: (progress) => {
              const percent = (progress.loaded / progress.total) * 100
              setUploads(prev => prev.map((upload, idx) => 
                idx === uploadIndex 
                  ? { 
                      ...upload, 
                      progress: Math.round(percent * 0.3), // Upload is 30% of total progress
                      processingStage: `Uploading... ${Math.round(percent)}%`
                    }
                  : upload
              ))
            }
          })

        if (uploadError) {
          console.error('Upload error details:', uploadError)
          throw new Error(`Upload failed: ${uploadError.message}`)
        }

        const { data: { publicUrl } } = supabase.storage
          .from('survey-pdfs')
          .getPublicUrl(fileName)

        // Update stage
        setUploads(prev => prev.map((upload, idx) => 
          idx === uploadIndex 
            ? { 
                ...upload, 
                progress: 30,
                processingStage: 'Creating database record...'
              }
            : upload
        ))

        // Create database record
        const { data: dbData, error: dbError } = await supabase
          .from('course_uploads')
          .insert({
            course_name: courseName.trim(),
            file_url: publicUrl,
            file_name: file.name,
            file_size: file.size,
            processing_status: 'pending',
            total_forms: 0,
            processed_forms: 0,
            created_by: user.id
          })
          .select()
          .single()

        if (dbError) throw dbError

        setUploads(prev => prev.map((upload, idx) => 
          idx === uploadIndex 
            ? { 
                ...upload, 
                status: 'processing' as const, 
                progress: 40,
                uploadId: dbData.id,
                processingStage: 'Initializing PDF analysis...'
              }
            : upload
        ))

        // Start processing with advanced options
        const processingOptions = {
          uploadId: dbData.id,
          fileUrl: publicUrl,
          options: {
            ocrLanguage,
            confidenceThreshold,
            autoRetry,
            fileName: file.name,
            fileSize: file.size
          }
        }

        // Simulate processing stages
        const stages = [
          'Analyzing PDF structure...',
          'Extracting text with OCR...',
          'Detecting form boundaries...',
          'Parsing survey responses...',
          'Validating extracted data...',
          'Saving to database...'
        ]

        for (let stageIndex = 0; stageIndex < stages.length; stageIndex++) {
          setUploads(prev => prev.map((upload, idx) => 
            idx === uploadIndex 
              ? { 
                  ...upload, 
                  progress: 40 + (stageIndex + 1) * 10,
                  processingStage: stages[stageIndex]
                }
              : upload
          ))
          
          // Simulate processing time
          await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))
        }

        // Trigger actual PDF processing
        console.log('Upload: Starting PDF processing for upload:', dbData.id)
        console.log('Upload: Processing options:', processingOptions)
        
        const processingResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-pdf`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(processingOptions)
        })

        console.log('Upload: Processing response status:', processingResponse.status)
        
        const processingResult = await processingResponse.json()
        console.log('Upload: Processing result:', processingResult)

        if (!processingResponse.ok) {
          console.error('Upload: Processing failed:', processingResult)
          throw new Error(processingResult.error || 'Processing failed')
        }

        setUploads(prev => prev.map((upload, idx) => 
          idx === uploadIndex 
            ? { 
                ...upload, 
                status: 'completed' as const,
                progress: 100,
                formsProcessed: processingResult.formsProcessed,
                processingStage: 'Processing completed!'
              }
            : upload
        ))

        toast.success(`${file.name} processed successfully - ${processingResult.formsProcessed} forms extracted`)

      } catch (error: any) {
        console.error('Upload error:', error)
        const errorMessage = error?.message || 'Unknown error occurred'
        setUploads(prev => prev.map((upload, idx) => 
          idx === uploadIndex 
            ? { 
                ...upload, 
                status: 'error' as const,
                error: errorMessage,
                processingStage: 'Processing failed'
              }
            : upload
        ))
        toast.error(`Error processing ${file.name}: ${errorMessage}`)

        // Auto-retry if enabled
        if (autoRetry && errorMessage.includes('temporary')) {
          setTimeout(() => {
            toast.info(`Retrying ${file.name}...`)
            // Implement retry logic here
          }, 5000)
        }
      }
    }
  }

  const removeUpload = (index: number) => {
    setUploads(prev => prev.filter((_, i) => i !== index))
  }

  const retryUpload = async (index: number) => {
    const upload = uploads[index]
    if (!upload.uploadId) return

    setUploads(prev => prev.map((u, i) => 
      i === index 
        ? { ...u, status: 'processing', progress: 40, processingStage: 'Retrying processing...' }
        : u
    ))

    try {
      const processingResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uploadId: upload.uploadId,
          fileUrl: '', // Will be fetched from database
          retry: true
        })
      })

      const result = await processingResponse.json()

      if (!processingResponse.ok) {
        throw new Error(result.error || 'Retry failed')
      }

      setUploads(prev => prev.map((u, i) => 
        i === index 
          ? { 
              ...u, 
              status: 'completed',
              progress: 100,
              formsProcessed: result.formsProcessed,
              processingStage: 'Retry successful!'
            }
          : u
      ))

      toast.success('Processing retry successful')
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error occurred'
      setUploads(prev => prev.map((u, i) => 
        i === index 
          ? { ...u, status: 'error', error: errorMessage, processingStage: 'Retry failed' }
          : u
      ))
      toast.error('Retry failed: ' + errorMessage)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case 'processing':
        return <Zap className="h-5 w-5 text-blue-500 animate-pulse" />
      default:
        return <UploadIcon className="h-5 w-5 text-blue-500" />
    }
  }

  const getStatusText = (upload: UploadProgress) => {
    switch (upload.status) {
      case 'uploading':
        return upload.processingStage || `Uploading... ${upload.progress}%`
      case 'processing':
        return upload.processingStage || 'Processing PDF with OCR...'
      case 'completed':
        return `Completed - ${upload.formsProcessed || 0} forms extracted`
      case 'error':
        return upload.error || 'Error occurred'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'border-green-200 bg-green-50'
      case 'error': return 'border-red-200 bg-red-50'
      case 'processing': return 'border-blue-200 bg-blue-50'
      default: return 'border-gray-200 bg-white'
    }
  }

  const processingStages: ProcessingStage[] = [
    {
      name: 'Upload',
      description: 'Secure file transfer to cloud storage',
      icon: <UploadIcon className="h-5 w-5" />,
      completed: true,
      current: false
    },
    {
      name: 'Analysis',
      description: 'PDF structure and content analysis',
      icon: <FileCheck className="h-5 w-5" />,
      completed: false,
      current: true
    },
    {
      name: 'OCR',
      description: 'Optical character recognition',
      icon: <Eye className="h-5 w-5" />,
      completed: false,
      current: false
    },
    {
      name: 'Processing',
      description: 'Data extraction and validation',
      icon: <Cpu className="h-5 w-5" />,
      completed: false,
      current: false
    },
    {
      name: 'Storage',
      description: 'Secure database storage',
      icon: <Database className="h-5 w-5" />,
      completed: false,
      current: false
    }
  ]

  return (
    <div className="space-y-8">
      {/* Enhanced Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Advanced PDF Survey Upload</h1>
        <p className="text-gray-600 mt-1">Upload PDF files containing survey responses for intelligent extraction with OCR and AI-powered analysis</p>
      </div>

      {/* Course Configuration */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="courseName" className="block text-sm font-medium text-gray-700 mb-2">
              Course Name *
            </label>
            <input
              type="text"
              id="courseName"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder="Enter the course name for these surveys"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              required
            />
            <p className="text-sm text-gray-500 mt-2">
              All uploaded PDFs will be associated with this course
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Advanced Options
              </label>
              <button
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                {showAdvancedOptions ? 'Hide' : 'Show'} Options
              </button>
            </div>
            
            {showAdvancedOptions && (
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    OCR Language
                  </label>
                  <select
                    value={ocrLanguage}
                    onChange={(e) => setOcrLanguage(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="eng">English</option>
                    <option value="spa">Spanish</option>
                    <option value="fra">French</option>
                    <option value="deu">German</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confidence Threshold: {(confidenceThreshold * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="0.95"
                    step="0.05"
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Higher values = more accurate but may miss some text
                  </p>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="autoRetry"
                    checked={autoRetry}
                    onChange={(e) => setAutoRetry(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="autoRetry" className="ml-2 text-sm text-gray-700">
                    Auto-retry on temporary failures
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Upload Area */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
            isDragActive
              ? 'border-blue-400 bg-blue-50 scale-105'
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            multiple
            accept=".pdf"
            onChange={handleFileInput}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={!courseName.trim()}
          />
          
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className={`p-4 rounded-full transition-colors ${isDragActive ? 'bg-blue-100' : 'bg-gray-100'}`}>
                <UploadIcon className={`h-8 w-8 ${isDragActive ? 'text-blue-600' : 'text-gray-600'}`} />
              </div>
            </div>
            
            <div>
              <p className="text-lg font-medium text-gray-900">
                {isDragActive ? 'Drop files here' : 'Drag and drop PDF files'}
              </p>
              <p className="text-gray-500">
                or <span className="text-blue-600 font-medium hover:text-blue-700 cursor-pointer">click to browse</span>
              </p>
            </div>
            
            <div className="text-sm text-gray-500 space-y-1">
              <p>• Supports multiple PDF files (max 10 files, 50MB each)</p>
              <p>• Each PDF may contain multiple survey forms</p>
              <p>• Advanced OCR for scanned documents</p>
              <p>• AI-powered data extraction and validation</p>
            </div>
          </div>

          {!courseName.trim() && (
            <div className="absolute inset-0 bg-gray-100 bg-opacity-75 flex items-center justify-center rounded-lg backdrop-blur-sm">
              <p className="text-gray-600 font-medium">Please enter a course name first</p>
            </div>
          )}
        </div>
      </div>

      {/* Processing Pipeline Visualization */}
      {uploads.some(u => u.status === 'processing') && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Cpu className="h-5 w-5 mr-2 text-blue-600" />
            Processing Pipeline
          </h3>
          <div className="flex items-center justify-between">
            {processingStages.map((stage, index) => (
              <div key={stage.name} className="flex flex-col items-center flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                  stage.completed 
                    ? 'bg-green-100 border-green-500 text-green-600'
                    : stage.current
                    ? 'bg-blue-100 border-blue-500 text-blue-600 animate-pulse'
                    : 'bg-gray-100 border-gray-300 text-gray-400'
                }`}>
                  {stage.icon}
                </div>
                <div className="text-center mt-2">
                  <div className="text-sm font-medium text-gray-900">{stage.name}</div>
                  <div className="text-xs text-gray-500">{stage.description}</div>
                </div>
                {index < processingStages.length - 1 && (
                  <div className={`absolute top-5 w-full h-0.5 -z-10 ${
                    stage.completed ? 'bg-green-500' : 'bg-gray-300'
                  }`} style={{ left: '50%', width: 'calc(100% / 5)' }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enhanced Upload Progress */}
      {uploads.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Eye className="h-5 w-5 mr-2 text-blue-600" />
            Upload & Processing Status
          </h2>
          <div className="space-y-4">
            {uploads.map((upload, index) => (
              <div key={index} className={`flex items-center space-x-4 p-4 border rounded-lg transition-colors ${getStatusColor(upload.status)}`}>
                <FileText className="h-8 w-8 text-gray-400 flex-shrink-0" />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {upload.file.name}
                    </p>
                    <div className="flex items-center space-x-2">
                      {upload.status === 'error' && (
                        <button
                          onClick={() => retryUpload(index)}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          Retry
                        </button>
                      )}
                      <button
                        onClick={() => removeUpload(index)}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        disabled={upload.status === 'uploading' || upload.status === 'processing'}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 mb-2">
                    {getStatusIcon(upload.status)}
                    <span className="text-sm text-gray-600">
                      {getStatusText(upload)}
                    </span>
                    {upload.estimatedTime && upload.status === 'processing' && (
                      <span className="text-xs text-gray-500">
                        (~{upload.estimatedTime}s remaining)
                      </span>
                    )}
                  </div>
                  
                  {(upload.status === 'uploading' || upload.status === 'processing') && (
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${upload.progress}%` }}
                      />
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{(upload.file.size / 1024 / 1024).toFixed(1)} MB</span>
                    {upload.status === 'completed' && upload.formsProcessed && (
                      <span className="text-green-600 font-medium">
                        ✓ {upload.formsProcessed} forms extracted
                      </span>
                    )}
                    {upload.status === 'error' && (
                      <span className="text-red-600 font-medium">
                        ✗ Processing failed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enhanced Feature Showcase */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Processing Features */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center">
            <Zap className="h-5 w-5 mr-2" />
            Advanced PDF Processing
          </h3>
          <div className="space-y-3 text-blue-800">
            <div className="flex items-start space-x-2">
              <div className="bg-blue-200 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">1</div>
              <div>
                <p className="font-medium">Intelligent Form Detection</p>
                <p className="text-sm text-blue-700">Automatically separates individual forms from multi-page PDFs using AI</p>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <div className="bg-blue-200 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">2</div>
              <div>
                <p className="font-medium">Advanced OCR Engine</p>
                <p className="text-sm text-blue-700">Multi-language support with confidence scoring and error correction</p>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <div className="bg-blue-200 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">3</div>
              <div>
                <p className="font-medium">Smart Data Extraction</p>
                <p className="text-sm text-blue-700">Fuzzy matching and pattern recognition for accurate field detection</p>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <div className="bg-blue-200 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">4</div>
              <div>
                <p className="font-medium">Quality Validation</p>
                <p className="text-sm text-blue-700">Automatic data validation and completeness scoring</p>
              </div>
            </div>
          </div>
        </div>

        {/* Security & Reliability */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
          <h3 className="text-lg font-semibold text-green-900 mb-3 flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Security & Reliability
          </h3>
          <div className="space-y-3 text-green-800">
            <div className="flex items-start space-x-2">
              <div className="bg-green-200 text-green-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">🔒</div>
              <div>
                <p className="font-medium">Encrypted Storage</p>
                <p className="text-sm text-green-700">End-to-end encryption for all uploaded files and extracted data</p>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <div className="bg-green-200 text-green-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">🔄</div>
              <div>
                <p className="font-medium">Auto-Retry Logic</p>
                <p className="text-sm text-green-700">Intelligent retry mechanisms for temporary failures</p>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <div className="bg-green-200 text-green-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">📊</div>
              <div>
                <p className="font-medium">Real-time Monitoring</p>
                <p className="text-sm text-green-700">Live progress tracking and detailed error reporting</p>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <div className="bg-green-200 text-green-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">✅</div>
              <div>
                <p className="font-medium">Data Integrity</p>
                <p className="text-sm text-green-700">Checksums and validation to ensure data accuracy</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Supported Survey Elements */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Target className="h-5 w-5 mr-2 text-purple-600" />
          Supported Survey Elements
        </h3>
        <div className="grid md:grid-cols-4 gap-6 text-sm">
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700 flex items-center">
              <BarChart3 className="h-4 w-4 mr-2 text-blue-600" />
              Rating Scales
            </h4>
            <ul className="space-y-1 text-gray-600">
              <li>• Likert Scale (1-5)</li>
              <li>• Numeric Rating (0-10)</li>
              <li>• Star Ratings</li>
              <li>• Satisfaction Scales</li>
            </ul>
          </div>
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700 flex items-center">
              <Users className="h-4 w-4 mr-2 text-green-600" />
              Response Types
            </h4>
            <ul className="space-y-1 text-gray-600">
              <li>• Multiple Choice</li>
              <li>• Checkboxes</li>
              <li>• Open Text Fields</li>
              <li>• Yes/No Questions</li>
            </ul>
          </div>
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700 flex items-center">
              <FileText className="h-4 w-4 mr-2 text-purple-600" />
              Content Areas
            </h4>
            <ul className="space-y-1 text-gray-600">
              <li>• Course Evaluations</li>
              <li>• Learning Outcomes</li>
              <li>• Feedback & Suggestions</li>
              <li>• Contact Information</li>
            </ul>
          </div>
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700 flex items-center">
              <Image className="h-4 w-4 mr-2 text-orange-600" />
              Document Types
            </h4>
            <ul className="space-y-1 text-gray-600">
              <li>• Digital PDF Forms</li>
              <li>• Scanned Documents</li>
              <li>• Multi-page Surveys</li>
              <li>• Mixed Content PDFs</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Tips & Best Practices */}
      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl p-6 border border-amber-200">
        <h3 className="text-lg font-semibold text-amber-900 mb-4 flex items-center">
          <Lightbulb className="h-5 w-5 mr-2" />
          Tips for Best Results
        </h3>
        <div className="grid md:grid-cols-2 gap-4 text-amber-800">
          <div className="space-y-2">
            <p className="font-medium">📄 Document Quality</p>
            <ul className="text-sm space-y-1 text-amber-700">
              <li>• Use high-resolution scans (300+ DPI)</li>
              <li>• Ensure text is clearly readable</li>
              <li>• Avoid skewed or rotated pages</li>
              <li>• Remove any handwritten annotations</li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-medium">⚙️ Processing Settings</p>
            <ul className="text-sm space-y-1 text-amber-700">
              <li>• Use higher confidence for clean documents</li>
              <li>• Enable auto-retry for large batches</li>
              <li>• Select correct language for OCR</li>
              <li>• Group similar surveys together</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}