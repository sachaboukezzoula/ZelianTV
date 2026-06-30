# Multi-Profils Netflix-like — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un système de profils Netflix-like : un compte (email+mdp) → jusqu'à 5 profils indépendants avec listes, recommandations et préférences de genres séparées.

**Architecture:** Cookie httpOnly `zelian_profile_id` posé à la sélection du profil. Le middleware `proxy.ts` le valide à chaque requête et injecte `x-profile-id` en header. Les Server Components lisent ce header pour scoper leurs requêtes. Les Server Actions lisent le cookie directement via `next/headers`.

**Tech Stack:** Next.js 16.2.9 App Router, TypeScript 5 strict, Supabase (PostgreSQL + RLS), Tailwind CSS v4, `@supabase/ssr` v0.12.

---

## Structure des fichiers

| Fichier | Action | Responsabilité |
|---------|--------|----------------|
| `supabase/migrations/002_add_profiles.sql` | Créer | Table `profiles`, colonnes `profile_id`, migration data, fix contrainte `list_type` |
| `lib/profile.ts` | Créer | Helpers: lire `x-profile-id` (Server Components) et cookie (Server Actions) |
| `app/actions/profiles.ts` | Créer | CRUD profils + setActiveProfile (pose le cookie) |
| `app/actions/avatar.ts` | Modifier | Adapter l'upload d'avatar pour les profils |
| `proxy.ts` | Modifier | Valider cookie profil, injecter header, rediriger si absent |
| `app/profils/page.tsx` | Créer | Server Component — écran "Qui regarde ?" |
| `app/profils/ProfilesClient.tsx` | Créer | Client Component — UI sélection profil (plein écran) |
| `app/profils/nouveau/page.tsx` | Créer | Server Component — page création profil |
| `app/profils/nouveau/ProfileCreateClient.tsx` | Créer | Client Component — formulaire création |
| `app/profils/[id]/modifier/page.tsx` | Créer | Server Component — page édition/suppression |
| `app/profils/[id]/modifier/ProfileEditClient.tsx` | Créer | Client Component — formulaire édition |
| `app/actions/watchlist.ts` | Modifier | Toutes les requêtes filtrent par `profile_id` au lieu de `user_id` |
| `components/Navbar.tsx` | Modifier | Reçoit `activeProfile` en prop, affiche avatar + lien `/profils` |
| `app/layout.tsx` | Modifier | Async, fetch profil actif, passe à Navbar |
| `app/profil/page.tsx` | Modifier | Filtre listes par `profile_id`, ajoute lien gestion profils |
| `__tests__/lib/profile.test.ts` | Créer | Tests unitaires helpers profil |
| `__tests__/actions/profiles.test.ts` | Créer | Tests actions CRUD profils |

---

## Task 1 — Migration SQL

**Fichiers:**
- Créer: `supabase/migrations/002_add_profiles.sql`

- [ ] **Step 1: Créer la migration**

```sql
-- supabase/migrations/002_add_profiles.sql

-- 1. Table profiles
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  avatar_url  TEXT,
  color       TEXT NOT NULL DEFAULT '#f97316',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profiles_user_id ON profiles(user_id);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_owner" ON profiles
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. Ajouter profile_id à user_media_lists (nullable pour la migration)
ALTER TABLE user_media_lists
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- 3. Ajouter profile_id à user_preferences (nullable pour la migration)
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- 4. Créer un profil "Par défaut" pour chaque utilisateur ayant des données
--    et backfiller profile_id
DO $$
DECLARE
  r RECORD;
  new_profile_id UUID;
BEGIN
  FOR r IN
    SELECT DISTINCT u.id as user_id,
           u.raw_user_meta_data->>'display_name' as display_name,
           u.raw_user_meta_data->>'avatar_url' as avatar_url
    FROM auth.users u
    WHERE EXISTS (
      SELECT 1 FROM user_media_lists uml WHERE uml.user_id = u.id
      UNION
      SELECT 1 FROM user_preferences up WHERE up.user_id = u.id
    )
  LOOP
    INSERT INTO profiles (user_id, name, avatar_url, color)
    VALUES (
      r.user_id,
      COALESCE(r.display_name, 'Mon profil'),
      r.avatar_url,
      '#f97316'
    )
    RETURNING id INTO new_profile_id;

    UPDATE user_media_lists
    SET profile_id = new_profile_id
    WHERE user_id = r.user_id AND profile_id IS NULL;

    UPDATE user_preferences
    SET profile_id = new_profile_id
    WHERE user_id = r.user_id AND profile_id IS NULL;
  END LOOP;
END $$;

-- 5. Rendre profile_id NOT NULL après backfill (seulement pour les lignes existantes)
--    Note: nouvelles lignes sans utilisateur existant sont couvertes par le DO block
--    On laisse nullable pour permettre l'insertion initiale via trigger ou app

-- 6. Corriger la contrainte CHECK list_type (bug audit CRITIQUE)
ALTER TABLE user_media_lists
  DROP CONSTRAINT IF EXISTS user_media_lists_list_type_check;

-- 7. Mettre à jour la contrainte UNIQUE pour utiliser profile_id
ALTER TABLE user_media_lists
  DROP CONSTRAINT IF EXISTS user_media_lists_user_id_tmdb_id_media_type_key;

ALTER TABLE user_media_lists
  ADD CONSTRAINT user_media_lists_profile_tmdb_media_unique
  UNIQUE (profile_id, tmdb_id, media_type);

-- 8. Index sur profile_id pour les deux tables
CREATE INDEX IF NOT EXISTS idx_user_media_lists_profile_id ON user_media_lists(profile_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_profile_id ON user_preferences(profile_id);
```

