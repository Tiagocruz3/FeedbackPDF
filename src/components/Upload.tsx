import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload as UploadIcon, X, FileText, Image, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'

interface FileWithProgress {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error'
  error?: string
  id: string
}

const SUPPORTED_FORMATS = {
  'application/pdf': { ext: 'pdf', icon: FileText, color: 'text-red-500' },
  'image/jpeg': { ext: 'jpg', icon: Image, color: 'text-blue-500' },
  'image/jpg': { ext: 'jpg', icon: Image, color: 'text-blue-500' },
  'image/png': { ext: 'png', icon: Image, color: 'text-green-500' },
  'image/tiff': { ext: 'tiff', icon: Image, color: 'text-purple-500' },
  'image/bmp': { ext: 'bmp', icon: Image, color: 'text-yellow-500' }
}

export default function Upload() {
  const [courseName, setCourseName] = useState('')
  const [files, setFiles] = useState<FileWithProgress[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const navigate = useNavigate()

  const validateFile = (file: File): string | null => {
    if (!SUPPORTED_FORMATS[file.type]) {
      const supportedTypes = Object.values(SUPPORTED_FORMATS).map(f => f.ext).join(', ')
      return `Unsupported file type. Supported: ${supportedTypes}`
    }
    if (file.size > 50 * 1024 * 1024) {
      return 'File size exceeds 50MB limit'
    }
    return null
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    addFiles(droppedFiles)
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      addFiles(selectedFiles)
    }
  }

  const addFiles = (newFiles: File[]) => {
    const validatedFiles: FileWithProgress[] = newFiles.map(file => {
      const error = validateFile(file)
      return {
        file,
        progress: 0,
        status: error ? 'error' : 'pending',
        error,
        id: `${file.name}-${Date.now()}-${Math.random()}`
      }
    })
    setFiles(prev => [...prev, ...validatedFiles])
  }

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const updateFileStatus = (
    fileId: string, 
    status: FileWithProgress['status'], 
    progress: number,
    error?: string
  ) => {
    setFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, status, progress, error } : f
    ))
  }

  const uploadAndProcessFiles = async () => {
    if (!courseName.trim()) {
      toast.error('Please enter a course name')
      return
    }

    const validFiles = files.filter(f => f.status !== 'error')
    if (validFiles.length === 0) {
      toast.error('No valid files to process')
      return
    }

    setIsProcessing(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Please sign in to continue')
      return
    }

    const { data: settings } = await supabase
      .from('user_settings')
      .select('openai_api_key, openai_model')
      .eq('user_id', user.id)
      .single()

    if (!settings?.openai_api_key) {
      toast.error('Please configure your OpenAI API key in settings')
      navigate('/settings')
      return
    }

    for (const fileData of validFiles) {
      try {
        updateFileStatus(fileData.id, 'uploading', 0)

        const fileName = `${user.id}/${courseName}/${Date.now()}_${fileData.file.name}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('pdfs')
          .upload(fileName, fileData.file, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) throw uploadError

        updateFileStatus(fileData.id, 'uploading', 50)

        const { data: { publicUrl } } = supabase.storage
          .from('pdfs')
          .getPublicUrl(fileName)

        const { data: logData, error: logError } = await supabase
          .from('processing_logs')
          .insert({
            user_id: user.id,
            course_name: courseName,
            file_name: fileData.file.name,
            file_type: fileData.file.type,
            file_size: fileData.file.size,
            status: 'processing',
            started_at: new Date().toISOString()
          })
          .select()
          .single()

        if (logError) throw logError

        updateFileStatus(fileData.id, 'processing', 75)

        const { data: processData, error: processError } = await supabase.functions.invoke('process-pdf', {
          body: {
            fileUrl: publicUrl,
            courseName,
            userId: user.id,
            openaiApiKey: settings.openai_api_key,
            model: settings.openai_model || 'gpt-4-vision-preview'
          }
        })

        if (processError) throw processError

        await supabase
          .from('processing_logs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            extracted_responses: processData.responses?.length || 0
          })
          .eq('id', logData.id)

        updateFileStatus(fileData.id, 'completed', 100)
        toast.success(`Successfully processed ${fileData.file.name}`)

      } catch (error) {
        console.error('Error processing file:', error)
        updateFileStatus(fileData.id, 'error', 0, error.message || 'Processing failed')
        
        await supabase
          .from('processing_logs')
          .update({
            status: 'failed',
            error_message: error.message || 'Unknown error',
            completed_at: new Date().toISOString()
          })
          .match({ 
            user_id: user.id, 
            file_name: fileData.file.name,
            status: 'processing'
          })

        toast.error(`Failed to process ${fileData.file.name}: ${error.message}`)
      }
    }

    setIsProcessing(false)

    const successfulFiles = files.filter(f => f.status === 'completed')
    if (successfulFiles.length > 0) {
      setTimeout(() => {
        navigate('/responses', { state: { courseName } })
      }, 1500)
    }
  }

  const getFileIcon = (file: File) => {
    const format = SUPPORTED_FORMATS[file.type]
    if (format) {
      const Icon = format.icon
      return <Icon className={`w-5 h-5 ${format.color}`} />
    }
    return <FileText className="w-5 h-5 text-gray-400" />
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Upload Survey Files</h1>

      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Course Name</label>
        <input
          type="text"
          value={courseName}
          onChange={(e) => setCourseName(e.target.value)}
          placeholder="Enter course name"
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          disabled={isProcessing}
        />
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        } ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <input
          type="file"
          id="file-upload"
          multiple
          accept=".pdf,image/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isProcessing}
        />
        
        <label htmlFor="file-upload" className={isProcessing ? 'cursor-not-allowed' : 'cursor-pointer'}>
          <UploadIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg mb-2">
            {isDragging ? 'Drop files here' : 'Drag and drop files here'}
          </p>
          <p className="text-sm text-gray-500 mb-4">or click to select files</p>
          <p className="text-xs text-gray-400">
            Supported: PDF, JPG, PNG, TIFF, BMP (max 50MB each)
          </p>
        </label>
      </div>

      {files.length > 0 && (
        <div className="mt-6 space-y-2">
          {files.map((fileData) => (
            <div
              key={fileData.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                fileData.status === 'error' ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center space-x-3 flex-1">
                {getFileIcon(fileData.file)}
                <div className="flex-1">
                  <p className="font-medium text-sm">{fileData.file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(fileData.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  {fileData.error && (
                    <p className="text-xs text-red-600 mt-1 flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {fileData.error}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {fileData.status === 'uploading' || fileData.status === 'processing' ? (
                  <div className="w-32">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span>{fileData.status}</span>
                      <span>{fileData.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${fileData.progress}%` }}
                      />
                    </div>
                  </div>
                ) : fileData.status === 'completed' ? (
                  <span className="text-green-600 text-sm">Completed</span>
                ) : fileData.status === 'error' ? (
                  <span className="text-red-600 text-sm">Failed</span>
                ) : null}

                {!isProcessing && (
                  <button
                    onClick={() => removeFile(fileData.id)}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={uploadAndProcessFiles}
        disabled={!courseName || files.length === 0 || isProcessing}
        className="mt-6 w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        {isProcessing ? 'Processing Files...' : 'Upload and Process'}
      </button>
    </div>
  )
}
