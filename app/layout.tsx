import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/Navbar'
import { ListsProvider } from '@/components/ListsProvider'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'ZelianTV',
  description: 'Découvrez films et séries',
  icons: {
    icon: '/zelian-tv-logo.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${geistSans.variable} h-full`}>
      <body className="min-h-full bg-[#141414] text-white">
        <Navbar />
        <ListsProvider>
          <main>{children}</main>
        </ListsProvider>
      </body>
    </html>
  )
}
