// app/layout.tsx
import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/Navbar'
import { ListsProvider } from '@/components/ListsProvider'
import { createClient } from '@/lib/supabase/server'
import { getActiveProfileId } from '@/lib/profile'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Profile } from '@/app/actions/profiles'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'ZelianTV',
  description: 'Découvrez films et séries',
  icons: { icon: '/zelian-tv-logo.png' },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let activeProfile: Profile | null = null

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const profileId = await getActiveProfileId()
      if (profileId) {
        const admin = createAdminClient()
        const { data } = await admin
          .from('profiles')
          .select('*')
          .eq('id', profileId)
          .eq('user_id', user.id)
          .single()
        activeProfile = data as Profile | null
      }
    }
  } catch {
    // Layout ne doit jamais crasher
  }

  return (
    <html lang="fr" className={`${geistSans.variable} h-full`}>
      <body className="min-h-full bg-[#141414] text-white">
        <Navbar activeProfile={activeProfile} />
        <ListsProvider>
          <main>{children}</main>
        </ListsProvider>
      </body>
    </html>
  )
}
