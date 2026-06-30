# Spec Technique — auth

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | auth                |
| Version       | 0.1.0               |
| Date          | 2026-06-24          |
| Source        | Rétro-ingénierie    |

## Architecture du module

Le module auth est entièrement côté client pour les formulaires (Client Components avec `'use client'`), et côté serveur pour le guard d'authentification (Server Component `app/profil/page.tsx`). Il n'y a pas de Route Handler dédié à l'auth — toutes les opérations auth passent directement par le SDK Supabase.

```
Navigateur                         Serveur (Next.js)
──────────────                     ─────────────────────────────────────────
AuthTabs (Client Component)
  ├── LoginForm                    proxy.ts (middleware)
  │   ├── signInWithPassword       └── supabase.auth.getUser() → refresh cookie
  │   └── resetPasswordForEmail
  └── SignupForm                   app/profil/page.tsx (Server Component)
      └── signUp                   └── createClient() → getUser()
                                       ├── user null → <AuthTabs />
                                       └── user present → <ProfileClient />

lib/supabase/
  ├── client.ts  → createBrowserClient()   (Client Components)
  ├── server.ts  → createServerClient()    (Server Components, guard)
  └── admin.ts   → createClient(service_role)  (Server Actions mutations)
```

### Flux de session

1. L'utilisateur se connecte via `LoginForm` (Client Component) → `signInWithPassword` écrit les cookies de session dans le navigateur via `@supabase/ssr`.
2. À chaque requête suivante, `proxy.ts` appelle `supabase.auth.getUser()` avec `createServerClient` (lit les cookies de la requête). Si le token est expiré, `@supabase/ssr` rafraîchit le token et réécrit les cookies dans la réponse via `setAll`.
3. Les Server Components (`app/profil/page.tsx`) utilisent `lib/supabase/server.ts` (`createServerClient` avec `next/headers`) pour lire la session courante et vérifier l'identité.
4. Les Server Actions utilisent `lib/supabase/server.ts` pour identifier l'utilisateur (`getAuthUser` pattern), puis `lib/supabase/admin.ts` pour les mutations (bypass RLS — voir RETRO-002).

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `components/auth/AuthTabs.tsx` | Conteneur à onglets (connexion / inscription), état local `tab` | ~55 |
| `components/auth/LoginForm.tsx` | Formulaire connexion + bouton reset password | ~78 |
| `components/auth/SignupForm.tsx` | Formulaire inscription | ~62 |
| `proxy.ts` | Middleware Next.js — rafraîchissement de session Supabase sur toute requête | ~32 |
| `lib/supabase/client.ts` | Factory `createBrowserClient()` — contexte navigateur (auth formulaires) | ~8 |
| `lib/supabase/server.ts` | Factory `createServerClient()` — contexte Server Components (guard, profil) | ~27 |
| `lib/supabase/admin.ts` | Factory `createClient(service_role)` — contexte Server Actions (mutations) | ~15 |
| `app/profil/page.tsx` | Server Component — guard auth, affiche `AuthTabs` si non connecté | ~51 |

## Schéma BDD (applicable)

L'auth s'appuie sur la table gérée par Supabase GoTrue : `auth.users` (schéma `auth`, non directement accessible depuis le code applicatif). Les tables applicatives référencent `auth.users` en FK :

- `user_media_lists.user_id` → `auth.users.id`
- `user_preferences.user_id` → `auth.users.id`

Les métadonnées utilisateur (pseudo, avatar_url) sont stockées dans `auth.users.user_metadata` (champ JSONB géré par GoTrue, mis à jour via `supabase.auth.updateUser({ data: { ... } })`).

## API / Endpoints (applicable)

Pas d'endpoint REST dédié à l'auth. Toutes les opérations passent par les méthodes du SDK Supabase :

| Méthode SDK | Description | Contexte |
|-------------|-------------|---------|
| `supabase.auth.signInWithPassword({ email, password })` | Connexion email/password | Client Component (`LoginForm`) |
| `supabase.auth.signUp({ email, password })` | Inscription | Client Component (`SignupForm`) |
| `supabase.auth.resetPasswordForEmail(email, { redirectTo })` | Envoi email reset password | Client Component (`LoginForm`) |
| `supabase.auth.getUser()` | Lecture/rafraîchissement session | Middleware (`proxy.ts`) + Server Component (`profil/page.tsx`) |
| `supabase.auth.updateUser({ password })` | Changement de mot de passe | Client Component (`ProfileClient`) |
| `adminClient.auth.admin.updateUserById(id, { email, email_confirm })` | Changement d'email (admin bypass) | Server Action (`profile.ts`) |

