'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { getTitle, type Media } from '@/lib/tmdb'
import Image from 'next/image'

interface MediaListItem {
  id: string
  tmdb_id: number
  media_type: string
  list_type: string
  rating: number | null
}

interface Props {
  user: User
  lists: MediaListItem[]
  preferredGenres: number[]
  recommendations: Media[]
}

const FIXED_ORDER = ['watchlist', 'watched']
const FIXED_LABELS: Record<string, string> = {
  watchlist: 'À voir',
  watched: 'Déjà vu',
}

function listLabel(listType: string): string {
  return FIXED_LABELS[listType] ?? listType
}

export function ProfileClient({ user, lists, preferredGenres: _preferredGenres, recommendations }: Props) {
  const router = useRouter()

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.refresh()
  }

  // Grouper par list_type, fixes en premier puis custom
  const grouped = lists.reduce((acc, item) => {
    if (!acc[item.list_type]) acc[item.list_type] = []
    acc[item.list_type].push(item)
    return acc
  }, {} as Record<string, MediaListItem[]>)

  const customKeys = Object.keys(grouped).filter(k => !FIXED_ORDER.includes(k))
  const orderedKeys = [...FIXED_ORDER.filter(k => grouped[k]), ...customKeys]

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header profil */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#1e1e1e]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#f97316]/20 flex items-center justify-center text-[#f97316] font-medium text-sm">
            {user.email?.[0].toUpperCase()}
          </div>
          <div>
            <p className="text-white text-sm font-medium">Mon profil</p>
            <p className="text-[#555] text-xs">{user.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="text-[#555] text-xs border border-[#2a2a2a] px-3 py-1.5 rounded hover:border-[#444] transition-colors"
        >
          Déconnexion
        </button>
      </div>

      {/* Listes dynamiques */}
      {orderedKeys.length === 0 ? (
        <div className="mb-6">
          <p className="text-[#444] text-xs">Aucun média dans vos listes. Utilisez le bouton &quot;+ Ajouter à ma liste&quot; sur les films et séries.</p>
        </div>
      ) : (
        orderedKeys.map(key => (
          <Section key={key} title={`${listLabel(key)} (${grouped[key].length})`}>
            <MediaMiniGrid items={grouped[key]} />
          </Section>
        ))
      )}

      {/* Recommandations */}
      <Section title="Recommandations">
        {recommendations.length === 0 ? (
          <p className="text-[#444] text-xs">Marquez des médias comme &quot;Déjà vu&quot; pour recevoir des recommandations.</p>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {recommendations.map(media => (
              <Link
                key={media.id}
                href={`/media/${media.media_type ?? 'movie'}-${media.id}`}
                className="relative w-14 aspect-[2/3] rounded overflow-hidden bg-[#1c1c1c] border border-[#2a2a2a] hover:border-[#f97316] transition-colors shrink-0"
                title={getTitle(media)}
              >
                {media.poster_path && (
                  <Image
                    src={`https://image.tmdb.org/t/p/w200${media.poster_path}`}
                    alt={getTitle(media)}
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                )}
              </Link>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-gray-200 text-sm font-medium mb-3">{title}</h2>
      {children}
    </div>
  )
}

function MediaMiniGrid({ items }: { items: MediaListItem[] }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {items.map(item => (
        <Link
          key={item.id ?? item.tmdb_id}
          href={`/media/${item.media_type}-${item.tmdb_id}`}
          className="relative w-14 aspect-[2/3] rounded overflow-hidden bg-[#1c1c1c] border border-[#2a2a2a] hover:border-[#f97316] transition-colors"
        >
          <div className="absolute inset-0 flex items-center justify-center text-[#333] text-[9px]">
            {item.tmdb_id}
          </div>
        </Link>
      ))}
    </div>
  )
}
