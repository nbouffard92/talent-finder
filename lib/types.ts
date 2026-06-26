export interface TargetProfile {
  id: string;
  name: string;
  title: string;
  linkedin_url?: string;
  competencies: string[];
  description?: string;
  created_at: string;
}

export interface Candidate {
  id: string;
  target_profile_id?: string;
  first_name: string;
  last_name: string;
  title?: string;
  company?: string;
  linkedin_url?: string;
  email?: string;
  location?: string;
  summary?: string;
  photo_url?: string;
  phone?: string;
  archived?: boolean;
  status: "identified" | "contacted" | "interview_scheduled" | "selected" | "rejected";
  notes?: string;
  created_at: string;
  updated_at: string;
  target_profile?: TargetProfile;
}

export interface Outreach {
  id: string;
  candidate_id: string;
  message: string;
  channel: "linkedin" | "email";
  status: "draft" | "sent" | "replied" | "no_reply";
  sent_at?: string;
  created_at: string;
}

export interface Interview {
  id: string;
  candidate_id: string;
  interview_date?: string;
  salary_expectation?: number;
  notes?: string;
  strengths?: string;
  weaknesses?: string;
  cultural_fit?: number;
  overall_rating?: number;
  recommendation?: "go" | "no_go" | "maybe";
  ai_summary?: string;
  created_at: string;
  candidate?: Candidate;
  competency_scores?: CompetencyScore[];
}

export interface CompetencyScore {
  id: string;
  interview_id: string;
  competency: string;
  score: number;
  comment?: string;
}

export type CandidateStatus = Candidate["status"];

export const STATUS_LABELS: Record<CandidateStatus, string> = {
  identified: "Identifié",
  contacted: "Contacté",
  interview_scheduled: "Entretien",
  selected: "Sélectionné",
  rejected: "Rejeté",
};

export const STATUS_COLORS: Record<CandidateStatus, string> = {
  identified: "bg-slate-100 text-slate-700",
  contacted: "bg-blue-100 text-blue-700",
  interview_scheduled: "bg-amber-100 text-amber-700",
  selected: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};
