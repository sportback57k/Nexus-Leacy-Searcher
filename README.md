# NEXUS — Vercel + Supabase

Version statique compatible Vercel, avec authentification Supabase, recherche côté navigateur, journal des recherches, modération BAVUR/BLOCUS et console admin.

## Configuration

1. Dans `js/config.js`, renseigne :
   - `supabaseUrl` : l'URL du projet Supabase (sans `/rest/v1/`)
   - `supabaseAnonKey` : la clé **Publishable / anon**
   - `endpoint` : l'endpoint de recherche autorisé que tu utilises
2. N'utilise jamais une clé `sb_secret_...` ou `service_role` dans le navigateur.
3. Dans Supabase > SQL Editor, exécute les migrations dans cet ordre :
   - `supabase_schema.sql` si la base initiale n'existe pas encore
   - `supabase_search_fix.sql`
   - `supabase_admin_media_fix.sql`
4. Dans Authentication > Sign In / Providers, active Email si nécessaire.
5. Crée ton compte, puis passe `is_admin` à `true` dans `nexus_profiles` pour le compte administrateur.
6. Déploie le dossier sur Vercel.

## Console admin

Le panneau admin permet désormais :

- de charger tous les pseudos dans un menu déroulant ;
- de définir directement le nombre de crédits d'un compte ;
- de voir l'activité d'un utilisateur ;
- de voir les critères exacts enregistrés dans les journaux de recherche ;
- de modérer les vidéos BAVUR et BLOCUS ;
- d'approuver ou refuser une vidéo.

## Vidéos BAVUR / BLOCUS

Les utilisateurs connectés peuvent envoyer un MP4 jusqu'à 500 Mo avec un titre et une description.

Une vidéo reste en attente jusqu'à validation d'un admin. Lorsqu'elle est approuvée, elle devient visible dans :

- la page BAVUR ou BLOCUS ;
- la section **Avant-première** située en bas de l'accueil.

La migration crée les buckets Supabase Storage nécessaires et leurs règles RLS.


## Correctif console admin

Exécute `supabase_admin_media_fix.sql` en entier dans Supabase > SQL Editor. Cette migration inclut aussi les colonnes `username` et `criteria` du journal `nexus_search_logs`, afin que la console admin puisse afficher les critères exacts.


### Suppression des vidéos
Dans la console administrateur, la section BAVUR & BLOCUS permet désormais de supprimer définitivement une vidéo en attente ou déjà publiée. La suppression retire le fichier du stockage et la ligne correspondante de `nexus_videos`.


### Si Supabase affiche `Could not find the function public.nexus_start_search(...) in the schema cache`

Exécute entièrement `supabase_admin_media_fix.sql` dans Supabase > SQL Editor. La migration recharge automatiquement le cache de schéma PostgREST à la fin.


### Recherche endpoint — correctif v8
La recherche passe par `/api/search` côté Vercel pour éviter les problèmes CORS du navigateur et afficher les erreurs réelles de la source. Le crédit n'est réservé qu'après une réponse valide. Tu peux définir `NEXUS_SEARCH_ENDPOINT` dans les variables d'environnement Vercel ; sinon la valeur de `js/config.js` est utilisée.


## V11 — recherche legacy conservée
- La recherche utilise directement `NEXUS_CONFIG.endpoint`, comme la version legacy qui fonctionnait.
- Aucun proxy `/api/search` n'est utilisé.
- Les fonctions admin, crédits, historique, critères et vidéos restent conservées.
- Les erreurs JSON reçues comme objets sont maintenant converties proprement en texte afin d'éviter l'affichage `[object Object]`.

## V32 — présence réelle + crédits quotidiens

- Le compteur « en ligne » utilise Supabase Realtime Presence et compte uniquement les présences actuellement actives.
- Les comptes utilisateurs reçoivent 5 crédits par jour.
- Le renouvellement se fait automatiquement à minuit (Europe/Paris), avec un reset côté serveur.
- Le bouton « Crédits » dans la barre du haut ouvre une fenêtre indiquant le solde et le temps restant avant le prochain renouvellement.
- Pour activer les crédits quotidiens sur un projet Supabase existant, exécuter `supabase_daily_credits.sql` une fois dans le SQL Editor.
- Les administrateurs gardent des crédits illimités.


## Navigation multipage
Les routes Vercel sont disponibles via `/accueil/`, `/recherche/`, `/connexion/`, `/bavur/`, `/blocus/`, `/discord/` et `/admin/`. Chaque route utilise le même cœur Supabase et la même interface, avec une transition d'entrée dédiée.

## V38 — thème global admin
Exécuter `supabase_site_theme.sql` dans Supabase. L'administrateur peut ensuite choisir Rouge, Violet, Bleu, Vert, Orange, Rose ou une couleur personnalisée. Le thème est enregistré côté Supabase et appliqué à tous les visiteurs.