- [ ] **Step 2: Appliquer la migration en dev**

```bash
# Option A — via Supabase CLI
supabase db push

# Option B — coller le SQL dans l'éditeur SQL du dashboard Supabase
# Aller dans Database > SQL Editor, coller et exécuter
```

Résultat attendu: table `profiles` créée, colonnes `profile_id` présentes sur les deux tables, profils créés pour les utilisateurs existants.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/002_add_profiles.sql
git commit -m "feat(profiles): migration SQL table profiles + profile_id sur listes"
```

---

## Task 2 — Helper `lib/profile.ts`

**Fichiers:**
- Créer: `lib/profile.ts`
- Créer: `__tests__/lib/profile.test.ts`

- [ ] **Step 1: Écrire les tests**

```typescript
// __tests__/lib/profile.test.ts
import { getActiveProfileId } from '@/lib/profile'

// Mock next/headers
jest.mock('next/headers', () => ({
  headers: jest.fn(),
  cookies: jest.fn(),
}))

import { headers, cookies } from 'next/headers'

describe('getActiveProfileId', () => {
  it('returns profile id from x-profile-id header', async () => {
    const mockHeaders = { get: jest.fn().mockReturnValue('profile-uuid-123') }
    ;(headers as jest.Mock).mockResolvedValue(mockHeaders)

    const id = await getActiveProfileId()
    expect(id).toBe('profile-uuid-123')
  })

  it('returns null when header is absent', async () => {
    const mockHeaders = { get: jest.fn().mockReturnValue(null) }
    ;(headers as jest.Mock).mockResolvedValue(mockHeaders)

    const id = await getActiveProfileId()
    expect(id).toBeNull()
  })
})

describe('getActiveProfileIdFromCookie', () => {
  it('returns profile id from cookie', async () => {
    const mockCookies = { get: jest.fn().mockReturnValue({ value: 'profile-uuid-456' }) }
    ;(cookies as jest.Mock).mockResolvedValue(mockCookies)

    const { getActiveProfileIdFromCookie } = await import('@/lib/profile')
    const id = await getActiveProfileIdFromCookie()
    expect(id).toBe('profile-uuid-456')
  })

  it('returns null when cookie is absent', async () => {
    const mockCookies = { get: jest.fn().mockReturnValue(undefined) }
    ;(cookies as jest.Mock).mockResolvedValue(mockCookies)

    const { getActiveProfileIdFromCookie } = await import('@/lib/profile')
    const id = await getActiveProfileIdFromCookie()
    expect(id).toBeNull()
  })
})
```

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
npm test -- --testPathPattern="lib/profile" --no-coverage
```

Attendu: FAIL — `Cannot find module '@/lib/profile'`

- [ ] **Step 3: Créer `lib/profile.ts`**

```typescript
// lib/profile.ts
import { headers, cookies } from 'next/headers'

// Pour les Server Components : lit le header injecté par le middleware
export async function getActiveProfileId(): Promise<string | null> {
  const h = await headers()
  return h.get('x-profile-id')
}

// Pour les Server Actions : lit le cookie directement
export async function getActiveProfileIdFromCookie(): Promise<string | null> {
  const c = await cookies()
  return c.get('zelian_profile_id')?.value ?? null
}

export const PROFILE_COOKIE = 'zelian_profile_id'
export const MAX_PROFILES = 5
```

- [ ] **Step 4: Vérifier que les tests passent**

```bash
npm test -- --testPathPattern="lib/profile" --no-coverage
```

Attendu: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/profile.ts __tests__/lib/profile.test.ts
git commit -m "feat(profiles): helper getActiveProfileId pour Server Components et Actions"
```

---

## Task 3 — Server Actions `app/actions/profiles.ts`

**Fichiers:**
- Créer: `app/actions/profiles.ts`
- Créer: `__tests__/actions/profiles.test.ts`

- [ ] **Step 1: Écrire les tests**

```typescript
// __tests__/actions/profiles.test.ts
jest.mock('@/lib/supabase/server')
jest.mock('@/lib/supabase/admin')
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  }),
}))

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const mockUser = { id: 'user-uuid-123' }

describe('getProfiles', () => {
  it('returns profiles for current user', async () => {
    const mockSupabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: mockUser } }) },
    }
    const mockAdmin = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [{ id: 'p1', name: 'Lin', color: '#f97316', avatar_url: null }],
              error: null,
            }),
          }),
        }),
      }),
    }
    ;(createClient as jest.Mock).mockResolvedValue(mockSupabase)
    ;(createAdminClient as jest.Mock).mockReturnValue(mockAdmin)

    const { getProfiles } = await import('@/app/actions/profiles')
    const result = await getProfiles()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Lin')
  })

  it('returns empty array when not logged in', async () => {
    const mockSupabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    }
    ;(createClient as jest.Mock).mockResolvedValue(mockSupabase)

    const { getProfiles } = await import('@/app/actions/profiles')
    const result = await getProfiles()
    expect(result).toEqual([])
  })
})

describe('createProfile', () => {
  it('returns error when max profiles reached', async () => {
    const mockSupabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: mockUser } }) },
    }
    const mockAdmin = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ count: 5, error: null }),
        }),
      }),
    }
    ;(createClient as jest.Mock).mockResolvedValue(mockSupabase)
    ;(createAdminClient as jest.Mock).mockReturnValue(mockAdmin)

    const { createProfile } = await import('@/app/actions/profiles')
    const result = await createProfile('Nouveau', null, '#f97316')
    expect(result).toEqual({ error: 'Maximum 5 profils par compte.' })
  })
})
```

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
npm test -- --testPathPattern="actions/profiles" --no-coverage
```

