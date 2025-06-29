import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Database } from '../lib/supabase'
import { 
  FileText, Download, Trash2, Eye, Filter, Search, Calendar, 
  BarChart3, Users, TrendingUp, RefreshCw, AlertCircle, 
  CheckCircle, Clock, XCircle, ChevronDown, ChevronRight,
  Star, MessageSquare, Building, Mail, Phone, User
} from 'lucide-react'
import toast from 'react-hot-toast'

type CourseUpload = Database['public']['Tables']['course_uploads']['Row']
type SurveyResponse = Database['public']['Tables']['survey_responses']['Row']

interface CourseStats {
  totalUploads: number
  totalResponses: number
  averageRating: number
  completionRate: number
  recentUploads: number
  processingUploads: number
}

interface DetailedResponse extends SurveyResponse {
  averageLikert: number
  responseCompleteness: number
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [uploads, setUploads] = useState<CourseUpload[]>([])
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null)
  const [selectedUpload, setSelectedUpload] = useState<CourseUpload | null>(null)
  const [responses, setResponses] = useState<DetailedResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stats, setStats] = useState<CourseStats>({ 
    totalUploads: 0, 
    totalResponses: 0, 
    averageRating: 0, 
    completionRate: 0,
    recentUploads: 0,
    processingUploads: 0
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [expandedResponse, setExpandedResponse] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'date' | 'rating' | 'name'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    fetchUploads()
    const interval = setInterval(fetchUploads, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (selectedUpload) {
      fetchResponses(selectedUpload.id)
    }
  }, [selectedUpload])

  const fetchUploads = async () => {
    try {
      setRefreshing(true)
      const { data, error } = await supabase
        .from('course_uploads')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setUploads(data || [])
      
      // Calculate comprehensive stats
      const totalUploads = data?.length || 0
      let totalResponses = 0
      let totalRatings = 0
      let ratingCount = 0
      let completedUploads = 0
      let processingUploads = 0
      let recentUploads = 0

      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

      if (data) {
        for (const upload of data) {
          totalResponses += upload.processed_forms
          if (upload.processing_status === 'completed') {
            completedUploads++
          } else if (upload.processing_status === 'processing') {
            processingUploads++
          }
          
          if (new Date(upload.created_at) > oneWeekAgo) {
            recentUploads++
          }
        }
      }

      // Fetch average ratings from responses
      const { data: responseData } = await supabase
        .from('survey_responses')
        .select('q1_rating, q2_rating, q3_rating, q4_rating, q5_rating, q6_rating, q7_rating, q8_rating, q9_rating, q10_rating')

      if (responseData) {
        responseData.forEach(response => {
          const likertRatings = [
            response.q1_rating, response.q2_rating, response.q3_rating,
            response.q4_rating, response.q5_rating, response.q6_rating,
            response.q7_rating, response.q8_rating, response.q9_rating
          ].filter(r => r !== null) as number[]
          
          if (likertRatings.length > 0) {
            totalRatings += likertRatings.reduce((sum, rating) => sum + rating, 0) / likertRatings.length
            ratingCount++
          }
        })
      }

      setStats({
        totalUploads,
        totalResponses,
        averageRating: ratingCount > 0 ? totalRatings / ratingCount : 0,
        completionRate: totalUploads > 0 ? (completedUploads / totalUploads) * 100 : 0,
        recentUploads,
        processingUploads
      })
    } catch (error: any) {
      toast.error('Error fetching uploads: ' + error.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const fetchResponses = async (uploadId: string) => {
    try {
      const { data, error } = await supabase
        .from('survey_responses')
        .select('*')
        .eq('upload_id', uploadId)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      // Calculate additional metrics for each response
      const enhancedResponses: DetailedResponse[] = (data || []).map(response => {
        const likertRatings = [
          response.q1_rating, response.q2_rating, response.q3_rating,
          response.q4_rating, response.q5_rating, response.q6_rating,
          response.q7_rating, response.q8_rating, response.q9_rating
        ].filter(r => r !== null) as number[]
        
        const averageLikert = likertRatings.length > 0 
          ? likertRatings.reduce((sum, val) => sum + val, 0) / likertRatings.length 
          : 0

        // Calculate response completeness
        const totalFields = 22 // Total possible fields
        const filledFields = Object.values(response).filter(val => val !== null && val !== '').length
        const responseCompleteness = (filledFields / totalFields) * 100

        return {
          ...response,
          averageLikert,
          responseCompleteness
        }
      })

      setResponses(enhancedResponses)
    } catch (error: any) {
      toast.error('Error fetching responses: ' + error.message)
    }
  }

  const deleteUpload = async (uploadId: string) => {
    if (!confirm('Are you sure you want to delete this upload and all its responses?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('course_uploads')
        .delete()
        .eq('id', uploadId)

      if (error) throw error

      toast.success('Upload deleted successfully')
      fetchUploads()
      if (selectedUpload?.id === uploadId) {
        setSelectedUpload(null)
        setResponses([])
      }
    } catch (error: any) {
      toast.error('Error deleting upload: ' + error.message)
    }
  }

  const retryProcessing = async (uploadId: string) => {
    try {
      const upload = uploads.find(u => u.id === uploadId)
      if (!upload) return

      // Update status to processing
      await supabase
        .from('course_uploads')
        .update({ processing_status: 'processing' })
        .eq('id', uploadId)

      // Trigger PDF processing
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uploadId: uploadId,
          fileUrl: upload.file_url
        })
      })

      if (!response.ok) {
        throw new Error('Failed to retry processing')
      }

      toast.success('Processing restarted')
      fetchUploads()
    } catch (error: any) {
      toast.error('Error retrying processing: ' + error.message)
    }
  }

  const exportToCsv = (uploadId?: string) => {
    let dataToExport = responses
    
    if (uploadId) {
      // Export specific upload
      const upload = uploads.find(u => u.id === uploadId)
      if (!upload) return
      dataToExport = responses.filter(r => r.upload_id === uploadId)
    }

    if (dataToExport.length === 0) {
      toast.error('No responses to export')
      return
    }

    const headers = [
      'Course Name', 'Upload Date', 'Response Date', 'Participant Name', 'Company', 'Email', 'Phone',
      'Q1 Rating', 'Q2 Rating', 'Q3 Rating', 'Q4 Rating', 'Q5 Rating', 'Q6 Rating', 'Q7 Rating', 'Q8 Rating', 'Q9 Rating',
      'Average Likert', 'Q10 (0-10)', 'Expectations Met', 'Overall Rating',
      'Key Learning 1', 'Key Learning 2', 'Key Learning 3',
      'Suggestions', 'Comments', 'Interested in More', 'Response Completeness %'
    ]

    const csvContent = [
      headers.join(','),
      ...dataToExport.map(response => [
        response.course_name,
        response.created_at ? new Date(response.created_at).toLocaleDateString() : '',
        response.response_date || '',
        response.participant_name || '',
        response.company || '',
        response.email || '',
        response.phone || '',
        response.q1_rating || '',
        response.q2_rating || '',
        response.q3_rating || '',
        response.q4_rating || '',
        response.q5_rating || '',
        response.q6_rating || '',
        response.q7_rating || '',
        response.q8_rating || '',
        response.q9_rating || '',
        response.averageLikert.toFixed(1),
        response.q10_rating || '',
        response.q11_expectations || '',
        response.q12_overall_rating || '',
        response.learned_1 || '',
        response.learned_2 || '',
        response.learned_3 || '',
        response.suggestions || '',
        response.comments || '',
        response.interested_more || '',
        response.responseCompleteness.toFixed(1)
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `survey_responses_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    
    toast.success('CSV exported successfully')
  }

  const filteredUploads = uploads.filter(upload => {
    const matchesSearch = upload.course_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         upload.file_name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || upload.processing_status === statusFilter
    
    let matchesDate = true
    if (dateFilter !== 'all') {
      const uploadDate = new Date(upload.created_at)
      const now = new Date()
      switch (dateFilter) {
        case 'today':
          matchesDate = uploadDate.toDateString() === now.toDateString()
          break
        case 'week':
          matchesDate = uploadDate > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          matchesDate = uploadDate > new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
      }
    }
    
    return matchesSearch && matchesStatus && matchesDate
  })

  const sortedResponses = [...responses].sort((a, b) => {
    let aVal, bVal
    switch (sortBy) {
      case 'rating':
        aVal = a.averageLikert
        bVal = b.averageLikert
        break
      case 'name':
        aVal = a.participant_name || 'zzz'
        bVal = b.participant_name || 'zzz'
        break
      default:
        aVal = new Date(a.created_at).getTime()
        bVal = new Date(b.created_at).getTime()
    }
    
    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1
    } else {
      return aVal < bVal ? 1 : -1
    }
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200'
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'failed': return 'bg-red-100 text-red-800 border-red-200'
      case 'pending': return 'bg-amber-100 text-amber-800 border-amber-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />
      case 'processing': return <Clock className="h-4 w-4 animate-pulse" />
      case 'failed': return <XCircle className="h-4 w-4" />
      case 'pending': return <AlertCircle className="h-4 w-4" />
      default: return <AlertCircle className="h-4 w-4" />
    }
  }

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return 'text-green-600 bg-green-100'
    if (rating >= 3) return 'text-yellow-600 bg-yellow-100'
    if (rating >= 2) return 'text-orange-600 bg-orange-100'
    return 'text-red-600 bg-red-100'
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
      {/* Enhanced Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Survey Analytics Dashboard</h1>
          <p className="text-gray-600 mt-1">Advanced PDF survey processing with OCR and intelligent data extraction</p>
        </div>
        <button
          onClick={fetchUploads}
          disabled={refreshing}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Enhanced Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className="bg-blue-100 p-3 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Uploads</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalUploads}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className="bg-green-100 p-3 rounded-lg">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Responses</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalResponses}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className="bg-amber-100 p-3 rounded-lg">
              <Star className="h-6 w-6 text-amber-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg. Rating</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className="bg-purple-100 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Success Rate</p>
              <p className="text-2xl font-bold text-gray-900">{stats.completionRate.toFixed(0)}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className="bg-indigo-100 p-3 rounded-lg">
              <Calendar className="h-6 w-6 text-indigo-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">This Week</p>
              <p className="text-2xl font-bold text-gray-900">{stats.recentUploads}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className="bg-orange-100 p-3 rounded-lg">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Processing</p>
              <p className="text-2xl font-bold text-gray-900">{stats.processingUploads}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Filters */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search courses, files, or participants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-gray-400" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>
            <button
              onClick={() => exportToCsv()}
              className="flex items-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Export All</span>
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Course Uploads List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Course Uploads</h2>
          <p className="text-sm text-gray-600 mt-1">Manage your uploaded PDF surveys and processing status</p>
        </div>
        
        {filteredUploads.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No uploads found</p>
            <p className="text-gray-400 text-sm mt-1">Upload your first PDF to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Course & File
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status & Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Responses
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUploads.map((upload) => (
                  <tr key={upload.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <button
                          onClick={() => navigate(`/responses/${upload.id}`)}
                          className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          {upload.course_name}
                        </button>
                        <div className="text-sm text-gray-500">{upload.file_name}</div>
                        <div className="text-xs text-gray-400">
                          {(upload.file_size / 1024 / 1024).toFixed(1)} MB
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(upload.processing_status)}`}>
                          {getStatusIcon(upload.processing_status)}
                          <span className="ml-1">{upload.processing_status}</span>
                        </span>
                        {upload.total_forms > 0 && (
                          <div className="w-32">
                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                              <span>{upload.processed_forms}/{upload.total_forms}</span>
                              <span>{Math.round((upload.processed_forms / upload.total_forms) * 100)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{
                                  width: `${(upload.processed_forms / upload.total_forms) * 100}%`
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {upload.processed_forms} forms
                      </div>
                      {upload.processed_forms > 0 && (
                        <button
                          onClick={() => navigate(`/responses/${upload.id}`)}
                          className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          View details →
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(upload.upload_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {upload.processed_forms > 0 && (
                          <button
                            onClick={() => navigate(`/responses/${upload.id}`)}
                            className="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                            title="View responses"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        )}
                        {upload.processing_status === 'completed' && (
                          <button
                            onClick={() => exportToCsv(upload.id)}
                            className="text-green-600 hover:text-green-700 p-2 rounded-lg hover:bg-green-50 transition-colors"
                            title="Export CSV"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        )}
                        {upload.processing_status === 'failed' && (
                          <button
                            onClick={() => retryProcessing(upload.id)}
                            className="text-orange-600 hover:text-orange-700 p-2 rounded-lg hover:bg-orange-50 transition-colors"
                            title="Retry processing"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteUpload(upload.id)}
                          className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                          title="Delete upload"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}