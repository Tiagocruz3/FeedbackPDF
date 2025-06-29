import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          created_at?: string
          updated_at?: string
        }
      }
      course_uploads: {
        Row: {
          id: string
          course_name: string
          upload_date: string
          file_url: string
          file_name: string
          file_size: number
          processing_status: 'pending' | 'processing' | 'completed' | 'failed'
          total_forms: number
          processed_forms: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          course_name: string
          upload_date?: string
          file_url: string
          file_name: string
          file_size?: number
          processing_status?: 'pending' | 'processing' | 'completed' | 'failed'
          total_forms?: number
          processed_forms?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          course_name?: string
          upload_date?: string
          file_url?: string
          file_name?: string
          file_size?: number
          processing_status?: 'pending' | 'processing' | 'completed' | 'failed'
          total_forms?: number
          processed_forms?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      survey_responses: {
        Row: {
          id: string
          upload_id: string
          course_name: string
          response_date: string | null
          q1_rating: number | null
          q2_rating: number | null
          q3_rating: number | null
          q4_rating: number | null
          q5_rating: number | null
          q6_rating: number | null
          q7_rating: number | null
          q8_rating: number | null
          q9_rating: number | null
          q10_rating: number | null
          q11_expectations: string | null
          q12_overall_rating: string | null
          learned_1: string | null
          learned_2: string | null
          learned_3: string | null
          suggestions: string | null
          comments: string | null
          interested_more: string | null
          participant_name: string | null
          company: string | null
          email: string | null
          phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          upload_id: string
          course_name: string
          response_date?: string | null
          q1_rating?: number | null
          q2_rating?: number | null
          q3_rating?: number | null
          q4_rating?: number | null
          q5_rating?: number | null
          q6_rating?: number | null
          q7_rating?: number | null
          q8_rating?: number | null
          q9_rating?: number | null
          q10_rating?: number | null
          q11_expectations?: string | null
          q12_overall_rating?: string | null
          learned_1?: string | null
          learned_2?: string | null
          learned_3?: string | null
          suggestions?: string | null
          comments?: string | null
          interested_more?: string | null
          participant_name?: string | null
          company?: string | null
          email?: string | null
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          upload_id?: string
          course_name?: string
          response_date?: string | null
          q1_rating?: number | null
          q2_rating?: number | null
          q3_rating?: number | null
          q4_rating?: number | null
          q5_rating?: number | null
          q6_rating?: number | null
          q7_rating?: number | null
          q8_rating?: number | null
          q9_rating?: number | null
          q10_rating?: number | null
          q11_expectations?: string | null
          q12_overall_rating?: string | null
          learned_1?: string | null
          learned_2?: string | null
          learned_3?: string | null
          suggestions?: string | null
          comments?: string | null
          interested_more?: string | null
          participant_name?: string | null
          company?: string | null
          email?: string | null
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}