Attendu: FAIL — module not found

- [ ] **Step 3: Créer `app/actions/profiles.ts`**

```typescript
// app/actions/profiles.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { MAX_PROFILES, PROFILE_COOKIE } from '@/lib/profile'

export interface Profile {
  id: string
  user_id: string
  name: string
  avatar_url: string | null
  color: string
  created_at: string
}

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getProfiles(): Promise<Profile[]> {
  const user = await getAuthUser()
  if (!user) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  return (data ?? []) as Profile[]
}

export async function createProfile(
  name: string,
  avatarUrl: string | null,
  color: string,
): Promise<{ error: string } | { profile: Profile }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Non connecté' }

  const trimmed = name.trim()
  if (!trimmed) return { error: 'Le nom est requis.' }

  const admin = createAdminClient()

  const { count } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if ((count ?? 0) >= MAX_PROFILES) {
    return { error: `Maximum ${MAX_PROFILES} profils par compte.` }
  }

  const { data, error } = await admin
    .from('profiles')
    .insert({ user_id: user.id, name: trimmed, avatar_url: avatarUrl, color })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/profils')
  return { profile: data as Profile }
}

export async function updateProfile(
  id: string,
  name: string,
  avatarUrl: string | null,
  color: string,
): Promise<{ error: string } | {}> {
  const user = await getAuthUser()
  if (!user) return { error: 'Non connecté' }

  const trimmed = name.trim()
  if (!trimmed) return { error: 'Le nom est requis.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ name: trimmed, avatar_url: avatarUrl, color })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/profils')
  revalidatePath('/profil')
  return {}
}

export async function deleteProfile(id: string): Promise<{ error: string } | {}> {
  const user = await getAuthUser()
  if (!user) return { error: 'Non connecté' }

  const admin = createAdminClient()

  const { count } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if ((count ?? 0) <= 1) {
    return { error: 'Impossible de supprimer le dernier profil.' }
  }

  const { error } = await admin
    .from('profiles')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  const c = await cookies()
  if (c.get(PROFILE_COOKIE)?.value === id) {
    c.delete(PROFILE_COOKIE)
  }

  revalidatePath('/profils')
  return {}
}

export async function setActiveProfile(profileId: string): Promise<{ error: string } | {}> {
  const user = await getAuthUser()
  if (!user) return { error: 'Non connecté' }

  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .eq('user_id', user.id)
    .single()

  if (!data) return { error: 'Profil introuvable.' }

  const c = await cookies()
  c.set(PROFILE_COOKIE, profileId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })

  return {}
}
```

- [ ] **Step 4: Vérifier que les tests passent**

```bash
npm test -- --testPathPattern="actions/profiles" --no-coverage
```

Attendu: PASS

- [ ] **Step 5: Commit**

```bash
git add app/actions/profiles.ts __tests__/actions/profiles.test.ts lib/profile.ts
git commit -m "feat(profiles): Server Actions CRUD profils + setActiveProfile"
```

---

## Task 4 — Middleware `proxy.ts`

**Fichiers:**
- Modifier: `proxy.ts`

- [ ] **Step 1: Lire le fichier actuel**

```
proxy.ts — fonctions: proxy(), config (matcher)
```

- [ ] **Step 2: Mettre à jour `proxy.ts`**

Remplacer le contenu entier par :

```typescript
// proxy.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const PROFILE_COOKIE = 'zelian_profile_id'

// Routes qui ne nécessitent pas de profil actif
const PUBLIC_PATHS = ['/profils', '/connexion', '/api/', '/_next', '/favicon']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p))
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Utilisateur non connecté : laisser passer (auth gérée par les pages)
  if (!user) return supabaseResponse

  // Routes publiques (profils, auth, api) : pas de vérification profil
  if (isPublicPath(request.nextUrl.pathname)) return supabaseResponse

  const profileId = request.cookies.get(PROFILE_COOKIE)?.value

  // Pas de cookie profil → rediriger vers l'écran de sélection
  if (!profileId) {
    return NextResponse.redirect(new URL('/profils', request.url))
  }

  // Valider que le profil appartient à l'utilisateur
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    // Cookie invalide → supprimer et rediriger
    const response = NextResponse.redirect(new URL('/profils', request.url))
    response.cookies.delete(PROFILE_COOKIE)
    return response
  }

  // Injecter le profile_id en header pour les Server Components
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-profile-id', profileId)

  supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })

  // Re-propager les cookies Supabase sur la nouvelle response
  request.cookies.getAll().forEach(({ name, value }) => {
    supabaseResponse.cookies.set(name, value)
  })

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 3: Vérifier le build TypeScript**

```bash
npx tsc --noEmit
```

Attendu: 0 erreurs

- [ ] **Step 4: Commit**

```bash
git add proxy.ts
git commit -m "feat(profiles): middleware valide cookie profil et injecte x-profile-id"
```

---

## Task 5 — Page `/profils` — Écran de sélection

**Fichiers:**
- Créer: `app/profils/page.tsx`
- Créer: `app/profils/ProfilesClient.tsx`

- [ ] **Step 1: Créer le Server Component `app/profils/page.tsx`**

```typescript
// app/profils/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfiles } from '@/app/actions/profiles'
import { ProfilesClient } from './ProfilesClient'

