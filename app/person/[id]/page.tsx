import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { BackButton } from '@/components/BackButton'
import { getPerson, getPersonCredits, getTitle, getYear } from '@/lib/tmdb'

interface PageProps {
  params: Promise<{ id: string }>
}

const DEPARTMENTS: Record<string, string> = {
  Acting: 'Interprétation',
  Directing: 'Réalisation',
  Writing: 'Scénario',
  Production: 'Production',
  Sound: 'Musique & Son',
  Camera: 'Image',
  Editing: 'Montage',
  Art: 'Direction artistique',
  'Costume & Make-Up': 'Costumes & Maquillage',
  'Visual Effects': 'Effets visuels',
  Crew: 'Équipe technique',
}

function frDate(d: string | null): string | null {
  if (!d) return null
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return d
  }
}

function ageFrom(birthday: string | null, deathday: string | null): number | null {
  if (!birthday) return null
  try {
    const start = new Date(birthday)
    const end = deathday ? new Date(deathday) : new Date()
    let age = end.getFullYear() - start.getFullYear()
    const m = end.getMonth() - start.getMonth()
    if (m < 0 || (m === 0 && end.getDate() < start.getDate())) age--
    return age >= 0 && age < 130 ? age : null
  } catch {
    return null
  }
}

function shortBio(bio: string, max = 680): string {
  const clean = bio.trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const lastDot = cut.lastIndexOf('. ')
  return (lastDot > max * 0.5 ? cut.slice(0, lastDot + 1) : cut.trimEnd()) + ' …'
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const person = await getPerson(Number(id)).catch(() => null)
  if (!person) return {}
  return { title: `${person.name} — ZelianTV`, description: person.biography?.slice(0, 160) }
}