## Patterns identifiés

- **Client Component auth** : `LoginForm` et `SignupForm` sont des Client Components (`'use client'`) qui instancient directement `createClient()` (browser) sans passer par une abstraction de service. Pas d'injection de dépendance.
- **Guard auth serveur par rendu conditionnel** : `app/profil/page.tsx` retourne `<AuthTabs />` si l'utilisateur est `null` — pas de `redirect()` HTTP, pas de middleware de protection de route. L'auth check se fait dans le Server Component lui-même.
- **Onglets par état local React** : `AuthTabs` gère l'onglet actif via `useState<'login' | 'signup'>('login')`. Pas de routing `/login` vs `/register`.
- **Rafraîchissement de session via middleware universel** : `proxy.ts` utilise un matcher couvrant toutes les routes (sauf assets statiques). `supabase.auth.getUser()` est appelé à chaque requête, même pour les pages publiques (catalogue, fiche détail). Coût : 1 appel GoTrue par requête SSR.
- **Feedback utilisateur unifié** : les deux formulaires utilisent le même pattern `message` / `setMessage` avec une détection visuelle basée sur la présence du caractère `✓` dans la chaîne (`message.includes('✓')` → vert, sinon rouge). Pattern fragile si les messages évoluent.
- **Post-login sans redirection** : après `signInWithPassword` réussi, `router.refresh()` est appelé (Next.js App Router) — la page se re-rend côté serveur et le Server Component `profil/page.tsx` détecte l'utilisateur, affichant le profil sans changement d'URL.

## Décisions de détail (non éligibles ADR)

- **`redirectTo` du reset password** : pointe vers `${window.location.origin}/profil`. Le flux de saisie du nouveau mot de passe après clic sur le lien email n'est pas implémenté dans le code identifié — il est probablement délégué au dashboard Supabase (Hosted Auth UI) ou absent en v1.
- **Longueur minimale du mot de passe** : contrainte HTML `minLength={6}` uniquement dans `SignupForm`. Pas de validation côté serveur dans le code applicatif (GoTrue peut imposer ses propres contraintes, non visibles dans le code).
- **Messages d'erreur non traduits** : `error.message` de GoTrue est en anglais. Aucune couche de traduction ou mapping de codes d'erreur (`AuthApiError.code`) n'est implémentée.
- **Changement d'email via admin bypass** : `changeEmailAction` dans `app/actions/profile.ts` utilise `updateUserById` (admin) avec `email_confirm: true`. Ce flag force la re-confirmation par email mais ne vérifie pas que l'utilisateur contrôle l'adresse actuelle.

## Configuration dépendante de l'environnement

| Variable | Usage |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase — utilisée dans les 3 clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anonyme — clients browser et server |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role — client admin uniquement (jamais exposée côté client) |

Paramètres GoTrue configurés dans le dashboard Supabase (non visibles dans le code) :
- Activation de la confirmation email à l'inscription
- Template de l'email de confirmation et de reset
- Durée de vie des tokens de session (JWT expiry)

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| Aucun fichier de test auth identifié | — | Absent |

Les sous-dossiers `__tests__/actions/`, `__tests__/components/`, `__tests__/lib/` ne contiennent pas de test pour les composants `auth/` ni pour le flux GoTrue. La couverture de test du module auth est nulle.

## Dette technique

- **`console.log` dans `lib/supabase/admin.ts`** (lignes 7-10) : décode partiellement le JWT de la service role key et le logue à chaque instanciation. Violation de la règle Zelian #4 (pas de `console.log` en production). Également signalé en RETRO-002 et RETRO-004.
- **Flux reset password incomplet** : le `redirectTo: '/profil'` du reset envoie l'utilisateur sur `/profil` après clic sur le lien email, mais aucun composant ne gère le token de reset présent dans l'URL (`#access_token=...`). L'utilisateur ne peut pas saisir son nouveau mot de passe.
- **Pas de tests unitaires** : les trois composants auth et le middleware `proxy.ts` n'ont aucune couverture de test.
- **Couplage direct SDK dans les composants UI** : `LoginForm` et `SignupForm` appellent directement `createClient()` — difficile à tester unitairement sans mocker le module Supabase.
