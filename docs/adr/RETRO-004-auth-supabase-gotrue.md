# RETRO-004 — Authentification via Supabase GoTrue (email/password + session SSR)

| Champ      | Valeur              |
|------------|---------------------|
| Statut     | Documenté (rétro)   |
| Date       | 2026-06-24          |
| Source     | Rétro-ingénierie    |
| Features   | auth, profil, listes-personnelles |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Catégorie | AUTH |
| Q1 — Coût de revert > 1j ? | OUI — remplacer GoTrue par NextAuth ou une solution JWT custom toucherait `proxy.ts` (logique de refresh), `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`, les trois formulaires (`LoginForm`, `SignupForm`, `AuthTabs`), le pattern `getAuthUser()` dans toutes les Server Actions, et `app/profil/page.tsx` (auth check + guard `AuthTabs`). Refactoring transverse sur au moins 10 fichiers, avec migration potentielle des sessions existantes. |
| Q2 — Non-déductible du code ? | OUI — `package.json` montre `@supabase/supabase-js` et `@supabase/ssr`, mais la décision de déléguer entièrement l'auth (identité, sessions, tokens, reset password, confirmation email) à GoTrue plutôt qu'implémenter un système JWT custom, utiliser NextAuth, ou gérer les sessions en BDD propre n'est pas déductible des fichiers de config. De même, le choix d'appeler `supabase.auth.getUser()` dans le middleware à chaque requête (plutôt que de valider le JWT localement) pour rafraîchir le cookie SSR est une intention architecturale non visible dans `tsconfig.json` ou `package.json`. |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — auth (formulaires de connexion/inscription/reset), profil (guard `if (!user) return <AuthTabs />`  + modifications email/password via `supabase.auth.updateUser`), listes-personnelles (pattern `getAuthUser()` systématique dans `watchlist.ts` avant chaque mutation). |
| Q4 — Casse un invariant si ignoré ? | OUI — un dev qui ignore ce choix et implémente une session maison (ex. cookie JWT signé manuellement) contourne le mécanisme de rafraîchissement de `proxy.ts` : les sessions GoTrue expirées ne seraient plus renouvelées, les utilisateurs seraient déconnectés silencieusement sans 401. Un dev qui supprime l'appel `supabase.auth.getUser()` de `proxy.ts` casse le rafraîchissement automatique du token Supabase sur toutes les routes SSR. |

> Validé contre la politique `.claude/rules/06-adr-policy.md`.

## Contexte

ZelianTV est une application Next.js avec App Router et des données utilisateur persistées dans Supabase (PostgreSQL). Le projet a besoin d'une identité utilisateur pour les listes personnelles, le profil, et les recommandations. La stack Supabase était déjà choisie pour la BDD — GoTrue, le service d'authentification intégré de Supabase, est la solution naturelle qui évite d'introduire une dépendance auth tierce (NextAuth, Auth.js, Clerk, etc.) dans un projet mono-service.

La gestion des sessions dans un contexte Next.js App Router (Server Components + Server Actions + Route Handlers) impose une stratégie cookie-based SSR, car les Server Components ne peuvent pas accéder au `localStorage`. La bibliothèque `@supabase/ssr` fournit les adaptateurs nécessaires pour propager les cookies de session entre le navigateur, le middleware, les Server Components et les Server Actions.

## Décision identifiée

### 1. Fournisseur d'authentification : Supabase GoTrue

Toute l'authentification est déléguée à Supabase GoTrue via le SDK `@supabase/supabase-js` v2 :
- **Connexion** : `supabase.auth.signInWithPassword({ email, password })` dans `LoginForm.tsx`
- **Inscription** : `supabase.auth.signUp({ email, password })` dans `SignupForm.tsx`
- **Réinitialisation de mot de passe** : `supabase.auth.resetPasswordForEmail(email, { redirectTo })` dans `LoginForm.tsx`
- **Modification d'email** : Server Action `changeEmailAction` via `createAdminClient().auth.admin.updateUserById()` (avec `email_confirm: true`)
- **Modification de mot de passe** : `supabase.auth.updateUser({ password })` côté client dans `ProfileClient.tsx`