export default async function ProfilsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/connexion')

  const profiles = await getProfiles()

  // Nouveau user sans profil → forcer la création
  if (profiles.length === 0) redirect('/profils/nouveau')

  return <ProfilesClient profiles={profiles} />
}
```

- [ ] **Step 2: Créer le Client Component `app/profils/ProfilesClient.tsx`**

```typescript
// app/profils/ProfilesClient.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { setActiveProfile } from '@/app/actions/profiles'
import type { Profile } from '@/app/actions/profiles'

interface Props {
  profiles: Profile[]
}

export function ProfilesClient({ profiles }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSelect(profileId: string) {
    setLoading(profileId)
    setError(null)
    const result = await setActiveProfile(profileId)
    if ('error' in result) {
      setError(result.error)
      setLoading(null)
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#141414',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      <h1 style={{ color: '#fff', fontSize: '2rem', fontWeight: 700, marginBottom: '2.5rem', textAlign: 'center' }}>
        Qui regarde ?
      </h1>

      {error && (
        <p style={{ color: '#f87171', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '2.5rem' }}>
        {profiles.map(profile => (
          <button
            key={profile.id}
            onClick={() => handleSelect(profile.id)}
            disabled={loading === profile.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
              background: 'transparent',
              border: 'none',
              cursor: loading ? 'default' : 'pointer',
              opacity: loading && loading !== profile.id ? 0.5 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 96,
              height: 96,
              borderRadius: 8,
              background: profile.color,
              position: 'relative',
              overflow: 'hidden',
              border: loading === profile.id ? '3px solid #fff' : '3px solid transparent',
              transition: 'border-color 0.15s',
            }}>
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.name}
                  fill
                  sizes="96px"
                  style={{ objectFit: 'cover' }}
                />
              ) : (
                <div style={{
                  width: '100%', height: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2.5rem', fontWeight: 700, color: '#fff',
                }}>
                  {profile.name[0].toUpperCase()}
                </div>
              )}
            </div>
            <span style={{ color: '#aaa', fontSize: '0.875rem', fontWeight: 500 }}>
              {profile.name}
            </span>
          </button>
        ))}

        {/* Bouton Ajouter (affiché si < 5 profils) */}
        {profiles.length < 5 && (
          <Link
            href="/profils/nouveau"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
              textDecoration: 'none',
            }}
          >
            <div style={{
              width: 96, height: 96, borderRadius: 8,
              background: 'transparent', border: '2px dashed #555',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2.5rem', color: '#555',
            }}>
              +
            </div>
            <span style={{ color: '#555', fontSize: '0.875rem' }}>Ajouter</span>
          </Link>
        )}
      </div>

      {/* Gérer les profils */}
      <Link
        href="/profil"
        style={{ color: '#aaa', fontSize: '0.875rem', textDecoration: 'none', borderBottom: '1px solid #555' }}
      >
        Gérer les profils
      </Link>
    </div>
  )
}
```

- [ ] **Step 3: Vérifier le build**

```bash
npx tsc --noEmit
```

Attendu: 0 erreurs

- [ ] **Step 4: Tester manuellement**

Démarrer le dev server (`npm run dev`), se connecter et naviguer vers `/profils`. L'écran "Qui regarde ?" doit s'afficher avec les profils existants.

- [ ] **Step 5: Commit**

```bash
git add app/profils/page.tsx app/profils/ProfilesClient.tsx
git commit -m "feat(profiles): page /profils écran de sélection style Netflix"
```

---

## Task 6 — Page `/profils/nouveau` — Création de profil

**Fichiers:**
- Créer: `app/profils/nouveau/page.tsx`
- Créer: `app/profils/nouveau/ProfileCreateClient.tsx`
- Modifier: `app/actions/avatar.ts`

- [ ] **Step 1: Adapter `app/actions/avatar.ts` pour les profils**

Ajouter une fonction `uploadProfileAvatarAction` qui stocke l'avatar avec le `profile_id` comme nom de fichier :

```typescript
// Ajouter à la fin de app/actions/avatar.ts

