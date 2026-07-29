-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT CHECK (role IN ('user', 'expert', 'admin')) DEFAULT 'user',
  urban_profile BOOLEAN DEFAULT FALSE,
  tools_available TEXT[] DEFAULT '{}',
  experience_level TEXT CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')) DEFAULT 'beginner',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_experience ON users(experience_level);

-- Scans table (persist each waste scan)
CREATE TABLE scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  material_type TEXT NOT NULL,
  material_label TEXT NOT NULL,
  condition TEXT NOT NULL,
  confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('aman', 'hati_hati', 'berisiko')),
  safety_notes TEXT[] DEFAULT '{}',
  potential_uses TEXT[] DEFAULT '{}',
  difficulty TEXT CHECK (difficulty IN ('mudah', 'sedang', 'sulit')),
  potential_value TEXT CHECK (potential_value IN ('rendah', 'sedang', 'tinggi')),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_scans_user_id ON scans(user_id);
CREATE INDEX idx_scans_material_type ON scans(material_type);
CREATE INDEX idx_scans_created_at ON scans(created_at DESC);

-- Products table (upcycling product catalog)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  material_type TEXT NOT NULL,
  thumbnail_url TEXT,
  description TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  estimated_cost INTEGER NOT NULL,
  estimated_time_minutes INTEGER NOT NULL,
  tools_required TEXT[] DEFAULT '{}',
  region_price_adjustment FLOAT DEFAULT 1.0 CHECK (region_price_adjustment > 0),
  is_approved BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_products_material_type ON products(material_type);
CREATE INDEX idx_products_approved ON products(is_approved) WHERE is_approved = TRUE;
CREATE INDEX idx_products_difficulty ON products(difficulty);

-- Skills table (approved upcycling methods)
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source_url TEXT,
  material_type TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  description TEXT NOT NULL,
  steps JSONB NOT NULL,
  before_image_url TEXT,
  after_image_url TEXT,
  mockup_image_url TEXT,
  required_materials TEXT[] DEFAULT '{}',
  required_tools TEXT[] DEFAULT '{}',
  estimated_cost INTEGER,
  suggested_sell_price INTEGER,
  carbon_saved_kg FLOAT,
  video_tutorial_url TEXT,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  approved BOOLEAN DEFAULT FALSE,
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_skills_material_type ON skills(material_type);
CREATE INDEX idx_skills_status ON skills(status);
CREATE INDEX idx_skills_difficulty ON skills(difficulty);

-- Skill chunks for RAG retrieval with vector indexing
CREATE TABLE skill_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID REFERENCES skills(id) ON DELETE CASCADE NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_order INTEGER NOT NULL CHECK (chunk_order >= 0),
  embedding VECTOR(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- HNSW index for fast vector similarity search
CREATE INDEX idx_skill_chunks_embedding ON skill_chunks 
  USING hnsw (embedding vector_cosine_ops);

-- Composite index for filtered retrieval
CREATE INDEX idx_skill_chunks_skill_order ON skill_chunks(skill_id, chunk_order);

-- Agent runs log (for evaluation/debugging/monitoring)
CREATE TABLE agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id UUID NOT NULL,
  input_type TEXT CHECK (input_type IN ('image_scan', 'skill_submission', 'query', 'pricing_calc')),
  input_data JSONB NOT NULL,
  output_data JSONB NOT NULL,
  latency_ms INTEGER,
  tokens_used INTEGER,
  error_message TEXT,
  gate_path JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_agent_runs_user_id ON agent_runs(user_id);
CREATE INDEX idx_agent_runs_session_id ON agent_runs(session_id);
CREATE INDEX idx_agent_runs_input_type ON agent_runs(input_type);
CREATE INDEX idx_agent_runs_created_at ON agent_runs(created_at DESC);

-- Auto-update updated_at timestamp on modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_skills_updated_at BEFORE UPDATE ON skills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
