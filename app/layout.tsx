// app/layout.tsx
import type { Metadata } from 'next'
import { Geist, Bebas_Neue, DM_Sans } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/Navbar'
import { ListsProvider } from '@/components/ListsProvider'
import { ThemeProvider } from '@/components/ThemeProvider'
import { createClient } from '@/lib/supabase/server'
import { getActiveProfileId } from '@/lib/profile'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Profile } from '@/app/actions/profiles'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const bebasNeue = Bebas_Neue({
  variable: '--font-bebas',
  subsets: ['latin'],
  weight: '400',
})

const dmSans = DM_Sans({
  variable: '--font-dm',
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
    <html lang="fr" className={`${geistSans.variable} ${bebasNeue.variable} ${dmSans.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* Applique le thème avant le premier rendu pour éviter le flash */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('zelian-theme');if(t&&t!=='orange')document.documentElement.classList.add('theme-'+t)}catch(e){}` }} />
      </head>
      <body className="min-h-full bg-[#141414] text-white">
        <ThemeProvider>
          <Navbar activeProfile={activeProfile} />
          <ListsProvider>
            <main>{children}</main>
          </ListsProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
