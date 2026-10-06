import { createBrowserClient } from '@supabase/ssr'

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return { url, key }
}

export function hasSupabaseConfig() {
  const { url, key } = getSupabaseConfig()
  const placeholderUrl = 'https://your-project.supabase.co'
  const placeholderKey = 'your_supabase_publishable_key'

  return Boolean(
    url &&
      key &&
      url !== placeholderUrl &&
      key !== placeholderKey &&
      !url.includes('your-project')
  )
}

export function createClient() {
  const { url, key } = getSupabaseConfig()

  if (!url || !key) {
    throw new Error(
      'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) to .env.local with your real project values.'
    )
  }

  return createBrowserClient(url, key)
}
