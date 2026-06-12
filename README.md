# TravelCraft MVP — Guide d'installation & migration

Application centrale multi-clients : un espace admin (toi) + une page privée
premium par voyage (`/trip/:slug`). React Vite · Supabase · Leaflet/OSM · Vercel.

---

## 1. Installation

```bash
npm create vite@latest travelcraft -- --template react
cd travelcraft
npm install @supabase/supabase-js react-router-dom leaflet
```

Copier les fichiers de ce dossier dans le projet :

```
supabase/001_schema.sql          → à exécuter dans Supabase (SQL Editor)
src/App.jsx                      → remplace le App.jsx de Vite
src/styles/atelier.css
src/lib/supabaseClient.js
src/lib/geo.js
src/components/TripMap.jsx
src/pages/TripPublicPage.jsx
src/pages/admin/AdminDashboard.jsx
src/pages/admin/AdminTrip.jsx
```

`.env.local` :
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

`vercel.json` à la racine (SPA — sinon /trip/:slug renvoie 404 au refresh) :
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

## 2. Configuration Supabase

1. Créer le projet en **région UE** (Francfort ou Paris) — RGPD.
2. SQL Editor → exécuter `001_schema.sql` (tables + index + RLS).
3. Authentication → Users → **Add user** : ton email + mot de passe
   (c'est le compte admin ; désactiver les inscriptions publiques dans
   Authentication → Providers → Email → "Allow new users to sign up" OFF).
4. Vercel → Settings → Environment Variables : ajouter les deux variables.

## 3. Plan de migration progressif (ne rien casser)

| Étape | Action | Risque |
|---|---|---|
| 1 | Nouveau repo Vite + Supabase, prototype artifact conservé comme maquette | nul |
| 2 | Exécuter le schéma SQL, créer le compte admin | nul |
| 3 | Saisir 1 client + 1 voyage test (Lisbonne) dans /admin | nul |
| 4 | Vérifier /trip/:slug en navigation privée (anonyme) | nul |
| 5 | Publier sur Vercel, tester sur mobile réel | faible |
| 6 | Premier vrai client → recueillir le feedback | faible |
| 7 | (plus tard) brancher la génération IA via fonction serverless `api/claude.js` comme sur le prototype, qui écrit dans trip_days/places | moyen |

L'étape 7 réutilise tel quel le pattern wrapper Vercel sécurisé déjà
construit pour le prototype (clé Anthropic côté serveur, jamais exposée).

## 4. Routes

| Route | Accès | Rôle |
|---|---|---|
| `/admin` | authentifié | clients, voyages, publication, lien privé |
| `/admin/trip/:id` | authentifié | journées, lieux, carte, cohérence, feedback reçu |
| `/trip/:slug` | anonyme (slug difficile à deviner) | page client premium |

## 5. Sécurité & RGPD — décisions appliquées

- RLS : l'anonyme ne lit QUE les voyages publiés ; la table `clients`
  (et donc allergies / préférences alimentaires, données sensibles art. 9)
  n'a AUCUNE policy anon → invisible publiquement, même avec le slug.
- Le slug est généré aléatoirement (entropie ~30 bits) et révocable :
  « Dépublier » coupe l'accès immédiatement.
- Suppression en cascade : effacer un client efface ses voyages, journées,
  liaisons et feedbacks (droit à l'effacement en un DELETE).
- Mention d'information sur la page client (usage du feedback + droit de
  suppression). Aucun document sensible stocké.
- Le feedback anonyme ne porte pas le client_id côté public (rempli côté
  admin si besoin) — minimisation.

## 6. Tests avant déploiement

1. **RLS** : en navigation privée (non connecté), ouvrir /trip/:slug d'un
   voyage NON publié → « Voyage introuvable ». Le publier → visible.
2. **RLS clients** : console navigateur sur la page publique :
   `await supabase.from('clients').select('*')` → doit renvoyer 0 ligne.
3. **Feedback** : cliquer 👍 sur un lieu + envoyer un commentaire → vérifier
   l'arrivée dans /admin/trip/:id section Feedback.
4. **Carte** : jour avec 2+ lieux géolocalisés → marqueurs J1-1, ligne,
   distance affichée ; lieu sans coordonnées → badge « à compléter », app
   non bloquée.
5. **Cohérence** : ajouter le même lieu à 2 jours → alerte doublon.
6. **Google Maps** : bouton du jour → itinéraire multi-étapes correct.
7. **Mobile** : page client sur iPhone (Safari) — boutons ≥ 44px, carte
   lisible, pas de scroll horizontal.
8. **Refresh** : F5 sur /trip/:slug en prod Vercel → pas de 404 (vercel.json).
9. **Dépublication** : dépublier → le lien client meurt instantanément.

## 7. Après le MVP (dans l'ordre)

1. Génération IA des journées depuis l'admin (réutilise prompts v3).
2. Profil client enrichi par le feedback → injecté dans le prompt suivant.
3. knowledge_base alimentée par les lieux validés (verification_status).
4. Réordonnancement drag & drop des étapes.
5. Export PDF de la proposition.
