import { redirect } from 'next/navigation'
import { createClient, getSupabaseConfig } from '@/lib/supabase/server'
import Sidebar from '@/components/operator/layout/Sidebar'
import Header from '@/components/operator/layout/Header'

export const metadata = {
  title: 'TourFlow AI — Operator Portal',
  description: 'Manage trips, disruptions, and recovery for your travelers.',
}

// Demo mode: if Supabase env vars are placeholder values, skip auth check.
// Replace with real values in .env.local to enable real authentication.
const { url, key } = getSupabaseConfig()
const DEMO_MODE = !url || !key || url === 'https://your-project.supabase.co'

export default async function OperatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let operatorName = 'Demo Operator'

  if (!DEMO_MODE) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/operator/login')
    }
    operatorName = user.email?.split('@')[0] ?? 'Operator'
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header operatorName={operatorName} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