export async function uploadProfileAvatarAction(formData: FormData, profileId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Fichier manquant' }

  // Vérifier que le profil appartient à l'utilisateur
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .eq('user_id', user.id)
    .single()

  if (!profile) return { error: 'Profil introuvable.' }

  await admin.storage.createBucket('profile-avatars', { public: true }).catch(() => {})

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const fileName = `${profileId}.jpg`

  const { error: uploadError } = await admin.storage
    .from('profile-avatars')
    .upload(fileName, buffer, { upsert: true, contentType: 'image/jpeg' })

  if (uploadError) return { error: `Upload échoué : ${uploadError.message}` }

  const { data: { publicUrl } } = admin.storage.from('profile-avatars').getPublicUrl(fileName)
  const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`

  revalidatePath('/profils')
  return { url: cacheBustedUrl }
}
```

- [ ] **Step 2: Créer `app/profils/nouveau/page.tsx`**

```typescript
// app/profils/nouveau/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileCreateClient } from './ProfileCreateClient'

export default async function NouveauProfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  return <ProfileCreateClient />
}
```

- [ ] **Step 3: Créer `app/profils/nouveau/ProfileCreateClient.tsx`**

```typescript
// app/profils/nouveau/ProfileCreateClient.tsx
'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createProfile } from '@/app/actions/profiles'
import { uploadProfileAvatarAction } from '@/app/actions/avatar'

function compressImage(file: File, maxDim: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim }
        else { width = Math.round((width * maxDim) / height); height = maxDim }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas non supporté')); return }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Compression échouée')); return }
        resolve(blob)
      }, 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Impossible de lire l\'image')) }
    img.src = url
  })
}

const COLORS = ['#f97316', '#2563eb', '#16a34a', '#7c3aed', '#ca8a04', '#0891b2', '#dc2626', '#db2777']

export function ProfileCreateClient() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const compressed = await compressImage(file, 400, 0.85)
      const compressedFile = new File([compressed], 'avatar.jpg', { type: 'image/jpeg' })
      setAvatarFile(compressedFile)
      setAvatarPreview(URL.createObjectURL(compressed))
    } catch {
      setError('Impossible de traiter l\'image.')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Le nom est requis.'); return }
    setLoading(true)
    setError(null)

    // 1. Créer le profil sans avatar
    const result = await createProfile(name.trim(), null, color)
    if ('error' in result) { setError(result.error); setLoading(false); return }

    const profileId = result.profile.id

    // 2. Upload avatar si présent
    let avatarUrl: string | null = null
    if (avatarFile) {
      const formData = new FormData()
      formData.append('file', avatarFile)
      const uploadResult = await uploadProfileAvatarAction(formData, profileId)
      if ('error' in uploadResult) {
        setError(uploadResult.error)
        setLoading(false)
        return
      }
      avatarUrl = uploadResult.url

      // 3. Mettre à jour le profil avec l'avatar
      const { updateProfile } = await import('@/app/actions/profiles')
      await updateProfile(profileId, name.trim(), avatarUrl, color)
    }

    router.push('/profils')
    router.refresh()
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#141414',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '2rem',
    }}>
      <h1 style={{ color: '#fff', fontSize: '1.75rem', fontWeight: 700, marginBottom: '2rem' }}>
        Créer un profil
      </h1>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Avatar */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{
              width: 96, height: 96, borderRadius: 8, background: color,
              border: 'none', cursor: 'pointer', position: 'relative', overflow: 'hidden',
            }}
          >
            {avatarPreview ? (
              <Image src={avatarPreview} alt="Avatar" fill style={{ objectFit: 'cover' }} />
            ) : (
              <span style={{ color: '#fff', fontSize: '2rem', fontWeight: 700 }}>
                {name ? name[0].toUpperCase() : '?'}
              </span>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>

        {/* Couleur */}
        <div>
          <p style={{ color: '#aaa', fontSize: '0.75rem', marginBottom: '0.5rem' }}>Couleur</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{
                  width: 28, height: 28, borderRadius: 4, background: c, border: 'none',
                  cursor: 'pointer',
                  outline: color === c ? '2px solid #fff' : '2px solid transparent',
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>
        </div>

        {/* Nom */}
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nom du profil"
          maxLength={30}
          style={{
            background: '#222', border: '1px solid #333', borderRadius: 6,
            padding: '10px 14px', color: '#fff', fontSize: '0.9rem', outline: 'none',
          }}
          autoFocus
        />

        {error && <p style={{ color: '#f87171', fontSize: '0.8rem' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            style={{
              flex: 1, background: '#f97316', color: '#fff', border: 'none',
              borderRadius: 6, padding: '10px', fontWeight: 600, cursor: loading ? 'default' : 'pointer',
              opacity: loading || !name.trim() ? 0.6 : 1,
            }}
          >
            {loading ? '...' : 'Créer'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              flex: 1, background: 'transparent', color: '#aaa',
              border: '1px solid #333', borderRadius: 6, padding: '10px', cursor: 'pointer',
            }}
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Vérifier le build**

```bash
npx tsc --noEmit
```

Attendu: 0 erreurs

- [ ] **Step 5: Tester manuellement**

Naviguer vers `/profils/nouveau`. Créer un profil avec nom + couleur + optionnellement une photo. Vérifier la redirection vers `/profils` et l'apparition du profil.

- [ ] **Step 6: Commit**

```bash
git add app/profils/nouveau/page.tsx app/profils/nouveau/ProfileCreateClient.tsx app/actions/avatar.ts
git commit -m "feat(profiles): page création de profil + upload avatar profil"
```

---

## Task 7 — Page `/profils/[id]/modifier` — Édition et suppression

**Fichiers:**
- Créer: `app/profils/[id]/modifier/page.tsx`
- Créer: `app/profils/[id]/modifier/ProfileEditClient.tsx`

- [ ] **Step 1: Créer `app/profils/[id]/modifier/page.tsx`**

```typescript
// app/profils/[id]/modifier/page.tsx
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfiles } from '@/app/actions/profiles'
import { ProfileEditClient } from './ProfileEditClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ModifierProfilPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const profiles = await getProfiles()
  const profile = profiles.find(p => p.id === id)
  if (!profile) notFound()

  const canDelete = profiles.length > 1

  return <ProfileEditClient profile={profile} canDelete={canDelete} />
}
```

- [ ] **Step 2: Créer `app/profils/[id]/modifier/ProfileEditClient.tsx`**

```typescript
// app/profils/[id]/modifier/ProfileEditClient.tsx
'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { updateProfile, deleteProfile } from '@/app/actions/profiles'
import { uploadProfileAvatarAction } from '@/app/actions/avatar'
import type { Profile } from '@/app/actions/profiles'

function compressImage(file: File, maxDim: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim }
        else { width = Math.round((width * maxDim) / height); height = maxDim }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas non supporté')); return }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Compression échouée')); return }
        resolve(blob)
      }, 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Impossible de lire l\'image')) }
    img.src = url
  })
}

const COLORS = ['#f97316', '#2563eb', '#16a34a', '#7c3aed', '#ca8a04', '#0891b2', '#dc2626', '#db2777']

interface Props {
  profile: Profile
  canDelete: boolean
}

