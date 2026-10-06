import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type PlannerRequest = {
  origin: string
  destination: string
  originIata?: string
  destinationIata?: string
  departureDate: string
  returnDate?: string
  travelers: number
  budget: number
  currency: string
}

type SearchResult = {
  title: string
  url: string
  content: string
}

type FlightOffer = {
  airline: string
  departure: string
  arrival: string
  duration: string
  stops: number
  price: string
  currency: string
}

type AmadeusSegment = {
  carrierCode?: string
  departure?: { at?: string }
  arrival?: { at?: string }
}

type AmadeusFlightOffer = {
  itineraries?: { duration?: string; segments?: AmadeusSegment[] }[]
  price?: { grandTotal?: string; total?: string; currency?: string }
}

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function validateRequest(value: unknown): PlannerRequest | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  if (
    typeof input.origin !== 'string' ||
    input.origin.trim().length < 2 ||
    input.origin.length > 120 ||
    typeof input.destination !== 'string' ||
    input.destination.trim().length < 2 ||
    input.destination.length > 120 ||
    (input.originIata !== undefined &&
      (typeof input.originIata !== 'string' || !/^[A-Za-z]{3}$/.test(input.originIata))) ||
    (input.destinationIata !== undefined &&
      (typeof input.destinationIata !== 'string' || !/^[A-Za-z]{3}$/.test(input.destinationIata))) ||
    typeof input.departureDate !== 'string' ||
    !isDate(input.departureDate) ||
    (input.returnDate !== undefined &&
      (typeof input.returnDate !== 'string' || !isDate(input.returnDate))) ||
    typeof input.travelers !== 'number' ||
    !Number.isInteger(input.travelers) ||
    input.travelers < 1 ||
    input.travelers > 9 ||
    typeof input.budget !== 'number' ||
    !Number.isFinite(input.budget) ||
    input.budget < 0 ||
    input.budget > 100_000_000 ||
    typeof input.currency !== 'string' ||
    !/^[A-Z]{3}$/.test(input.currency)
  ) {
    return null
  }

  if (input.returnDate && input.returnDate < input.departureDate) return null

  return {
    origin: input.origin.trim(),
    destination: input.destination.trim(),
    originIata: typeof input.originIata === 'string' ? input.originIata.toUpperCase() : undefined,
    destinationIata:
      typeof input.destinationIata === 'string' ? input.destinationIata.toUpperCase() : undefined,
    departureDate: input.departureDate,
    returnDate: input.returnDate as string | undefined,
    travelers: input.travelers,
    budget: input.budget,
    currency: input.currency,
  }
}

async function searchWeb(input: PlannerRequest): Promise<SearchResult[]> {
  const apiKey = process.env.TOURFLOW_SEARCH_API_KEY
  if (!apiKey) return []

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query: `Best value travel options from ${input.origin} to ${input.destination} for ${input.departureDate}${input.returnDate ? ` to ${input.returnDate}` : ''}: train and bus operators, route duration, official booking pages, destination transport and current travel advice. Do not report unverified prices.`,
      search_depth: 'basic',
      topic: 'general',
      max_results: 6,
      include_answer: false,
    }),
    signal: AbortSignal.timeout(12_000),
  })

  if (!response.ok) {
    throw new Error(`Web search provider returned HTTP ${response.status}`)
  }
  const data = await response.json()
  return Array.isArray(data.results)
    ? data.results
        .filter(
          (item: unknown): item is SearchResult =>
            Boolean(
              item &&
                typeof item === 'object' &&
                typeof (item as SearchResult).title === 'string' &&
                typeof (item as SearchResult).url === 'string' &&
                typeof (item as SearchResult).content === 'string'
            )
        )
        .slice(0, 6)
        .map((item: SearchResult) => ({
          title: item.title.slice(0, 200),
          url: item.url,
          content: item.content.slice(0, 1200),
        }))
    : []
}

