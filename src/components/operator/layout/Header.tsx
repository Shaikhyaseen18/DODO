'use client'

import { useRouter } from 'next/navigation'
import { createClient, getSupabaseConfig } from '@/lib/supabase/client'

interface HeaderProps {
  operatorName?: string
}

export default function Header({ operatorName = 'Operator' }: HeaderProps) {
  const router = useRouter()
  const { url, key } = getSupabaseConfig()
  const isDemoMode = !url || !key || url === 'https://your-project.supabase.co'
  const supabase = isDemoMode ? null : createClient()

  async function handleLogout() {
    if (isDemoMode) {
      router.push('/operator/login')
      router.refresh()
      return
    }

    await supabase?.auth.signOut()
    router.push('/operator/login')
    router.refresh()
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      {/* Left — page context placeholder, filled by each page */}
      <div id="header-left" />

      {/* Right — user + logout */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
            {operatorName.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-gray-700">{operatorName}</span>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Log out"
        >
          Logout
        </button>
      </div>
    </header>
  )
}
