/*
  # Test OpenAI Connection Edge Function

  This function tests the OpenAI API connection with the provided API key and model.
  It makes a simple API call to verify the credentials are valid.
*/

import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const { apiKey, model } = await req.json()

    if (!apiKey) {
      throw new Error('API key is required')
    }

    // Test the OpenAI API with a simple request
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: 'Test connection. Please respond with "Connection successful".'
          }
        ],
        max_tokens: 10,
        temperature: 0
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || `API request failed with status ${response.status}`)
    }

    const result = await response.json()
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'OpenAI connection successful',
        model: model || 'gpt-4o',
        response: result.choices[0]?.message?.content || 'Test completed'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('OpenAI test error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Connection test failed',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})