import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Configuration, OpenAIApi } from 'https://esm.sh/openai@3.2.1'
import * as pdfjsLib from 'https://esm.sh/pdfjs-dist@3.4.120'

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { fileUrl, courseName, userId, openaiApiKey, model = 'gpt-4-vision-preview' } = await req.json()

    if (!fileUrl || !courseName || !userId || !openaiApiKey) {
      throw new Error('Missing required parameters')
    }

    const fileExtension = fileUrl.split('.').pop()?.toLowerCase()
    const supportedFormats = ['pdf', 'jpg', 'jpeg', 'png', 'tiff', 'bmp']
    
    if (!fileExtension || !supportedFormats.includes(fileExtension)) {
      throw new Error(`Unsupported file format: ${fileExtension}`)
    }

    const configuration = new Configuration({ apiKey: openaiApiKey })
    const openai = new OpenAIApi(configuration)

    let extractedResponses = []

    if (fileExtension === 'pdf') {
      const loadingTask = pdfjsLib.getDocument(fileUrl)
      const pdf = await loadingTask.promise
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum)
        const viewport = page.getViewport({ scale: 2.0 })
        const canvas = new OffscreenCanvas(viewport.width, viewport.height)
        const context = canvas.getContext('2d')
        
        if (!context) continue

        await page.render({ canvasContext: context, viewport }).promise

        const blob = await canvas.convertToBlob({ type: 'image/png' })
        const base64 = await blobToBase64(blob)

        const pageResponses = await extractWithVision(openai, base64, model, pageNum)
        if (pageResponses) extractedResponses.push(...pageResponses)
      }
    } else {
      const response = await fetch(fileUrl)
      const blob = await response.blob()
      const base64 = await blobToBase64(blob)

      const imageResponses = await extractWithVision(openai, base64, model, 1)
      if (imageResponses) extractedResponses = imageResponses
    }

    const savedResponses = []
    for (const response of extractedResponses) {
      const ratingValues = Object.values(response.ratings || {}).filter(r => typeof r === 'number')
      const overallRating = ratingValues.length > 0
        ? ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length
        : null

      const { data, error } = await supabaseClient
        .from('responses')
        .insert({
          course_name: courseName,
          user_id: userId,
          participant_name: response.participantName || null,
          company_name: response.companyName || null,
          email: response.email || null,
          phone: response.phone || null,
          overall_rating: overallRating,
          recommendation_score: response.recommendationScore || null,
          ratings: response.ratings || {},
          text_responses: response.textResponses || {},
          page_number: response.pageNumber,
          extraction_confidence: response.confidence || 0.9,
          processed_at: new Date().toISOString()
        })
        .select()
        .single()

      if (!error) savedResponses.push(data)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${savedResponses.length} responses`,
        responses: savedResponses 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function extractWithVision(openai, base64Image, model, pageNumber) {
  const prompt = `Analyze this survey form and extract ALL responses. For each survey found, extract:
1. Participant info (name, company, email, phone)
2. Rating questions (1-5 scale) with question text and selected rating
3. Recommendation score (0-10)
4. All text responses with their questions

Return as JSON array: [{
  "participantName": "string",
  "companyName": "string", 
  "email": "string",
  "phone": "string",
  "ratings": {"question": rating},
  "textResponses": {"question": "answer"},
  "recommendationScore": number
}]`

  try {
    const response = await openai.createChatCompletion({
      model,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:image/png;base64,${base64Image}` } }
        ]
      }],
      max_tokens: 4096,
      temperature: 0.1
    })

    const content = response.data.choices[0]?.message?.content
    if (!content) return []

    let parsed = JSON.parse(content)
    if (!Array.isArray(parsed)) parsed = [parsed]

    return parsed.map(r => ({
      ...r,
      pageNumber,
      confidence: 0.9
    }))
  } catch (error) {
    console.error('Vision API error:', error)
    return []
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
