'use client'

import { FormEvent, useState } from 'react'
import PageHeader from '@/components/operator/layout/PageHeader'

type PlanDay = {
  day: number
  title: string
  activities: string[]
}

type PlanResult = {
  plan: {
    overview: string
    days: PlanDay[]
    budgetTips: string[]
    transportSuggestions: {
      mode: string
      recommendation: string
      valueReason: string
    }[]
  }
  sources: { title: string; url: string }[]
  searchWarning: string | null
  flightOffers: {
    airline: string
    departure: string
    arrival: string
    duration: string
    stops: number
    price: string
    currency: string
  }[]
  flightWarning: string | null
  flightMode: 'live' | 'sandbox' | 'unavailable'
  checkedAt: string
}

const today = new Date().toISOString().slice(0, 10)
const fieldClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20'

function makeSearchUrl(base: string, query: string) {
  return `${base}${encodeURIComponent(query)}`
}

export default function TripPlannerPage() {
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [originIata, setOriginIata] = useState('')
  const [destinationIata, setDestinationIata] = useState('')
  const [departureDate, setDepartureDate] = useState(today)
  const [returnDate, setReturnDate] = useState('')
  const [travelers, setTravelers] = useState(1)
  const [budget, setBudget] = useState(50000)
  const [currency, setCurrency] = useState('INR')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<PlanResult | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setResult(null)
    setLoading(true)

    try {
      const response = await fetch('/api/trip-planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin,
          destination,
          originIata: originIata || undefined,
          destinationIata: destinationIata || undefined,
          departureDate,
          returnDate: returnDate || undefined,
          travelers,
          budget,
          currency,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Could not create your trip plan.')
      }
      setResult(data as PlanResult)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create your trip plan.')
    } finally {
      setLoading(false)
    }
  }

  const trainSearch = destination
    ? makeSearchUrl('https://www.google.com/search?q=', `train ${origin} to ${destination} ${departureDate} official booking`)
    : '#'
  const busSearch = destination
    ? makeSearchUrl('https://www.google.com/search?q=', `bus ${origin} to ${destination} ${departureDate} redBus`)
    : '#'

  return (
    <div className="mx-auto max-w-7xl text-slate-900">
      <PageHeader
        title="AI Trip Planner"
        description="Build a practical itinerary, check sourced travel research, and compare verified flight offers when connected."
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Trip details</h2>
          <div>
            <label htmlFor="planner-origin" className="text-sm font-semibold text-slate-800">Starting city</label>
            <input id="planner-origin" required maxLength={120} value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="e.g. Delhi" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="planner-destination" className="text-sm font-semibold text-slate-800">Destination</label>
            <input id="planner-destination" required maxLength={120} value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="e.g. Jaipur" className={fieldClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="planner-origin-iata" className="text-sm font-semibold text-slate-800">From airport code</label>
              <input id="planner-origin-iata" maxLength={3} value={originIata} onChange={(event) => setOriginIata(event.target.value.toUpperCase())} placeholder="DEL" className={fieldClass} />
            </div>
            <div>
              <label htmlFor="planner-destination-iata" className="text-sm font-semibold text-slate-800">To airport code</label>
              <input id="planner-destination-iata" maxLength={3} value={destinationIata} onChange={(event) => setDestinationIata(event.target.value.toUpperCase())} placeholder="JAI" className={fieldClass} />
            </div>
          </div>
          <p className="-mt-2 text-xs leading-5 text-slate-500">Airport codes are only needed for live flight offers.</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="planner-departure" className="text-sm font-semibold text-slate-800">Depart</label>
              <input id="planner-departure" type="date" required min={today} value={departureDate} onChange={(event) => setDepartureDate(event.target.value)} className={fieldClass} />
            </div>
            <div>
              <label htmlFor="planner-return" className="text-sm font-semibold text-slate-800">Return</label>
              <input id="planner-return" type="date" min={departureDate} value={returnDate} onChange={(event) => setReturnDate(event.target.value)} className={fieldClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="planner-travelers" className="text-sm font-semibold text-slate-800">Travelers</label>
              <input id="planner-travelers" type="number" required min={1} max={9} value={travelers} onChange={(event) => setTravelers(Number(event.target.value))} className={fieldClass} />
            </div>
            <div>
              <label htmlFor="planner-currency" className="text-sm font-semibold text-slate-800">Currency</label>
              <select id="planner-currency" value={currency} onChange={(event) => setCurrency(event.target.value)} className={fieldClass}>
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="planner-budget" className="text-sm font-semibold text-slate-800">Total budget ({currency})</label>
            <input id="planner-budget" type="number" required min={0} max={100000000} value={budget} onChange={(event) => setBudget(Number(event.target.value))} className={fieldClass} />
          </div>

          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">{error}</p>}

          <button type="submit" disabled={loading || !origin.trim() || !destination.trim()} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">
            {loading ? 'Researching and planning…' : 'Create my AI trip plan'}
          </button>
          <p className="text-xs leading-5 text-slate-500">
            Live results depend on provider access. The planner will label unavailable fares instead of estimating them.
          </p>
        </form>

        <div className="space-y-5">
          {!result && !loading && (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <h2 className="text-xl font-semibold text-slate-900">Your itinerary will appear here</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
                Enter your cities, dates, and budget. TourFlow will use AI to organize a day-by-day plan and show search sources and flight offers when those providers are configured.
              </p>
            </section>
          )}

          {loading && (
            <section role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <p className="text-lg font-semibold text-slate-900">Planning your trip…</p>
              <p className="mt-2 text-sm text-slate-600">Checking research sources and available transport data.</p>
            </section>
          )}

          {result && (
            <>
              <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700">AI trip outline</p>
                <p className="mt-2 text-base leading-7 text-slate-800">{result.plan.overview}</p>
                {result.searchWarning && (
                  <p className="mt-3 rounded-lg bg-white/80 p-3 text-sm font-medium text-amber-900">{result.searchWarning}</p>
                )}
              </section>

              {result.plan.transportSuggestions.length > 0 && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900">Best-value travel ideas</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    AI recommendations based on the trip details and listed research sources; not live quotes.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {result.plan.transportSuggestions.map((suggestion, index) => (
                      <article key={`${suggestion.mode}-${index}`} className="rounded-xl border border-slate-200 p-4">
                        <h3 className="font-semibold capitalize text-slate-900">{suggestion.mode}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{suggestion.recommendation}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{suggestion.valueReason}</p>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Your itinerary</h2>
                <div className="mt-4 space-y-4">
                  {result.plan.days.map((day) => (
                    <article key={`${day.day}-${day.title}`} className="border-l-2 border-blue-500 pl-4">
                      <h3 className="font-semibold text-slate-900">Day {day.day}: {day.title}</h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
                        {day.activities.map((activity, index) => <li key={`${day.day}-${index}`}>{activity}</li>)}
                      </ul>
                    </article>
                  ))}
                </div>
                {result.plan.budgetTips.length > 0 && (
                  <div className="mt-5 rounded-xl bg-slate-50 p-4">
                    <h3 className="font-semibold text-slate-900">Budget-smart tips</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
                      {result.plan.budgetTips.map((tip, index) => <li key={index}>{tip}</li>)}
                    </ul>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-slate-900">Flight offers</h2>
                  <span className="text-xs text-slate-500">Checked {new Date(result.checkedAt).toLocaleString()}</span>
                </div>
                {result.flightMode === 'sandbox' && (
                  <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-900">
                    Amadeus is using its test environment. These are test offers, not live bookable fares. Set AMADEUS_BASE_URL to the production API after Amadeus enables your production access.
                  </p>
                )}
                {result.flightOffers.length ? (
                  <div className="mt-4 space-y-3">
                    {result.flightOffers.map((offer, index) => (
                      <div key={`${offer.airline}-${offer.departure}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {index === 0 && <span className="mr-2 rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">Lowest fare</span>}
                            {offer.airline} · {offer.stops ? `${offer.stops} stop(s)` : 'Nonstop'}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">{offer.departure} → {offer.arrival} · {offer.duration}</p>
                        </div>
                        <p className="text-lg font-bold text-slate-900">{offer.currency} {Number(offer.price).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-slate-700">{result.flightWarning}</p>
                )}
                <p className="mt-3 text-xs text-slate-500">Provider fares can change; confirm final price, baggage, and rules with the airline before booking.</p>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Train, bus & local rides</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  No live prices are shown here unless an operator provides an approved fare API. These open official/provider search pages; confirm availability and fare there.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <a href={trainSearch} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 p-4 hover:border-blue-400 hover:bg-blue-50">
                    <span className="font-semibold text-slate-900">Find trains</span>
                    <span className="mt-1 block text-sm text-slate-600">Search the web for schedule and booking options</span>
                  </a>
                  <a href={busSearch} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 p-4 hover:border-blue-400 hover:bg-blue-50">
                    <span className="font-semibold text-slate-900">Find buses</span>
                    <span className="mt-1 block text-sm text-slate-600">Search the web for operators and fares</span>
                  </a>
                  {[
                    { name: 'Uber', url: 'https://m.uber.com/' },
                    { name: 'Ola', url: 'https://book.olacabs.com/' },
                    { name: 'Rapido', url: 'https://www.rapido.bike/' },
                  ].map((provider) => (
                    <a key={provider.name} href={provider.url} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 p-4 hover:border-blue-400 hover:bg-blue-50">
                      <span className="font-semibold text-slate-900">Check {provider.name}</span>
                      <span className="mt-1 block text-sm text-slate-600">Open provider to check live local fare</span>
                    </a>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Web research sources</h2>
                {result.sources.length ? (
                  <ul className="mt-3 space-y-2">
                    {result.sources.map((source) => (
                      <li key={source.url}>
                        <a href={source.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900">
                          {source.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">No current web sources were returned for this plan.</p>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