export function ProfileEditClient({ profile, canDelete }: Props) {
  const router = useRouter()
  const [name, setName] = useState(profile.name)
  const [color, setColor] = useState(profile.color)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const compressed = await compressImage(file, 400, 0.85)
      setAvatarFile(new File([compressed], 'avatar.jpg', { type: 'image/jpeg' }))
      setAvatarPreview(URL.createObjectURL(compressed))
    } catch { setError('Impossible de traiter l\'image.') }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Le nom est requis.'); return }
    setLoading(true)
    setError(null)

    let finalAvatarUrl = avatarPreview

    if (avatarFile) {
      const formData = new FormData()
      formData.append('file', avatarFile)
      const uploadResult = await uploadProfileAvatarAction(formData, profile.id)
      if ('error' in uploadResult) { setError(uploadResult.error); setLoading(false); return }
      finalAvatarUrl = uploadResult.url
    }

    const result = await updateProfile(profile.id, name.trim(), finalAvatarUrl, color)
    if ('error' in result) { setError(result.error); setLoading(false); return }

    router.push('/profils')
    router.refresh()
  }

  async function handleDelete() {
    setLoading(true)
    const result = await deleteProfile(profile.id)
    if ('error' in result) { setError(result.error); setLoading(false); return }
    router.push('/profils')
    router.refresh()
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#141414',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '2rem',
    }}>
      <h1 style={{ color: '#fff', fontSize: '1.75rem', fontWeight: 700, marginBottom: '2rem' }}>
        Modifier le profil
      </h1>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button type="button" onClick={() => fileRef.current?.click()}
            style={{ width: 96, height: 96, borderRadius: 8, background: color, border: 'none', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
            {avatarPreview
              ? <Image src={avatarPreview} alt="Avatar" fill style={{ objectFit: 'cover' }} />
              : <span style={{ color: '#fff', fontSize: '2rem', fontWeight: 700 }}>{name ? name[0].toUpperCase() : '?'}</span>
            }
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>

        <div>
          <p style={{ color: '#aaa', fontSize: '0.75rem', marginBottom: '0.5rem' }}>Couleur</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <button key={c} type="button" onClick={() => setColor(c)}
                style={{ width: 28, height: 28, borderRadius: 4, background: c, border: 'none', cursor: 'pointer',
                  outline: color === c ? '2px solid #fff' : '2px solid transparent', outlineOffset: 2 }} />
            ))}
          </div>
        </div>

        <input type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Nom du profil" maxLength={30}
          style={{ background: '#222', border: '1px solid #333', borderRadius: 6, padding: '10px 14px', color: '#fff', fontSize: '0.9rem', outline: 'none' }} />

        {error && <p style={{ color: '#f87171', fontSize: '0.8rem' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button type="submit" disabled={loading || !name.trim()}
            style={{ flex: 1, background: '#f97316', color: '#fff', border: 'none', borderRadius: 6, padding: '10px', fontWeight: 600, cursor: 'pointer', opacity: loading || !name.trim() ? 0.6 : 1 }}>
            {loading ? '...' : 'Enregistrer'}
          </button>
          <button type="button" onClick={() => router.back()}
            style={{ flex: 1, background: 'transparent', color: '#aaa', border: '1px solid #333', borderRadius: 6, padding: '10px', cursor: 'pointer' }}>
            Annuler
          </button>
        </div>

        {canDelete && !confirmDelete && (
          <button type="button" onClick={() => setConfirmDelete(true)}
            style={{ background: 'transparent', color: '#f87171', border: '1px solid #f87171', borderRadius: 6, padding: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
            Supprimer ce profil
          </button>
        )}

        {confirmDelete && (
          <div style={{ background: '#1c1c1c', border: '1px solid #f87171', borderRadius: 8, padding: '1rem' }}>
            <p style={{ color: '#fff', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
              Supprimer ce profil et toutes ses listes ?
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={handleDelete} disabled={loading}
                style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: '0.8rem', cursor: 'pointer' }}>
                Confirmer
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)}
                style={{ background: 'transparent', color: '#888', border: '1px solid #333', borderRadius: 6, padding: '7px 14px', fontSize: '0.8rem', cursor: 'pointer' }}>
                Annuler
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Vérifier le build**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/profils/[id]/modifier/page.tsx app/profils/[id]/modifier/ProfileEditClient.tsx
git commit -m "feat(profiles): page édition et suppression de profil"
```

---

## Task 8 — Mise à jour `app/actions/watchlist.ts`

**Fichiers:**
- Modifier: `app/actions/watchlist.ts`

Toutes les requêtes doivent filtrer par `profile_id` au lieu de `user_id`.

- [ ] **Step 1: Réécrire `app/actions/watchlist.ts`**

```typescript
// app/actions/watchlist.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveProfileIdFromCookie } from '@/lib/profile'
import type { MediaType } from '@/lib/tmdb'

async function getAuthContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileId = await getActiveProfileIdFromCookie()
  if (!profileId) return null

  return { userId: user.id, profileId }
}

export async function getWatchlistData(tmdbId: number, mediaType: MediaType) {
  const ctx = await getAuthContext()
  if (!ctx) return { user: null, listType: null, allLists: [] as string[] }

  const admin = createAdminClient()

  const [itemResult, listsResult] = await Promise.all([
    admin
      .from('user_media_lists')
      .select('list_type')
      .eq('profile_id', ctx.profileId)
      .eq('tmdb_id', tmdbId)
      .eq('media_type', mediaType)
      .maybeSingle(),
    admin
      .from('user_media_lists')
      .select('list_type')
      .eq('profile_id', ctx.profileId),
  ])

  const allLists = [...new Set((listsResult.data ?? []).map((d: { list_type: string }) => d.list_type))]

  return {
    user: ctx.userId,
    listType: (itemResult.data?.list_type ?? null) as string | null,
    allLists,
  }
}

export async function toggleWatchlist(
  tmdbId: number,
  mediaType: MediaType,
  target: string,
  currentListType: string | null,
  posterPath?: string | null,
  title?: string | null,
) {
  const ctx = await getAuthContext()
  if (!ctx) return { error: 'Non connecté' }

  const admin = createAdminClient()

  if (currentListType === target) {
    const { error } = await admin
      .from('user_media_lists')
      .delete()
      .eq('profile_id', ctx.profileId)
      .eq('tmdb_id', tmdbId)
      .eq('media_type', mediaType)
    if (error) return { error: error.message }
    revalidatePath('/profil')
    return { listType: null as string | null }
  } else {
    const { error } = await admin
      .from('user_media_lists')
      .upsert(
        {
          user_id: ctx.userId,
          profile_id: ctx.profileId,
          tmdb_id: tmdbId,
          media_type: mediaType,
          list_type: target,
        },
        { onConflict: 'profile_id,tmdb_id,media_type' }
      )
      .select()
    if (error) return { error: error.message }
    revalidatePath('/profil')
    return { listType: target as string | null }
  }
}

export async function getUserLists(): Promise<string[]> {
  const ctx = await getAuthContext()
  if (!ctx) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('user_media_lists')
    .select('list_type')
    .eq('profile_id', ctx.profileId)

  return [...new Set((data ?? []).map((d: { list_type: string }) => d.list_type))]
}

export async function getWatchlistStatus(tmdbId: number, mediaType: MediaType) {
  const data = await getWatchlistData(tmdbId, mediaType)
  return { user: data.user, listType: data.listType }
}

export async function removeFromList(id: string) {
  const ctx = await getAuthContext()
  if (!ctx) return { error: 'Non connecté' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('user_media_lists')
    .delete()
    .eq('id', id)
    .eq('profile_id', ctx.profileId)

  if (error) return { error: error.message }
  revalidatePath('/profil')
  return {}
}

export async function deleteList(listType: string) {
  const ctx = await getAuthContext()
  if (!ctx) return { error: 'Non connecté' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('user_media_lists')
    .delete()
    .eq('profile_id', ctx.profileId)
    .eq('list_type', listType)

  if (error) return { error: error.message }
  revalidatePath('/profil')
  return {}
}
```

- [ ] **Step 2: Vérifier le build TypeScript**

```bash
npx tsc --noEmit
```

Attendu: 0 erreurs

- [ ] **Step 3: Commit**

```bash
git add app/actions/watchlist.ts
git commit -m "feat(profiles): watchlist actions filtrent par profile_id"
```

---

## Task 9 — Navbar — Afficher le profil actif

**Fichiers:**
- Modifier: `components/Navbar.tsx`
- Modifier: `app/layout.tsx`

- [ ] **Step 1: Modifier `app/layout.tsx` pour fetcher le profil actif**

```typescript
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
```

- [ ] **Step 2: Modifier `components/Navbar.tsx`**

```typescript
// components/Navbar.tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { SearchBar } from '@/components/SearchBar'
import type { Profile } from '@/app/actions/profiles'

interface NavbarProps {
  activeProfile: Profile | null
}

export function Navbar({ activeProfile }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const profileAvatar = activeProfile ? (
    <div style={{
      width: 32, height: 32, borderRadius: 6,
      background: activeProfile.color, overflow: 'hidden',
      position: 'relative', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {activeProfile.avatar_url ? (
        <Image src={activeProfile.avatar_url} alt={activeProfile.name} fill sizes="32px" style={{ objectFit: 'cover' }} />
      ) : (
        <span style={{ color: '#fff', fontSize: '0.875rem', fontWeight: 700 }}>
          {activeProfile.name[0].toUpperCase()}
        </span>
      )}
    </div>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  )

  return (
    <header className="sticky top-0 z-50 bg-[#0d0d0d] border-b border-[#1a1a1a]">
      <div className="flex items-center justify-between px-6 h-14 w-full">
        <Link href="/" className="shrink-0">
          <Image src="/zelian-tv-logo.png" alt="ZelianTV" width={120} height={32}
            className="h-8 w-auto" style={{ filter: 'invert(1) hue-rotate(180deg)' }} priority />
        </Link>

        <div className="hidden md:flex flex-1 max-w-xs mx-6">
          <SearchBar />
        </div>

        <div className="flex items-center gap-3">
          {/* Changer de profil → /profils */}
          <Link href="/profils" className="hidden md:flex items-center gap-2 text-gray-400 hover:text-white transition-colors" aria-label="Changer de profil">
            {profileAvatar}
          </Link>
          {/* Paramètres compte → /profil */}
          <Link href="/profil" className="hidden md:block text-gray-400 hover:text-white transition-colors" aria-label="Mon compte">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          </Link>

          <button className="md:hidden text-gray-400 hover:text-white focus:outline-none"
            onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {menuOpen
                ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                : <><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></>
              }
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden px-4 pb-3 border-t border-[#1a1a1a]">
          <div className="pt-3 flex flex-col gap-3">
            <SearchBar />
            <Link href="/" onClick={() => setMenuOpen(false)} className="text-sm text-[#aaa] hover:text-white transition-colors">Accueil</Link>
            <Link href="/profils" onClick={() => setMenuOpen(false)} className="text-sm text-[#aaa] hover:text-white transition-colors flex items-center gap-2">
              {activeProfile && (
                <div style={{ width: 20, height: 20, borderRadius: 4, background: activeProfile.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: '#fff', fontWeight: 700, flexShrink: 0 }}>
                  {activeProfile.name[0].toUpperCase()}
                </div>
              )}
              {activeProfile ? activeProfile.name : 'Changer de profil'}
            </Link>
            <Link href="/profil" onClick={() => setMenuOpen(false)} className="text-sm text-[#aaa] hover:text-white transition-colors">Paramètres du compte</Link>
          </div>
        </div>
      )}
    </header>
  )
}
```

- [ ] **Step 3: Vérifier le build**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/Navbar.tsx app/layout.tsx
git commit -m "feat(profiles): navbar affiche avatar du profil actif"
```

---

## Task 10 — Mise à jour `app/profil/page.tsx`

**Fichiers:**
- Modifier: `app/profil/page.tsx`

La page profil doit filtrer les listes par `profile_id` et afficher le nom du profil actif.

- [ ] **Step 1: Modifier `app/profil/page.tsx`**

Remplacer les deux requêtes `.eq('user_id', user.id)` par `.eq('profile_id', profileId)` :

```typescript
// app/profil/page.tsx
import { createClient } from '@/lib/supabase/server'
import { ProfileClient } from '@/app/profil/ProfileClient'
import { AuthTabs } from '@/components/auth/AuthTabs'
import { getRecommendations } from '@/lib/recommendations'
import { getMediaDetail } from '@/lib/tmdb'
import type { MediaType } from '@/lib/tmdb'
import { getActiveProfileId } from '@/lib/profile'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Profile } from '@/app/actions/profiles'

export default async function ProfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <AuthTabs />

  const profileId = await getActiveProfileId()
  if (!profileId) return <AuthTabs />

  const admin = createAdminClient()

  const [{ data: lists }, { data: prefs }, { data: profileData }] = await Promise.all([
    admin.from('user_media_lists').select('*').eq('profile_id', profileId),
    admin.from('user_preferences').select('*').eq('profile_id', profileId).maybeSingle(),
    admin.from('profiles').select('*').eq('id', profileId).eq('user_id', user.id).single(),
  ])

  const activeProfile = profileData as Profile | null
  const rawLists = lists ?? []

  const enriched = await Promise.all(
    rawLists.map(async (item: { tmdb_id: number; media_type: string; poster_path: string | null; title: string | null; [key: string]: unknown }) => {
      if (item.poster_path && item.title) return item
      try {
        const media = await getMediaDetail(item.tmdb_id, item.media_type as MediaType)
        return { ...item, poster_path: media.poster_path ?? null, title: media.title ?? media.name ?? null }
      } catch { return item }
    })
  )

  const preferredGenres = (prefs?.preferred_genres ?? []) as number[]

  const watchedItems = enriched.filter((i: { list_type: string }) => i.list_type === 'watched')
  const recommendations = watchedItems.length > 0
    ? await getRecommendations(watchedItems as { tmdb_id: number; media_type: string }[], preferredGenres)
    : []

  return (
    <ProfileClient
      user={user}
      lists={enriched as Parameters<typeof ProfileClient>[0]['lists']}
      preferredGenres={preferredGenres}
      recommendations={recommendations}
      activeProfile={activeProfile}
    />
  )
}
```

- [ ] **Step 2: Mettre à jour la signature de `ProfileClient.tsx`**

Dans `app/profil/ProfileClient.tsx`, ajouter `activeProfile` dans `Props` et l'utiliser pour afficher le nom du profil actif en haut de la page :

```typescript
// Ajouter dans Props (app/profil/ProfileClient.tsx)
import type { Profile } from '@/app/actions/profiles'

interface Props {
  user: User
  lists: MediaListItem[]
  preferredGenres: number[]
  recommendations: Media[]
  activeProfile: Profile | null  // ← ajouter
}

// Dans le composant, mettre à jour la destructuration:
export function ProfileClient({ user, lists, preferredGenres: _preferredGenres, recommendations, activeProfile }: Props) {
```

Puis ajouter un lien "Gérer les profils" dans la sidebar, sous les stats :

```tsx
{/* Lien gestion profils */}
<Link
  href="/profils"
  style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textDecoration: 'none' }}
>
  ← Changer de profil
</Link>
```

- [ ] **Step 3: Vérifier le build**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Tester le flux complet**

1. Démarrer `npm run dev`
2. Se connecter → écran `/profils` → sélectionner un profil → cookie posé → redirection `/`
3. Aller sur `/profil` → listes du profil affichées
4. Ajouter un film en watchlist → vérifier qu'il apparaît dans `/profil`
5. Aller sur `/profils` → sélectionner un autre profil → aller sur `/profil` → listes différentes

- [ ] **Step 5: Commit**

```bash
git add app/profil/page.tsx app/profil/ProfileClient.tsx
git commit -m "feat(profiles): page profil filtre par profile_id actif"
```

---

## Task 11 — Commit final et vérification

- [ ] **Step 1: Lancer les tests**

```bash
npm test -- --no-coverage
```

Attendu: tous les tests passent.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Attendu: 0 erreurs.

- [ ] **Step 3: Vérifier que le flux complet fonctionne**

Scénarios à tester :
- Nouvel utilisateur → `/profils/nouveau` → crée profil → `/profils` → sélectionne → `/`
- Utilisateur existant → `/profils` → 1 profil existant → sélection → `/` → watchlist correcte
- Créer 5 profils → bouton "Ajouter" masqué → erreur si tentative via URL directe
- Modifier profil → nom/couleur/avatar mis à jour
- Supprimer profil (avec > 1 profil) → redirection `/profils`
- Cookie invalide (profil supprimé) → redirection `/profils`

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "feat(profiles): système multi-profils Netflix-like complet"
```
