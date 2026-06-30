# Design — Système multi-profils (Netflix-like)

**Date :** 2026-06-24
**Statut :** Approuvé

## Contexte

ZelianTV est une application Netflix-like (Next.js 16.2.9, Supabase, TypeScript). Actuellement, un compte (email + mot de passe) = un seul espace. L'objectif est d'ajouter un système de profils similaire à Netflix Premium : un compte unique, jusqu'à 5 profils indépendants avec leurs propres listes, recommandations et préférences de genres.

## Décisions de conception

| Question | Décision |
|----------|----------|
| Profils max par compte | 5 (Netflix Premium) |
| Protection par PIN | Non — accès libre à tous les profils |
| Données isolées par profil | Listes (watchlist, déjà vu, custom) + recommandations + préférences de genres |
| Écran de sélection | Page plein écran "Qui regarde ?" (style Netflix) |
| Avatar de profil | Photo uploadée (même système Canvas + Supabase Storage existant) |
| Tracking du profil actif | Cookie httpOnly `zelian_profile_id` + middleware |

## Architecture

### Approche choisie : Cookie httpOnly + middleware

Le profil actif est stocké dans un cookie `zelian_profile_id`. Le middleware existant (`middleware.ts`) est étendu pour lire ce cookie, valider que le profil appartient à l'utilisateur connecté, et injecter le `profile_id` en header `x-profile-id` pour les Server Components.

### Schéma BDD

**Nouvelle table `profiles` :**
```sql
CREATE TABLE profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  avatar_url  TEXT,
  color       TEXT NOT NULL DEFAULT '#f97316',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Max 5 profils par compte (enforced applicativement)
-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_user" ON profiles
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

**Migration `user_media_lists` :**
```sql
ALTER TABLE user_media_lists
  ADD COLUMN profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
```

`user_id` reste sur `user_media_lists` pour la RLS. `profile_id` est le filtre applicatif.

**`user_preferences` :** même colonne `profile_id` ajoutée.

### Gestion de session

1. Après login réussi → vérifier cookie `zelian_profile_id`
2. Cookie absent ou invalide → rediriger vers `/profils`
3. Profil sélectionné → `Set-Cookie: zelian_profile_id=<uuid>; HttpOnly; SameSite=Lax; Path=/`
4. Middleware valide le cookie à chaque requête et injecte `x-profile-id` en header
5. Server Components lisent `headers().get('x-profile-id')` pour scoper les requêtes

**Cas : nouvel utilisateur (aucun profil existant)**
Au premier login, `/profils` détecte 0 profils → redirige directement vers `/profils/nouveau` pour forcer la création d'au moins un profil avant d'accéder à l'app.

**Limite de 5 profils**
Avant toute création, la Server Action vérifie `COUNT(*) FROM profiles WHERE user_id = auth.uid()`. Si `>= 5`, retourne une erreur et le bouton "Ajouter un profil" est masqué côté client.

### Pages et routes

| Route | Description |
|-------|-------------|
| `/profils` | Écran plein écran "Qui regarde ?" — liste profils + bouton Ajouter |
| `/profils/nouveau` | Création d'un profil (nom + avatar upload) |
| `/profils/[id]/modifier` | Édition nom, avatar ; suppression du profil |

### Navigation

La navbar affiche le petit avatar du profil actif. Un clic redirige vers `/profils` pour changer de profil. La page `/profil` existante garde la gestion du **compte** (email, mot de passe, déconnexion) — distincte des profils.

### Migration des données existantes

Script de migration exécuté une fois :
1. Pour chaque `user_id` distinct dans `user_media_lists` : créer un profil "Par défaut" avec `display_name` et `avatar_url` depuis `user_metadata`
2. Mettre à jour toutes les lignes `user_media_lists` avec le `profile_id` correspondant
3. Même opération pour `user_preferences`

Les utilisateurs existants arrivent sur l'écran de sélection avec leur profil déjà créé — pas d'interruption.

## Composants à créer

- `ProfileSelectionPage` — écran "Qui regarde ?" (plein écran, dark, avatars centrés)
- `ProfileCard` — carte cliquable d'un profil (avatar + nom)
- `ProfileForm` — formulaire création/édition (nom + upload avatar)
- `ProfileAvatarUpload` — réutilise `compressImage` + `uploadAvatarAction` adaptés

## Composants à modifier

- `middleware.ts` — lire + valider `zelian_profile_id`, injecter `x-profile-id`
- `Navbar` — afficher avatar du profil actif
- `ProfileClient.tsx` — page `/profil` : ajouter accès à la gestion des profils
- Server Components qui accèdent aux listes — passer `profile_id` au lieu de `user_id`
- Server Actions (watchlist, deleteList, etc.) — filtrer par `profile_id`

## Fichiers impactés (estimation)

- `middleware.ts`
- `app/profils/page.tsx` (nouveau)
- `app/profils/nouveau/page.tsx` (nouveau)
- `app/profils/[id]/modifier/page.tsx` (nouveau)
- `app/actions/watchlist.ts`
- `app/actions/avatar.ts` (adaptation pour profils)
- `app/profil/page.tsx`
- `app/profil/ProfileClient.tsx`
- `components/Navbar.tsx`
- `lib/supabase/` — helpers pour récupérer le profile actif
- Migration SQL : `supabase/migrations/XXXX_add_profiles.sql`

## Non inclus dans ce scope

- PIN / protection par profil (décision : accès libre)
- Profil enfant / filtrage de contenu
- Partage de profils entre comptes différents