async function searchFlights(input: PlannerRequest): Promise<FlightOffer[]> {
  const clientId = process.env.AMADEUS_CLIENT_ID
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET
  if (!clientId || !clientSecret) return []

  if (!input.originIata || !input.destinationIata) {
    return []
  }

  const baseUrl = (process.env.AMADEUS_BASE_URL || 'https://test.api.amadeus.com').replace(/\/$/, '')
  const tokenResponse = await fetch(`${baseUrl}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
    signal: AbortSignal.timeout(12_000),
  })
  if (!tokenResponse.ok) {
    throw new Error(`Flight provider authentication returned HTTP ${tokenResponse.status}`)
  }
  const tokenData = await tokenResponse.json()

  const params = new URLSearchParams({
    originLocationCode: input.originIata,
    destinationLocationCode: input.destinationIata,
    departureDate: input.departureDate,
    adults: String(input.travelers),
    currencyCode: input.currency,
    max: '5',
  })
  if (input.returnDate) params.set('returnDate', input.returnDate)

  const offersResponse = await fetch(`${baseUrl}/v2/shopping/flight-offers?${params}`, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
    signal: AbortSignal.timeout(15_000),
  })
  if (!offersResponse.ok) {
    throw new Error(`Flight provider returned HTTP ${offersResponse.status}`)
  }
  const data = await offersResponse.json()

  const offers: FlightOffer[] = Array.isArray(data.data)
    ? (data.data as AmadeusFlightOffer[]).map((offer) => {
        const segments = offer.itineraries?.[0]?.segments ?? []
        return {
          airline: String(segments[0]?.carrierCode ?? 'Airline'),
          departure: String(segments[0]?.departure?.at ?? ''),
          arrival: String(segments.at(-1)?.arrival?.at ?? ''),
          duration: String(offer.itineraries?.[0]?.duration ?? ''),
          stops: Math.max(segments.length - 1, 0),
          price: String(offer.price?.grandTotal ?? offer.price?.total ?? ''),
          currency: String(offer.price?.currency ?? input.currency),
        }
      })
    : []
  return offers
    .sort((left, right) => Number(left.price) - Number(right.price))
    .slice(0, 5)
}

function readPlan(content: unknown) {
  if (typeof content !== 'string') {
    throw new Error('AI provider returned an empty trip plan.')
  }
  const parsed: unknown = JSON.parse(content)
  if (
    !parsed ||
    typeof parsed !== 'object'
  ) {
    throw new Error('AI provider returned a trip plan that was not a JSON object.')
  }

  const value = parsed as Record<string, unknown>
  const days = value.days
  const transportSuggestions =
    value.transportSuggestions ?? value.transport_suggestions
  const budgetTips = value.budgetTips ?? value.budget_tips

  if (
    typeof value.overview !== 'string' ||
    !Array.isArray(days) ||
    days.some(
      (day: unknown) =>
        !day ||
        typeof day !== 'object' ||
        typeof (day as { day?: unknown }).day !== 'number' ||
        typeof (day as { title?: unknown }).title !== 'string' ||
        !Array.isArray((day as { activities?: unknown }).activities)
    ) ||
    (Array.isArray(transportSuggestions) && transportSuggestions.some(
      (suggestion: unknown) =>
        !suggestion ||
        typeof suggestion !== 'object' ||
        typeof (suggestion as { mode?: unknown }).mode !== 'string' ||
        typeof (suggestion as { recommendation?: unknown }).recommendation !== 'string' ||
        typeof (suggestion as { valueReason?: unknown }).valueReason !== 'string'
    ))
  ) {
    throw new Error(
      'AI provider response is missing a valid overview or day-by-day itinerary. Try again or check the configured AI model.'
    )
  }

  return {
    overview: value.overview,
    days,
    budgetTips: Array.isArray(budgetTips)
      ? budgetTips.filter((tip): tip is string => typeof tip === 'string')
      : [],
    transportSuggestions: Array.isArray(transportSuggestions)
      ? transportSuggestions
      : [],
  }
}

async function generatePlan(input: PlannerRequest, searchResults: SearchResult[]) {
  const apiKey = process.env.TOURFLOW_AI_API_KEY
  const baseUrl = process.env.TOURFLOW_AI_BASE_URL
  const model = process.env.TOURFLOW_AI_MODEL
  if (!apiKey || !baseUrl || !model) {
    throw new Error(
      'AI planning is not configured. Set TOURFLOW_AI_API_KEY, TOURFLOW_AI_BASE_URL, and TOURFLOW_AI_MODEL in the server .env.local file.'
    )
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a careful travel-planning assistant. Create a practical trip outline and compare value only from the provided trip details and search sources. Never invent live fares, operating schedules, opening hours, availability, or prices. If search evidence is absent, say advice is general and should be verified. Never make up train, bus, taxi, or ride-hailing prices. Return JSON with overview (string), days (array of objects with day (number), title (string), activities (array of strings)), budgetTips (array of strings), and transportSuggestions (array of objects with mode (string), recommendation (string), valueReason (string)). Do not include price quotes.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            trip: input,
            webSearchSources: searchResults,
            constraints: [
              'Keep the suggested day count aligned to the requested date range, at most 14 days.',
              'Balance major sights with meal breaks and realistic travel time.',
              'Prioritize affordable, good-value options within the stated budget.',
              'Do not describe the AI budget advice as a verified total or quote.',
              'Compare flight, train, and bus practicality only where the supplied sources support it.',
            ],
          }),
        },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        'The AI provider rejected TOURFLOW_AI_API_KEY. Add a valid, active key to the root .env.local file, then restart the Next.js dev server.'
      )
    }
    if (response.status === 404) {
      throw new Error(
        `The AI provider could not find model "${model}". Set TOURFLOW_AI_MODEL to a model currently available to your provider account.`
      )
    }
    throw new Error(`AI provider returned HTTP ${response.status}`)
  }

  const data = await response.json()
  return readPlan(data.choices?.[0]?.message?.content)
}

export async function POST(request: Request) {
  let rawInput: unknown
  try {
    rawInput = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
  }

  const input = validateRequest(rawInput)
  if (!input) {
    return NextResponse.json(
      { error: 'Enter valid trip details, dates, traveler count, budget, and 3-letter currency code.' },
      { status: 400 }
    )
  }

  try {
    let searchResults: SearchResult[] = []
    let searchWarning: string | null = null
    if (process.env.TOURFLOW_SEARCH_API_KEY) {
      try {
        searchResults = await searchWeb(input)
        if (!searchResults.length) searchWarning = 'Web search returned no sources for this trip.'
      } catch (error) {
        searchWarning = error instanceof Error ? error.message : 'Web search failed.'
      }
    } else {
      searchWarning = 'Web search is not configured; this itinerary uses AI guidance without live web research.'
    }

    let flightOffers: FlightOffer[] = []
    let flightWarning: string | null = null
    let flightMode: 'live' | 'sandbox' | 'unavailable' = 'unavailable'
    if (!process.env.AMADEUS_CLIENT_ID || !process.env.AMADEUS_CLIENT_SECRET) {
      flightWarning = 'Live flight fares are unavailable until Amadeus API credentials are configured.'
    } else if (!input.originIata || !input.destinationIata) {
      flightWarning = 'Enter 3-letter IATA airport codes (for example, BOM and DEL) to check flight fares.'
    } else {
      try {
        flightOffers = await searchFlights(input)
        flightMode = (process.env.AMADEUS_BASE_URL || 'https://test.api.amadeus.com').includes(
          'test.api.amadeus.com'
        )
          ? 'sandbox'
          : 'live'
        if (!flightOffers.length) flightWarning = 'No flight offers were returned for these trip details.'
      } catch (error) {
        flightWarning = error instanceof Error ? error.message : 'Flight search failed.'
      }
    }

    const plan = await generatePlan(input, searchResults)
    return NextResponse.json({
      plan,
      sources: searchResults.map(({ title, url }) => ({ title, url })),
      searchWarning,
      flightOffers,
      flightWarning,
      flightMode,
      checkedAt: new Date().toISOString(),
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Trip planning could not be completed.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
