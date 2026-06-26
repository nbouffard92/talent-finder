-- TalentFinder — Schéma Supabase
-- Exécuter dans l'éditeur SQL de votre projet Supabase

-- Profils cibles (postes à pourvoir)
CREATE TABLE target_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  linkedin_url TEXT,
  competencies TEXT[] DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Candidats
CREATE TABLE candidates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  target_profile_id UUID REFERENCES target_profiles(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  title TEXT,
  company TEXT,
  linkedin_url TEXT,
  email TEXT,
  location TEXT,
  summary TEXT,
  status TEXT DEFAULT 'identified' CHECK (status IN ('identified','contacted','interview_scheduled','selected','rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages de prise de contact
CREATE TABLE outreach (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  channel TEXT DEFAULT 'linkedin' CHECK (channel IN ('linkedin','email')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','replied','no_reply')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entretiens
CREATE TABLE interviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  notes TEXT,
  strengths TEXT,
  weaknesses TEXT,
  cultural_fit INTEGER CHECK (cultural_fit BETWEEN 1 AND 5),
  overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
  recommendation TEXT CHECK (recommendation IN ('go','no_go','maybe')),
  ai_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notes de compétences par entretien
CREATE TABLE competency_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  interview_id UUID REFERENCES interviews(id) ON DELETE CASCADE,
  competency TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment TEXT
);

-- Index utiles
CREATE INDEX idx_candidates_status ON candidates(status);
CREATE INDEX idx_candidates_profile ON candidates(target_profile_id);
CREATE INDEX idx_outreach_candidate ON outreach(candidate_id);
CREATE INDEX idx_interviews_candidate ON interviews(candidate_id);
CREATE INDEX idx_scores_interview ON competency_scores(interview_id);

-- RLS désactivé pour usage mono-utilisateur
-- (activez RLS + policies si vous souhaitez sécuriser l'accès)
