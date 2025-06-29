import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Database } from '../lib/supabase'
import { 
  ArrowLeft, Download, Search, Filter, Eye, EyeOff,
  FileText, Users, BarChart3, Calendar, Star,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react'
import toast from 'react-hot-toast'

type SurveyResponse = Database['public']['Tables']['survey_responses']['Row']
type CourseUpload = Database['public']['Tables']['course_uploads']['Row']

interface ResponsesViewProps {}

export default function ResponsesView({}: ResponsesViewProps) {
  const { uploadId } = useParams<{ uploadId: string }>()
  const navigate = useNavigate()
  const [upload, setUpload] = useState<CourseUpload | null>(null)
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set())
  const [sortColumn, setSortColumn] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    if (uploadId) {
      fetchUploadAndResponses()
    }
  }, [uploadId])

  const fetchUploadAndResponses = async () => {
    try {
      setLoading(true)
      
      // Fetch upload details
      const { data: uploadData, error: uploadError } = await supabase
        .from('course_uploads')
        .select('*')
        .eq('id', uploadId)
        .single()

      if (uploadError) throw uploadError
      setUpload(uploadData)

      console.log('ResponsesView: Upload data fetched:', uploadData)

      // Fetch responses
      const { data: responsesData, error: responsesError } = await supabase
        .from('survey_responses')
        .select('*')
        .eq('upload_id', uploadId)
        .order('created_at', { ascending: false })

      if (responsesError) throw responsesError
      
      console.log('ResponsesView: Survey responses fetched:', responsesData)
      console.log('ResponsesView: Number of responses:', responsesData?.length || 0)
      
      // Log sample data structure
      if (responsesData && responsesData.length > 0) {
        console.log('ResponsesView: Sample response data:', responsesData[0])
        console.log('ResponsesView: Sample response fields:', Object.keys(responsesData[0]))
        
        // Log the actual content of key fields
        const sample = responsesData[0]
        console.log('ResponsesView: Response content breakdown:')
        console.log('- Participant Name:', sample.participant_name)
        console.log('- Course Name:', sample.course_name)
        console.log('- Ratings (Q1-Q10):', {
          q1: sample.q1_rating,
          q2: sample.q2_rating,
          q3: sample.q3_rating,
          q4: sample.q4_rating,
          q5: sample.q5_rating,
          q6: sample.q6_rating,
          q7: sample.q7_rating,
          q8: sample.q8_rating,
          q9: sample.q9_rating,
          q10: sample.q10_rating
        })
        console.log('- Text Fields:', {
          learned_1: sample.learned_1,
          learned_2: sample.learned_2,
          learned_3: sample.learned_3,
          suggestions: sample.suggestions,
          comments: sample.comments,
          expectations: sample.q11_expectations,
          overall_rating: sample.q12_overall_rating
        })
        console.log('- Contact Info:', {
          company: sample.company,
          email: sample.email,
          phone: sample.phone
        })
      }
      
      setResponses(responsesData || [])
    } catch (error: any) {
      console.error('ResponsesView: Error fetching data:', error)
      toast.error('Error fetching data: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = () => {
    if (responses.length === 0) {
      toast.error('No data to export')
      return
    }

    const headers = [
      'Participant',
      'Response Date',
      'Q1: Trainer Preparation',
      'Q2: Participation Encouraged',
      'Q3: Content Relevance',
      'Q4: Clear Objectives',
      'Q5: Time Allocation',
      'Q6: Venue Suitability',
      'Q7: Training Methods',
      'Q8: Q&A Opportunity',
      'Q9: Overall Satisfaction',
      'Q10: Recommendation (0-10)',
      'Expectations Met',
      'Overall Rating',
      'Key Learning 1',
      'Key Learning 2',
      'Key Learning 3',
      'Suggestions',
      'Comments',
      'Interested in More',
      'Company',
      'Email',
      'Phone'
    ]

    const csvContent = [
      headers.join(','),
      ...filteredAndSortedResponses.map((response, index) => [
        response.participant_name || `Participant ${index + 1}`,
        response.response_date || '',
        response.q1_rating || '',
        response.q2_rating || '',
        response.q3_rating || '',
        response.q4_rating || '',
        response.q5_rating || '',
        response.q6_rating || '',
        response.q7_rating || '',
        response.q8_rating || '',
        response.q9_rating || '',
        response.q10_rating || '',
        response.q11_expectations || '',
        response.q12_overall_rating || '',
        response.learned_1 || '',
        response.learned_2 || '',
        response.learned_3 || '',
        response.suggestions || '',
        response.comments || '',
        response.interested_more || '',
        response.company || '',
        response.email || '',
        response.phone || ''
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${upload?.course_name || 'survey'}_responses_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    
    toast.success('CSV exported successfully')
  }

  const toggleColumnVisibility = (column: string) => {
    const newHiddenColumns = new Set(hiddenColumns)
    if (newHiddenColumns.has(column)) {
      newHiddenColumns.delete(column)
    } else {
      newHiddenColumns.add(column)
    }
    setHiddenColumns(newHiddenColumns)
  }

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const filteredAndSortedResponses = React.useMemo(() => {
    let filtered = responses.filter(response => {
      const searchLower = searchTerm.toLowerCase()
      return (
        (response.participant_name?.toLowerCase().includes(searchLower)) ||
        (response.company?.toLowerCase().includes(searchLower)) ||
        (response.email?.toLowerCase().includes(searchLower)) ||
        (response.learned_1?.toLowerCase().includes(searchLower)) ||
        (response.learned_2?.toLowerCase().includes(searchLower)) ||
        (response.learned_3?.toLowerCase().includes(searchLower)) ||
        (response.suggestions?.toLowerCase().includes(searchLower)) ||
        (response.comments?.toLowerCase().includes(searchLower))
      )
    })

    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal = a[sortColumn as keyof SurveyResponse]
        let bVal = b[sortColumn as keyof SurveyResponse]
        
        // Handle null/undefined values
        if (aVal === null || aVal === undefined) aVal = ''
        if (bVal === null || bVal === undefined) bVal = ''
        
        // Convert to string for comparison
        const aStr = String(aVal).toLowerCase()
        const bStr = String(bVal).toLowerCase()
        
        if (sortDirection === 'asc') {
          return aStr > bStr ? 1 : -1
        } else {
          return aStr < bStr ? 1 : -1
        }
      })
    }

    return filtered
  }, [responses, searchTerm, sortColumn, sortDirection])

  const paginatedResponses = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredAndSortedResponses.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredAndSortedResponses, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredAndSortedResponses.length / itemsPerPage)

  const columns = [
    { key: 'participant', label: 'Participant', width: 'w-32' },
    { key: 'response_date', label: 'Date', width: 'w-24' },
    { key: 'q1_rating', label: 'Q1: Trainer Prep', width: 'w-20' },
    { key: 'q2_rating', label: 'Q2: Participation', width: 'w-20' },
    { key: 'q3_rating', label: 'Q3: Relevance', width: 'w-20' },
    { key: 'q4_rating', label: 'Q4: Objectives', width: 'w-20' },
    { key: 'q5_rating', label: 'Q5: Time', width: 'w-20' },
    { key: 'q6_rating', label: 'Q6: Venue', width: 'w-20' },
    { key: 'q7_rating', label: 'Q7: Methods', width: 'w-20' },
    { key: 'q8_rating', label: 'Q8: Q&A', width: 'w-20' },
    { key: 'q9_rating', label: 'Q9: Satisfaction', width: 'w-20' },
    { key: 'q10_rating', label: 'Q10: Recommend', width: 'w-20' },
    { key: 'q11_expectations', label: 'Expectations', width: 'w-32' },
    { key: 'q12_overall_rating', label: 'Overall Rating', width: 'w-32' },
    { key: 'learned_1', label: 'Learning 1', width: 'w-48' },
    { key: 'learned_2', label: 'Learning 2', width: 'w-48' },
    { key: 'learned_3', label: 'Learning 3', width: 'w-48' },
    { key: 'suggestions', label: 'Suggestions', width: 'w-48' },
    { key: 'comments', label: 'Comments', width: 'w-48' },
    { key: 'interested_more', label: 'More Training', width: 'w-32' },
    { key: 'company', label: 'Company', width: 'w-32' },
    { key: 'email', label: 'Email', width: 'w-40' },
    { key: 'phone', label: 'Phone', width: 'w-32' }
  ]

  const visibleColumns = columns.filter(col => !hiddenColumns.has(col.key))

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!upload) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 text-lg">Upload not found</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 text-blue-600 hover:text-blue-700"
        >
          Return to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Instructional Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <FileText className="h-4 w-4 text-blue-600" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-blue-900">📋 Extracted Survey Data</h3>
            <p className="text-sm text-blue-700 mt-1">
              This table shows all survey responses extracted from your PDF. Each row represents one participant's survey response.
              Use the search bar to find specific responses, toggle columns to customize the view, and export to CSV for analysis.
            </p>
            {responses.length > 0 && (
              <p className="text-xs text-blue-600 mt-2">
                💡 <strong>Tip:</strong> Green ratings (4-5) indicate high satisfaction. Click column headers to sort data.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Dashboard</span>
          </button>
          <div className="h-6 w-px bg-gray-300"></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{upload.course_name}</h1>
            <p className="text-gray-600">
              {responses.length} responses • Uploaded {new Date(upload.upload_date).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={exportToCSV}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Responses</p>
              <p className="text-2xl font-bold text-gray-900">{responses.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Star className="h-8 w-8 text-yellow-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Avg Rating (Q1-Q9)</p>
              <p className="text-2xl font-bold text-gray-900">
                {responses.length > 0 ? (
                  responses.reduce((sum, r) => {
                    const ratings = [r.q1_rating, r.q2_rating, r.q3_rating, r.q4_rating, r.q5_rating, r.q6_rating, r.q7_rating, r.q8_rating, r.q9_rating].filter(Boolean) as number[]
                    return sum + (ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0)
                  }, 0) / responses.length
                ).toFixed(1) : 'N/A'}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-center">
            <BarChart3 className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Avg Recommendation</p>
              <p className="text-2xl font-bold text-gray-900">
                {responses.length > 0 ? (
                  responses.filter(r => r.q10_rating !== null).reduce((sum, r) => sum + (r.q10_rating || 0), 0) / 
                  responses.filter(r => r.q10_rating !== null).length
                ).toFixed(1) : 'N/A'}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Date Range</p>
              <p className="text-sm font-bold text-gray-900">
                {responses.length > 0 ? (
                  responses.filter(r => r.response_date).length > 0 ? 
                  `${Math.min(...responses.filter(r => r.response_date).map(r => new Date(r.response_date!).getTime()))} - ${Math.max(...responses.filter(r => r.response_date).map(r => new Date(r.response_date!).getTime()))}`.replace(/\d+/g, (match) => new Date(parseInt(match)).toLocaleDateString()) :
                  'No dates'
                ) : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search responses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="border border-gray-300 rounded px-3 py-2"
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>
            <div className="relative">
              <button
                className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                onClick={() => {
                  const dropdown = document.getElementById('column-dropdown')
                  dropdown?.classList.toggle('hidden')
                }}
              >
                <Eye className="h-4 w-4" />
                <span>Columns</span>
              </button>
              <div id="column-dropdown" className="hidden absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                <div className="p-2">
                  {columns.map(column => (
                    <label key={column.key} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        checked={!hiddenColumns.has(column.key)}
                        onChange={() => toggleColumnVisibility(column.key)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">{column.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {visibleColumns.map(column => (
                  <th
                    key={column.key}
                    className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 ${column.width}`}
                    onClick={() => handleSort(column.key)}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{column.label}</span>
                      {sortColumn === column.key && (
                        <span className="text-blue-600">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedResponses.map((response, index) => (
                <tr key={response.id} className="hover:bg-gray-50">
                  {visibleColumns.map(column => (
                    <td key={column.key} className="px-4 py-3 text-sm text-gray-900">
                      {column.key === 'participant' ? (
                        <span className={response.participant_name ? 'text-gray-900 font-medium' : 'text-gray-500 italic'}>
                          {response.participant_name || `Participant ${(currentPage - 1) * itemsPerPage + index + 1}`}
                        </span>
                      ) : column.key === 'response_date' ? (
                        response.response_date ? new Date(response.response_date).toLocaleDateString() : ''
                      ) : column.key.startsWith('q') && column.key.includes('rating') ? (
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          response[column.key as keyof SurveyResponse] 
                            ? (response[column.key as keyof SurveyResponse] as number >= 4 ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800')
                            : 'bg-gray-100 text-gray-400'
                        }`}>
                          {response[column.key as keyof SurveyResponse] ? 
                            `${response[column.key as keyof SurveyResponse]}${column.key === 'q10_rating' ? '/10' : '/5'}` : 
                            '—'
                          }
                        </span>
                      ) : (
                        <div className={`max-w-xs truncate ${
                          response[column.key as keyof SurveyResponse] 
                            ? 'text-gray-900' 
                            : 'text-gray-400 italic'
                        }`} title={String(response[column.key as keyof SurveyResponse] || '')}>
                          {response[column.key as keyof SurveyResponse] ? 
                            response[column.key as keyof SurveyResponse] : 
                            <span className="text-gray-400">—</span>
                          }
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-700">
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedResponses.length)} of {filteredAndSortedResponses.length} results
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 py-1 text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {responses.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No responses found</p>
          <p className="text-gray-400 text-sm mt-1">Responses will appear here after PDF processing</p>
          <div className="mt-6 text-left max-w-md mx-auto">
            <h4 className="font-medium text-gray-700 mb-2">Debug Info:</h4>
            <p className="text-sm text-gray-600">Upload ID: {uploadId}</p>
            <p className="text-sm text-gray-600">Upload Status: {upload?.processing_status}</p>
            <p className="text-sm text-gray-600">Processed Forms: {upload?.processed_forms || 0}</p>
            <p className="text-sm text-gray-600">Total Forms: {upload?.total_forms || 0}</p>
            {upload?.processing_status === 'completed' && upload?.processed_forms === 0 && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                ⚠️ Processing completed but no forms were extracted. This could indicate:
                <ul className="list-disc list-inside mt-1">
                  <li>PDF contains no survey data</li>
                  <li>OCR couldn't read the text</li>
                  <li>Form detection patterns didn't match</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Debug Section - Only show when there are responses */}
      {responses.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h3 className="font-medium text-gray-700 mb-2">Data Debug Info</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium">Responses with Ratings:</span>
              <span className="ml-2 text-blue-600">
                {responses.filter(r => [r.q1_rating, r.q2_rating, r.q3_rating, r.q4_rating, r.q5_rating, r.q6_rating, r.q7_rating, r.q8_rating, r.q9_rating].some(rating => rating !== null)).length}
              </span>
            </div>
            <div>
              <span className="font-medium">With Names:</span>
              <span className="ml-2 text-green-600">
                {responses.filter(r => r.participant_name && r.participant_name.trim().length > 0).length}
              </span>
            </div>
            <div>
              <span className="font-medium">With Text Responses:</span>
              <span className="ml-2 text-purple-600">
                {responses.filter(r => [r.learned_1, r.learned_2, r.learned_3, r.suggestions, r.comments].some(text => text && text.trim().length > 0)).length}
              </span>
            </div>
            <div>
              <span className="font-medium">With Contact Info:</span>
              <span className="ml-2 text-orange-600">
                {responses.filter(r => [r.company, r.email, r.phone].some(contact => contact && contact.trim().length > 0)).length}
              </span>
            </div>
          </div>
          
          {/* Raw Data Preview */}
          <details className="mt-4">
            <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
              🔍 Show Raw Data (Click to expand)
            </summary>
            <div className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-x-auto">
              <h4 className="font-medium mb-2">First Response Data:</h4>
              <pre className="whitespace-pre-wrap text-gray-800">
                {JSON.stringify(responses[0], null, 2)}
              </pre>
            </div>
          </details>
        </div>
      )}
    </div>
  )
}