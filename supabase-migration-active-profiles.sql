-- Migration : Ajouter la colonne "active" sur target_profiles
-- À exécuter dans Supabase > SQL Editor

ALTER TABLE target_profiles
ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Les profils existants seront actifs par défaut