### 2. Gestion des sessions : cookies SSR via `@supabase/ssr`

Les sessions sont persistées dans des cookies HTTP gérés par `@supabase/ssr`. Trois clients distincts sont instanciés selon le contexte d'exécution :

| Client | Fichier | Contexte | Clé utilisée |
|--------|---------|----------|--------------|
| Browser | `lib/supabase/client.ts` | Client Components (formulaires auth) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Server | `lib/supabase/server.ts` | Server Components, auth check | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Admin | `lib/supabase/admin.ts` | Server Actions (mutations) | `SUPABASE_SERVICE_ROLE_KEY` |

### 3. Rafraîchissement de session dans le middleware

Le fichier `proxy.ts` (middleware Next.js) appelle `supabase.auth.getUser()` sur chaque requête (matcher universel sauf assets statiques). Cet appel est nécessaire pour que `@supabase/ssr` puisse détecter un token expiré et le rafraîchir en réécrivant les cookies dans la réponse HTTP. Sans cet appel dans le middleware, les sessions expirées ne seraient pas renouvelées côté SSR.

### 4. Guard d'authentification : rendu conditionnel serveur

Dans `app/profil/page.tsx`, la vérification d'identité est faite au niveau Server Component :
```ts
const { data: { user } } = await supabase.auth.getUser()
if (!user) return <AuthTabs />
```
Aucune redirection HTTP — l'utilisateur non connecté voit les formulaires auth directement dans la page `/profil`.

## Conséquences observées

### Positives

- Aucun JWT à gérer manuellement — GoTrue gère l'émission, le rafraîchissement et la révocation des tokens
- La table `auth.users` Supabase est disponible immédiatement pour les FK dans `user_media_lists` et `user_preferences`
- La RLS Supabase s'appuie sur `auth.uid()` fourni par GoTrue — cohérence garantie entre l'identité auth et l'isolation données (voir RETRO-002)
- `@supabase/ssr` gère le cycle de vie des cookies de session de façon transparente pour le code applicatif

### Négatives / Dette

- **Couplage Supabase omniprésent** : les composants client (`LoginForm`, `SignupForm`) instancient directement le client Supabase via `createClient()`. Pas d'abstraction de service auth — migrer vers un autre provider nécessiterait de modifier les composants UI.
- **`console.log` dans `createAdminClient()`** : le fichier `lib/supabase/admin.ts` (lignes 7-10) décode et logue partiellement le JWT de la service role key à chaque instanciation. Violation de la règle Zelian #4 (pas de `console.log` en production) et potentielle fuite d'information sur le rôle du token. Déjà signalé en RETRO-002.
- **Pas de gestion des erreurs GoTrue typée** : les erreurs retournées par `signInWithPassword` / `signUp` sont affichées directement via `error.message` (message anglais Supabase, non traduit). Aucune catégorisation des codes d'erreur.
- **Mot de passe oublié sans validation email préalable** : `resetPasswordForEmail` est appelé sans vérifier si l'email existe dans la base — GoTrue envoie l'email silencieusement même si l'adresse n'est pas enregistrée (comportement délibéré de GoTrue pour éviter l'énumération d'emails, mais non documenté dans le code).
- **Modification d'email via client admin sans re-vérification de l'ancien email** : `changeEmailAction` utilise `updateUserById` admin, qui contourne la vérification de l'email actuel. L'utilisateur peut changer son email sans prouver qu'il contrôle l'adresse actuelle.

## Recommandation

Garder — GoTrue est le choix naturel dans un projet full-Supabase et couvre les besoins d'une v1. Actions à planifier :

1. Supprimer les `console.log` dans `lib/supabase/admin.ts` (règle Zelian #4, déjà dans RETRO-002)
2. Typer les erreurs GoTrue avec les codes d'erreur officiels (`AuthApiError.code`) pour afficher des messages traduits
3. Documenter explicitement dans `changeEmailAction` que le bypass admin ne vérifie pas l'email actuel (risque de prise de compte si un attaquant a accès à une session active)
