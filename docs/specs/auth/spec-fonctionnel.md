# Spec Fonctionnelle — auth [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | auth                |
| Version    | 0.1.0               |
| Date       | 2026-06-24          |
| Auteur     | retro-documenter    |
| Statut     | DRAFT               |
| Source     | Rétro-ingénierie    |

> **[DRAFT — à valider par le dev]** Cette spec a été générée par rétro-ingénierie
> à partir du code existant. Elle doit être relue et validée par un développeur
> qui connaît le contexte métier.

---

## ADRs

| ADR | Titre | Catégorie | Statut |
|-----|-------|-----------|--------|
| [RETRO-004](../../adr/RETRO-004-auth-supabase-gotrue.md) | Authentification via Supabase GoTrue (email/password + session SSR) | AUTH | Documenté (rétro) |

---

## Contexte et objectif

Le module `auth` couvre l'identification des utilisateurs de ZelianTV. Sans compte, l'utilisateur peut naviguer sur le catalogue et les fiches détail, mais n'a accès ni aux listes personnelles (À voir / Déjà vus / listes custom), ni aux recommandations personnalisées, ni au profil. L'authentification est le point d'entrée unique pour toutes les fonctionnalités personnalisées de l'application.

L'auth est présentée directement sur la page `/profil` — si l'utilisateur n'est pas connecté, la page profil affiche les formulaires de connexion/inscription à la place du contenu profil. Il n'y a pas de page dédiée `/login` ou `/register`.

## Règles métier (déduites du code)

1. **Email et mot de passe sont les seules méthodes d'authentification.** Aucun OAuth (Google, GitHub, etc.) n'est implémenté.
2. **Le mot de passe doit comporter au minimum 6 caractères.** Cette contrainte est imposée côté client via l'attribut HTML `minLength={6}` sur l'input du formulaire d'inscription.
3. **L'inscription génère un email de confirmation.** Après un `signUp` réussi, le système envoie un email de confirmation à l'adresse fournie. Le message affiché à l'utilisateur est "Email de confirmation envoyé. Vérifiez votre boîte mail".
4. **La réinitialisation de mot de passe nécessite un email pré-rempli.** Si l'utilisateur clique sur "Mot de passe oublié ?" sans avoir saisi son email, un message d'erreur lui demande de le saisir d'abord. Le lien de réinitialisation redirige vers `/profil`.
5. **La page `/profil` sert de garde d'authentification.** Un utilisateur non connecté accédant à `/profil` voit les formulaires auth (composant `AuthTabs`) à la place du contenu profil. Il n'y a pas de redirection HTTP.
6. **La connexion réussie ne redirige pas vers une autre page.** Après une connexion réussie, la page se rafraîchit (`router.refresh()`), ce qui entraîne l'affichage du profil utilisateur à la place des formulaires.
7. **La session est maintenue côté serveur via des cookies.** La session Supabase est persistée dans des cookies HTTP et rafraîchie automatiquement à chaque requête par le middleware `proxy.ts`.

## Cas d'usage (déduits)

### CU-001 — Connexion avec email et mot de passe

**Acteur** : utilisateur possédant un compte ZelianTV.

**Flux principal** :
1. L'utilisateur accède à `/profil` (non connecté).
2. Le système affiche `AuthTabs` avec l'onglet "Se connecter" actif par défaut.
3. L'utilisateur saisit son email et son mot de passe, puis valide le formulaire.
4. Le système appelle `supabase.auth.signInWithPassword`.
5. En cas de succès : `router.refresh()` — la page se recharge et affiche le profil.
6. En cas d'erreur : le message d'erreur GoTrue est affiché en rouge sous le formulaire.

### CU-002 — Inscription avec email et mot de passe

**Acteur** : visiteur sans compte.

**Flux principal** :
1. L'utilisateur accède à `/profil`, puis clique sur l'onglet "S'inscrire".
2. Le système affiche `SignupForm`.
3. L'utilisateur saisit son email et un mot de passe (6 caractères minimum), puis valide.
4. Le système appelle `supabase.auth.signUp`.
5. En cas de succès : message "Email de confirmation envoyé. Vérifiez votre boîte mail" en vert. L'utilisateur reste sur les formulaires auth (non connecté tant qu'il n'a pas confirmé son email).
6. En cas d'erreur (ex. email déjà utilisé) : message d'erreur GoTrue en rouge.

### CU-003 — Réinitialisation de mot de passe

**Acteur** : utilisateur ayant oublié son mot de passe.

**Flux principal** :
1. L'utilisateur accède à `/profil` et saisit son email dans le champ email de `LoginForm`.
2. L'utilisateur clique sur "Mot de passe oublié ?".
3. Le système appelle `supabase.auth.resetPasswordForEmail` avec `redirectTo: '/profil'`.
4. Le message "Email de réinitialisation envoyé ✓" est affiché en vert.

**Variante — email non saisi** :
- Si l'email est vide au moment du clic, le message "Entrez votre email pour réinitialiser" est affiché en rouge. Aucun appel API n'est fait.

## Dépendances

- **Supabase GoTrue** : fournisseur d'authentification (email/password, reset, confirmation email)
- **`@supabase/ssr`** : gestion des cookies de session SSR (`createBrowserClient`, `createServerClient`)
- **`lib/supabase/client.ts`** : client navigateur utilisé par les formulaires auth
- **`lib/supabase/server.ts`** : client serveur utilisé par `app/profil/page.tsx` pour le guard auth
- **`proxy.ts`** : middleware Next.js qui rafraîchit la session sur chaque requête
- **`app/profil/page.tsx`** : page qui orchestre le guard auth et affiche soit `AuthTabs` soit `ProfileClient`
- **`next/navigation`** : `useRouter().refresh()` pour recharger la page après connexion

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- **Confirmation email obligatoire ou facultative ?** Le code affiche le message de confirmation après `signUp`, mais il n'est pas déterminable depuis le code seul si la confirmation est requise pour se connecter (paramètre configuré dans le dashboard Supabase GoTrue, non visible dans le code).
- **Politique de mot de passe côté Supabase** : la contrainte `minLength={6}` est HTML uniquement. Il n'est pas déterminable depuis le code si GoTrue impose une contrainte additionnelle côté serveur (longueur minimale, complexité).
- **Comportement du lien de réinitialisation** : le `redirectTo` pointe vers `/profil`, mais le flux après clic sur le lien email (formulaire de saisie du nouveau mot de passe, token de reset) n'est pas implémenté dans le code source identifié. Ce flux semble absent ou délégué entièrement à Supabase.
- **Gestion des sessions multi-onglets** : le comportement en cas d'ouverture de plusieurs onglets avec des états de session différents n'est pas documenté ni testé.