export default async function PersonPage({ params }: PageProps) {
  const { id } = await params
  const personId = Number(id)
  if (!Number.isFinite(personId)) notFound()

  const [person, credits] = await Promise.all([
    getPerson(personId).catch(() => null),
    getPersonCredits(personId).catch(() => []),
  ])

  if (!person) notFound()

  const photo = person.profile_path ? `https://image.tmdb.org/t/p/w342${person.profile_path}` : null
  const age = ageFrom(person.birthday, person.deathday)
  const dept = person.known_for_department ? (DEPARTMENTS[person.known_for_department] ?? person.known_for_department) : null

  const facts: { label: string; value: string }[] = []
  if (dept) facts.push({ label: 'Connu·e pour', value: dept })
  if (person.birthday) {
    facts.push({ label: 'Naissance', value: `${frDate(person.birthday)}${age != null && !person.deathday ? ` · ${age} ans` : ''}` })
  }
  if (person.deathday) facts.push({ label: 'Décès', value: `${frDate(person.deathday)}${age != null ? ` · ${age} ans` : ''}` })
  if (person.place_of_birth) facts.push({ label: 'Lieu', value: person.place_of_birth })

  return (
    <div className="gal-body" style={{ minHeight: '100vh', background: '#0a0a0c', color: '#f3f1ee', position: 'relative' }}>
      {/* halo */}
      <div aria-hidden style={{ position: 'absolute', top: -160, left: '50%', transform: 'translateX(-50%)', width: 1100, height: 440, maxWidth: '100%', background: 'radial-gradient(ellipse at center, var(--accent-glow-md), transparent 65%)', pointerEvents: 'none', animation: 'gal-glow-breathe 9s ease-in-out infinite' }} />

      <div style={{ position: 'relative', maxWidth: 1080, margin: '0 auto', padding: 'clamp(20px, 4vw, 40px) clamp(20px, 4vw, 40px) 70px' }}>
        <BackButton />

        {/* En-tête : photo + identité */}
        <div style={{ display: 'flex', gap: 'clamp(20px, 4vw, 36px)', alignItems: 'flex-start', marginTop: 22, flexWrap: 'wrap' }}>
          <div style={{ width: 'clamp(130px, 24vw, 200px)', flexShrink: 0 }}>
            {photo ? (
              <Image src={photo} alt={person.name} width={200} height={300} sizes="200px" className="object-cover" style={{ width: '100%', height: 'auto', borderRadius: 16, border: '1px solid rgba(255,255,255,.08)', boxShadow: '0 20px 50px rgba(0,0,0,.5)' }} />
            ) : (
              <div style={{ width: '100%', aspectRatio: '2/3', borderRadius: 16, background: 'linear-gradient(150deg,#1a2030,#10131c)', border: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="gal-display" style={{ fontSize: 48, color: 'rgba(255,255,255,.4)' }}>{person.name.split(' ').map(n => n[0]).slice(0, 2).join('')}</span>
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 260 }}>
            <h1 className="gal-display" style={{ fontSize: 'clamp(34px, 5vw, 56px)', lineHeight: .95, letterSpacing: '.02em', margin: 0 }}>{person.name}</h1>

            {facts.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px 32px', marginTop: 18 }}>
                {facts.map(f => (
                  <div key={f.label}>
                    <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(243,241,238,.4)' }}>{f.label}</div>
                    <div style={{ fontSize: 14.5, color: 'rgba(243,241,238,.86)', marginTop: 3 }}>{f.value}</div>
                  </div>
                ))}
              </div>
            )}

            {person.biography?.trim() ? (
              <div style={{ marginTop: 22, maxWidth: 640 }}>
                <div className="gal-display" style={{ fontSize: 20, letterSpacing: '.04em', marginBottom: 10 }}>Biographie</div>
                <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(243,241,238,.78)', whiteSpace: 'pre-line', margin: 0 }}>{shortBio(person.biography)}</p>
              </div>
            ) : (
              <p style={{ marginTop: 22, fontSize: 14, color: 'rgba(243,241,238,.45)' }}>Aucune biographie disponible.</p>
            )}
          </div>
        </div>

        {/* Filmographie */}
        {credits.length > 0 && (
          <div style={{ marginTop: 50 }}>
            <div className="gal-display" style={{ fontSize: 27, letterSpacing: '.05em', marginBottom: 16 }}>Filmographie</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
              {credits.map(m => (
                <Link
                  key={`${m.media_type}-${m.id}`}
                  href={`/media/${m.media_type ?? 'movie'}-${m.id}`}
                  title={getTitle(m)}
                  className="gal-poster"
                  style={{ position: 'relative', display: 'block', aspectRatio: '2/3', borderRadius: 11, overflow: 'hidden', boxShadow: '0 10px 24px rgba(0,0,0,.42)', background: 'linear-gradient(160deg,#10131c,#1a2030)' }}
                >
                  {m.poster_path && (
                    <Image src={`https://image.tmdb.org/t/p/w342${m.poster_path}`} alt={getTitle(m)} fill sizes="(min-width: 640px) 180px, 45vw" className="object-cover" />
                  )}
                  {getYear(m) && (
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '26px 12px 10px', background: 'linear-gradient(0deg,rgba(0,0,0,.85),transparent)', pointerEvents: 'none' }}>
                      <span style={{ fontSize: 11.5, color: 'rgba(243,241,238,.62)', fontWeight: 500 }}>{getYear(m)}</span>
                    </div>
                  )}
                  <div className="gal-ov" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: 14, background: 'linear-gradient(0deg,rgba(8,8,10,.98),rgba(8,8,10,.72))' }}>
                    {m.vote_average ? <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-2)' }}>★ {m.vote_average.toFixed(1)}</div> : null}
                    <div className="gal-display line-clamp-2" style={{ fontSize: 18, lineHeight: 1, marginTop: 6 }}>{getTitle(m)}</div>
                    {m.character && <div style={{ fontSize: 11.5, color: 'rgba(243,241,238,.6)', marginTop: 6, fontStyle: 'italic' }}>{m.character}</div>}
                    <div style={{ flex: 1 }} />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 32, borderRadius: 6, fontSize: 12, fontWeight: 700, background: 'var(--accent)', color: '#0a0a0c', marginTop: 10 }}>
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path d="M5 3.5l8 4.5-8 4.5z" /></svg>
                      Voir la fiche
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
