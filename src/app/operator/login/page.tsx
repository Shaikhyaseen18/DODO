'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, getSupabaseConfig } from '@/lib/supabase/client'

type LoginState = 'idle' | 'loading' | 'error'

// Demo mode when Supabase isn't configured yet
const { url, key } = getSupabaseConfig()
const DEMO_MODE = !url || !key || url === 'https://your-project.supabase.co'

const DEMO_EMAIL = 'demo@tourflow.ai'
const DEMO_PASS = 'demo1234'

export default function OperatorLoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState(DEMO_MODE ? DEMO_EMAIL : '')
  const [password, setPassword] = useState(DEMO_MODE ? DEMO_PASS : '')
  const [state, setState] = useState<LoginState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setState('loading')
    setErrorMsg('')

    // Demo mode: accept any credentials and go straight to dashboard
    if (DEMO_MODE) {
      await new Promise((r) => setTimeout(r, 600))
      router.push('/operator/dashboard')
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setState('error')
      if (error.status === 400) {
        setErrorMsg('Invalid email or password. Please try again.')
      } else {
        setErrorMsg('Something went wrong. Please try again.')
      }
      return
    }

    router.push('/operator/dashboard')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">TourFlow AI</h1>
          <p className="mt-1 text-sm text-gray-500">Operator Portal</p>
        </div>

        {/* Demo mode banner */}
        {DEMO_MODE && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            <span className="font-semibold">Demo Mode</span> — credentials pre-filled. Click Sign in to continue.
          </div>
        )}

        {/* Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold text-gray-800">Sign in to your account</h2>

          {state === 'error' && errorMsg && (
            <div className="mb-4 flex items-start gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-4">
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@tourflow.ai"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                disabled={state === 'loading'}
              />
            </div>

            <div className="mb-6">
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                disabled={state === 'loading'}
              />
            </div>

            <button
              type="submit"
              disabled={state === 'loading' || !email || !password}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state === 'loading' ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          TourFlow AI Operator Portal · Secure Login
        </p>
      </div>
    </div>
  )
}
