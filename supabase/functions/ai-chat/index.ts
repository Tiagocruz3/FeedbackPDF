import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

interface ChatRequest {
  message: string
  context?: {
    upload: any
    responses: any[]
  }
  conversationHistory: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  try {
    const { message, context, conversationHistory }: ChatRequest = await req.json()

    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Authorization header required'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get user from JWT token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid authentication token'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get user settings to retrieve OpenAI API key - use maybeSingle() to handle missing records
    const { data: userSettings, error: settingsError } = await supabase
      .from('user_settings')
      .select('openai_api_key, openai_enabled, openai_model')
      .eq('user_id', user.id)
      .maybeSingle()

    if (settingsError) {
      console.error('Error fetching user settings:', settingsError)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Error fetching user settings'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if user settings exist
    if (!userSettings) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No OpenAI settings found for this user. Please configure OpenAI in your settings first.'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if OpenAI is enabled and API key is available
    if (!userSettings.openai_enabled) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'OpenAI integration is not enabled. Please enable it in your settings.'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const openaiApiKey = userSettings.openai_api_key || Deno.env.get('OPENAI_API_KEY')
    
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'OpenAI API key not configured. Please set up your OpenAI API key in the settings.'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Prepare system prompt
    let systemPrompt = `You are an AI assistant specialized in analyzing course evaluation surveys. You help users understand their survey data, identify trends, and provide actionable insights.

Survey Structure:
- Questions 1-10: Rating questions (1-5 scale, where 5 is best)
- Question 11: Expectations (text)
- Question 12: Overall rating (text)
- Learned 1-3: What participants learned (text)
- Suggestions: Improvement suggestions (text)
- Comments: Additional comments (text)
- Interested more: Interest in additional training (text)
- Participant details: Name, company, email, phone

Provide helpful, insightful analysis and answer questions about the survey data clearly and concisely.`

    // Add context if available
    if (context && context.responses) {
      const responses = context.responses
      const upload = context.upload
      
      systemPrompt += `\n\nCurrent Context:
Course: ${upload.course_name}
Total Responses: ${responses.length}

Survey Data Summary:
${JSON.stringify(responses, null, 2)}`
    }

    // Prepare messages for OpenAI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-8), // Include recent conversation history
      { role: 'user', content: message }
    ]

    // Use the model from user settings or default to gpt-4o
    const model = userSettings.openai_model || 'gpt-4o'

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7,
      }),
    })

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text()
      console.error('OpenAI API error:', errorData)
      throw new Error(`OpenAI API error: ${openaiResponse.status}`)
    }

    const openaiData = await openaiResponse.json()
    const aiResponse = openaiData.choices[0]?.message?.content

    if (!aiResponse) {
      throw new Error('No response from OpenAI')
    }

    return new Response(
      JSON.stringify({
        success: true,
        response: aiResponse
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error: any) {
    console.error('Error in ai-chat function:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An unexpected error occurred'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})