# TalentFinder — Guide d'installation

## Prérequis
- Node.js 18+ installé
- Compte Supabase (gratuit) : https://supabase.com
- Clé API Anthropic : https://console.anthropic.com
- Clé API Apollo.io : https://app.apollo.io/#/settings/integrations/api

---

## Étape 1 — Base de données Supabase

1. Créez un projet sur https://supabase.com
2. Allez dans **SQL Editor** et collez le contenu de `supabase/schema.sql`
3. Cliquez **Run** pour créer les tables
4. Récupérez vos clés dans **Settings → API** :
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Étape 2 — Variables d'environnement

Copiez `.env.local.example` en `.env.local` et remplissez les valeurs :

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
APOLLO_API_KEY=votre_cle_apollo
```

---

## Étape 3 — Installation et démarrage local

```bash
cd talent-finder
npm install
npm run dev
```

Ouvrez http://localhost:3000

---

## Étape 4 — Déploiement sur Vercel

1. Poussez le dossier `talent-finder` sur GitHub
2. Connectez le repo sur https://vercel.com/new
3. Dans **Environment Variables**, ajoutez les 4 variables du `.env.local`
4. Cliquez **Deploy** → votre app est en ligne !

---

## Fonctionnalités

| Module | Description |
|--------|-------------|
| **Dashboard** | Vue d'ensemble, stats, pipeline |
| **Profils cibles** | Définir les postes à pourvoir et compétences requises |
| **Sourcing** | Recherche Apollo.io par titre, compétences, localisation |
| **Candidats** | Pipeline Kanban (Identifié → Sélectionné) |
| **Fiche candidat** | Notes, génération de message LinkedIn par IA, historique |
| **Entretien** | Grille de compétences en live, synthèse IA, recommandation Go/No Go |

---

## Clé Apollo.io

- Gratuit jusqu'à 50 contacts/mois sur le plan basic
- Plan Pro recommandé pour une utilisation intensive
- La clé API se trouve dans Apollo → Settings → Integrations → API
