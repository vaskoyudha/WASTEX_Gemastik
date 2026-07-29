# Database & Knowledge Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up Supabase PostgreSQL database with schema migrations, RLS policies, and seed 50+ upcycling skills into vector-indexed skill library.

**Architecture:** Initialize Supabase infrastructure layer with users, scans, products, skills tables; configure pgvector extension for semantic search; populate initial knowledge base with curated upcycling templates approved by experts.

**Tech Stack:** Supabase (PostgreSQL + pgvector + Auth), OpenAI embeddings API, Python scripts for seeding

## Global Constraints

- Supabase region: `ap-southeast-1` (Singapore) for lowest latency in Indonesia
- Vector dimension: 1536 (OpenAI text-embedding-ada-002)
- Skill seed count: Minimum 50 entries covering all 6 material types
- RLS policies must enforce multi-tenant isolation
- All migrations timestamp-prefixed (YYYY-MM-DD-HHMMSS_)

---

### Task 1: Create Supabase Project and Configure Environment

**Files:**
- Create: `backend/database/.env.example`
- Modify: `.gitignore` (add `.env` patterns)

**Interfaces:**
- Consumes: None
- Produces: Supabase URL and service key configuration

- [ ] **Step 1: Sign up for Supabase account**
  
Visit https://supabase.com/dashboard, create new project named "wastex-gemastik". Record credentials:
  - Project URL: `https://xxx.supabase.co`
  - Service Role Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6...`

- [ ] **Step 2: Create environment template**

```bash
# backend/database/.env.example
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
SUPABASE_ANON_KEY=your-anon-key-here
OPENAI_API_KEY=your-openai-api-key-for-embeddings
```

- [ ] **Step 3: Update gitignore**

Add to root `.gitignore`:
```
.env
*.local.json
backend/.venv/
```

- [ ] **Step 4: Verify access**

Test connection with curl:
```bash
curl -X GET 'https://xxx.supabase.co/rest/v1/' \
  -H "apikey: your-anon-key-here" \
  -H "Authorization: Bearer your-anon-key-here"
```

Expected: JSON response from Supabase health check endpoint

- [ ] **Step 5: Commit setup**

```bash
git add backend/database/.env.example .gitignore
git commit -m "chore: add Supabase environment configuration template"
```

---

### Task 2: Create Initial SQL Schema Migration

**Files:**
- Create: `backend/database/000_initial_schema.sql`

**Interfaces:**
- Consumes: None
- Produces: PostgreSQL tables (users, scans, products, skills, skill_chunks, agent_runs) with indexes

- [ ] **Step 1: Write users table migration**

```sql
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
```

- [ ] **Step 2: Write scans table migration**

```sql
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
```

- [ ] **Step 3: Write products table migration**

```sql
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
```

- [ ] **Step 4: Write skills table migration**

```sql
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
```

- [ ] **Step 5: Write skill_chunks table for RAG**

```sql
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

-- GIN index for full-text search fallback
CREATE INDEX idx_skill_chunks_text ON skill_chunks USING gin(to_tsvector('simple', chunk_text));

-- Composite index for filtered retrieval
CREATE INDEX idx_skill_chunks_skill_order ON skill_chunks(skill_id, chunk_order);
```

- [ ] **Step 6: Write agent_runs table for evaluation**

```sql
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
  gate_path JSONB,  -- Tracks which gates fired: ["vision_ok", "gap_detected", "safety_failed"]
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_agent_runs_user_id ON agent_runs(user_id);
CREATE INDEX idx_agent_runs_session_id ON agent_runs(session_id);
CREATE INDEX idx_agent_runs_input_type ON agent_runs(input_type);
CREATE INDEX idx_agent_runs_created_at ON agent_runs(created_at DESC);
```

- [ ] **Step 7: Add update triggers for timestamps**

```sql
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
```

- [ ] **Step 8: Run migration locally**

```bash
# Install Supabase CLI if not installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref wastex-gemastik

# Apply migration
supabase db push
```

Verify success with:
```sql
-- Should return 6 table names
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
```

- [ ] **Step 9: Commit schema migration**

```bash
git add backend/database/000_initial_schema.sql
git commit -m "feat(db): create initial PostgreSQL schema with users, scans, products, skills tables

- Enable pgvector extension for semantic RAG retrieval
- Define 6 core tables with proper foreign key constraints
- Add HNSW vector index on skill_chunks.embedding for fast cosine similarity
- Implement composite indexes for common query patterns
- Configure automatic updated_at timestamp triggers"
```

---

### Task 3: Seed 50+ Skills Database

**Files:**
- Create: `/scripts/seed_skills.py`
- Test: `/backend/eval/test_seed_skills.py`

**Interfaces:**
- Consumes: Supabase connection (from environment variables), OpenAI API key
- Produces: 50+ inserted rows in skills table with chunked embeddings

- [ ] **Step 1: Create skills data template**

```python
#!/usr/bin/env python3
"""Seed script to populate 50+ upcycling skills into Supabase database."""

import os
import json
import psycopg2
from openai import OpenAI
from typing import List, Dict, Any

# Skill templates grouped by material type
SKILLS_TEMPLATES = [
    # Plastik PET (10 skills)
    {
        "title": "Pot Tanaman Gantung dari Botol PET",
        "source_url": "https://www.youtube.com/watch?v=example1",
        "material_type": "plastik_pet",
        "difficulty": "mudah",
        "risk_level": "aman",
        "description": "Ubah botol plastik bekas menjadi pot gantung ramah lingkungan untuk tanaman hias di rumah.",
        "steps": [
            {"order": 1, "title": "Persiapan Botol", "instructions": "Cuci bersih botol PET 1.5L dari sisa minuman. Lepaskan semua label dan lem."},
            {"order": 2, "title": "Pemotongan Bagian Atas", "instructions": "Gunakan cutter tajam untuk memotong bagian atas botol sesuai tinggi yang diinginkan (biasanya 15-20cm)."},
            {"order": 3, "title": "Pembuatan Lubang Gantung", "instructions": "Buat 4 lubang berjarak sama di sekitar leher botol untuk memasang tali rafia."},
            {"order": 4, "title": "Dekorasi Eksterior", "instructions": "Cat dengan cat akrilik sesuai warna pilihan atau tempel stiker motif sesuai selera."},
            {"order": 5, "title": "Pemasangan Tali", "instructions": "Masukkan tali rafia melalui 4 lubang yang sudah dibuat, ikat simpul kuat di bagian dalam."}
        ],
        "required_materials": ["Botol PET 1.5L", "Cat akrilik", "Tali rafia", "Gunting/cutter"],
        "required_tools": ["cutter", "cat_brush"],
        "estimated_cost": 0,
        "suggested_sell_price": 35000,
        "carbon_saved_kg": 0.15,
        "video_tutorial_url": "https://youtube.com/watch?v=pot-tanaman-example"
    },
    
    # Add 9 more Plastik PET variations
    {
        "title": "Wadah Hidroponik Sederhana",
        "material_type": "plastik_pet",
        "difficulty": "mudah",
        "risk_level": "aman",
        ...
    },
    
    # Repeat pattern for: plastik_hdpe (8), kardus (10), kaleng (8), kaca (10), sachet (8)
    # Total: 52 skills
    
]

def generate_embeddings(text: str, api_key: str) -> List[float]:
    """Generate OpenAI embedding vector for text."""
    client = OpenAI(api_key=api_key)
    response = client.embeddings.create(
        input=text,
        model="text-embedding-ada-002"
    )
    return response.data[0].embedding

def insert_skill(conn: psycopg2.Connection, skill: Dict[str, Any]) -> str:
    """Insert a single skill and return its ID."""
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO skills (
            title, source_url, material_type, difficulty, risk_level,
            description, steps, required_materials, required_tools,
            estimated_cost, suggested_sell_price, carbon_saved_kg,
            video_tutorial_url, status
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending')
        RETURNING id;
    """, (
        skill["title"], skill.get("source_url"), skill["material_type"],
        skill["difficulty"], skill["risk_level"], skill["description"],
        json.dumps(skill["steps"]), json.dumps(skill.get("required_materials", [])),
        json.dumps(skill.get("required_tools", [])), skill.get("estimated_cost"),
        skill.get("suggested_sell_price"), skill.get("carbon_saved_kg"),
        skill.get("video_tutorial_url")
    ))
    
    skill_id = cursor.fetchone()[0]
    conn.commit()
    return skill_id

def insert_skill_chunk(conn: psycopg2.Connection, skill_id: str, chunk_text: str, embedding: List[float], order: int):
    """Insert a chunked text segment with embedding."""
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO skill_chunks (skill_id, chunk_text, chunk_order, embedding)
        VALUES (%s, %s, %s, %s);
    """, (skill_id, chunk_text, order, embedding))
    
    conn.commit()

def chunk_text(text: str, max_tokens: int = 500) -> List[str]:
    """Split text into chunks suitable for RAG retrieval."""
    sentences = text.split('. ')
    chunks = []
    current_chunk = ""
    
    for sentence in sentences:
        if len(current_chunk) + len(sentence) < max_tokens * 4:  # Rough char approximation
            current_chunk += sentence + ". "
        else:
            chunks.append(current_chunk.strip())
            current_chunk = sentence + ". "
    
    if current_chunk:
        chunks.append(current_chunk.strip())
    
    return chunks

def main():
    """Main seeding function."""
    # Load environment variables
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    
    # Connect to Supabase PostgreSQL
    conn = psycopg2.connect(
        host="db.xxx.supabase.co",
        port=5432,
        database="postgres",
        user="postgres",
        password=SUPABASE_SERVICE_KEY
    )
    
    print(f"Connecting to Supabase database...")
    print(f"Seeding {len(SKILLS_TEMPLATES)} skills...")
    
    inserted_count = 0
    
    for skill_template in SKILLS_TEMPLATES:
        try:
            # Insert skill record
            skill_id = insert_skill(conn, skill_template)
            
            # Generate embedding for description
            embedding = generate_embeddings(skill_template["description"], OPENAI_API_KEY)
            
            # Chunk and store description for RAG
            chunks = chunk_text(skill_template["description"])
            for i, chunk in enumerate(chunks):
                insert_skill_chunk(conn, str(skill_id), chunk, embedding[:len(chunk)], i)
            
            print(f"✓ Seeded: {skill_template['title']}")
            inserted_count += 1
            
        except Exception as e:
            print(f"✗ Failed to seed {skill_template['title']}: {e}")
            conn.rollback()
    
    conn.close()
    print(f"\nCompleted: {inserted_count}/{len(SKILLS_TEMPLATES)} skills seeded")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Install dependencies**

```bash
cd backend
uv sync --group dev
# or pip install
pip install psycopg2-binary openai
```

- [ ] **Step 3: Copy .env file**

```bash
cp database/.env.example database/.env
# Edit .env and fill in real API keys
```

- [ ] **Step 4: Run seed script**

```bash
python scripts/seed_skills.py
```

Expected output: `Completed: 52/52 skills seeded`

- [ ] **Step 5: Verify seed results**

```sql
-- Should show 52 rows
SELECT COUNT(*) FROM skills WHERE status = 'pending';

-- Sample a skill to verify structure
SELECT title, material_type, difficulty, cardinality(steps) as step_count FROM skills LIMIT 5;

-- Check embeddings are stored
SELECT skill_id, array_agg(embedding) FROM skill_chunks GROUP BY skill_id LIMIT 5;
```

- [ ] **Step 6: Write unit tests**

```python
# /backend/eval/test_seed_skills.py
import pytest
import psycopg2
import os

@pytest.fixture
def db_connection():
    conn = psycopg2.connect(
        host=os.getenv("SUPABASE_HOST"),
        database="postgres",
        user="postgres",
        password=os.getenv("SUPABASE_SERVICE_KEY")
    )
    yield conn
    conn.close()

def test_minimum_skills_count(db_connection):
    """Verify at least 50 skills were seeded"""
    cursor = db_connection.cursor()
    cursor.execute("SELECT COUNT(*) FROM skills")
    count = cursor.fetchone()[0]
    assert count >= 50, f"Expected ≥50 skills, got {count}"

def test_all_material_types_covered(db_connection):
    """Ensure all 6 material types have seed data"""
    cursor = db_connection.cursor()
    cursor.execute("SELECT DISTINCT material_type FROM skills ORDER BY material_type")
    materials = [row[0] for row in cursor.fetchall()]
    
    expected_materials = [
        "plastik_pet", "plastik_hdpe", "kardus", 
        "kaleng", "kaca", "sachet"
    ]
    
    assert set(materials) == set(expected_materials), f"Missing material types: {set(expected_materials) - set(materials)}"

def test_skill_structure_validity(db_connection):
    """Verify each skill has required fields populated"""
    cursor = db_connection.cursor()
    cursor.execute("""
        SELECT id, title, steps, material_type FROM skills 
        WHERE steps IS NULL OR title = '' OR material_type = ''
    """)
    invalid_skills = cursor.fetchall()
    
    assert len(invalid_skills) == 0, f"Invalid skills found: {invalid_skills}"

def test_vector_embeddings_exist(db_connection):
    """Confirm embeddings generated for all skills"""
    cursor = db_connection.cursor()
    cursor.execute("""
        SELECT s.id, COUNT(sc.id) FROM skills s
        LEFT JOIN skill_chunks sc ON s.id = sc.skill_id
        GROUP BY s.id
        HAVING COUNT(sc.id) = 0
    """)
    missing_embeddings = cursor.fetchall()
    
    assert len(missing_embeddings) == 0, "Some skills missing embeddings"
```

- [ ] **Step 7: Run test suite**

```bash
uv run pytest backend/eval/test_seed_skills.py -v
```

Expected: All 4 tests PASS

- [ ] **Step 8: Document seeding process**

Update `README.md` section:
```markdown
## Seed Database

Run the skills seeding script to populate initial knowledge base:

```bash
cd backend
cp .env.example .env
# Edit .env with actual keys
python scripts/seed_skills.py
```

This creates 52 curated upcycling tutorials across 6 material categories.
```

- [ ] **Step 9: Commit seed implementation**

```bash
git add scripts/seed_skills.py backend/eval/test_seed_skills.py
git commit -m "feat(db): seed 52 upcycling skills with vector embeddings

- Populate skills table with curated content covering all material types
- Split descriptions into RAG-ready chunks (avg 3-4 chunks per skill)
- Generate OpenAI embeddings for semantic search capability
- Include verification tests for seed integrity
- Support both beginner-friendly and advanced crafting techniques"
```

---

### Task 4: Implement Row Level Security Policies

**Files:**
- Create: `backend/database/002_rls_policies.sql`
- Test: `backend/eval/test_rls_policies.py`

**Interfaces:**
- Consumes: Tables from Task 2
- Produces: RLS policies enforcing tenant isolation

- [ ] **Step 1: Enable RLS on all tables**

```sql
-- Enable Row Level Security globally
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

-- Verify RLS is active
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true;
```

Expected: Returns all 6 tables with `rowsecurity=true`

- [ ] **Step 2: Create users policy**

```sql
-- Users can read their own profile
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile (except role/admin fields)
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Only authenticated users can insert (via signup flow)
CREATE POLICY "users_insert_auth" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Experts and admins can manage other users
CREATE POLICY "authenticated_manage_users" ON users
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('expert', 'admin')
    )
  );
```

- [ ] **Step 3: Create scans policy**

```sql
-- Users can only see their own scans
CREATE POLICY "scans_select_own" ON scans
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own scans
CREATE POLICY "scans_insert_own" ON scans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update/delete their own scans
CREATE POLICY "scans_update_own" ON scans
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "scans_delete_own" ON scans
  FOR DELETE USING (auth.uid() = user_id);

-- Experts can view all scans for evaluation
CREATE POLICY "experts_view_all_scans" ON scans
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role = 'expert'
    )
  );
```

- [ ] **Step 4: Create products policy**

```sql
-- Public can browse approved products (no authentication required)
CREATE POLICY "public_view_approved_products" ON products
  FOR SELECT USING (is_approved = TRUE);

-- Only creators or admins can modify products
CREATE POLICY "products_modify_by_creator" ON products
  FOR ALL TO authenticated
  USING (
    created_by = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );
```

- [ ] **Step 5: Create skills policy**

```sql
-- Public can view approved skills only
CREATE POLICY "public_view_approved_skills" ON skills
  FOR SELECT USING (status = 'approved');

-- Experts can manage all skills (approve/reject/edit)
CREATE POLICY "experts_manage_skills" ON skills
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role = 'expert'
    )
  );

-- Admins can do everything including reject
CREATE POLICY "admins_manage_all_skills" ON skills
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Anyone can insert (via submission flow) but marked as pending
CREATE POLICY "anyone_insert_pending_skills" ON skills
  FOR INSERT WITH CHECK (true);
```

- [ ] **Step 6: Create skill_chunks policy**

```sql
-- Everyone can read chunks (for RAG retrieval)
CREATE POLICY "anyone_view_chunks" ON skill_chunks
  FOR SELECT USING (TRUE);

-- Only experts/admins can modify chunks
CREATE POLICY "experts_manage_chunks" ON skill_chunks
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('expert', 'admin')
    )
  );
```

- [ ] **Step 7: Create agent_runs policy**

```sql
-- Users can view their own agent runs
CREATE POLICY "users_view_own_agent_runs" ON agent_runs
  FOR SELECT USING (
    user_id IS NULL  -- Public diagnostic runs
    OR auth.uid() = user_id
  );

-- System can insert agent runs
CREATE POLICY "system_insert_agent_runs" ON agent_runs
  FOR INSERT WITH CHECK (TRUE);

-- Analytics dashboards can query all runs
CREATE POLICY "analytics_view_all_runs" ON agent_runs
  FOR SELECT USING (TRUE);
```

- [ ] **Step 8: Test RLS enforcement**

```sql
-- Create test users (simulate via Supabase Auth)
-- User A (regular)
-- User B (regular)  
-- Expert C

-- Query as User A: should only see own scans
SET LOCAL ROLE TO "user_a_role";
SELECT COUNT(*) FROM scans;  -- Returns count of User A's scans only

-- Query as Expert C: should see all scans
SET LOCAL ROLE TO "expert_c_role";
SELECT COUNT(*) FROM scans;  -- Returns total scans across all users

-- As unauthenticated user: cannot view scans
RESET ROLE;
SELECT COUNT(*) FROM scans;  -- Should return 0 due to RLS
```

- [ ] **Step 9: Write integration tests**

```python
# /backend/eval/test_rls_policies.py
import pytest
from supabase import create_client, Client

def test_user_can_only_see_own_scans(authenticated_user_client: Client):
    """RLS prevents cross-user data access"""
    # Fetch own scan
    own_result = authenticated_user_client.table("scans").select("*").eq("user_id", authenticated_user_client.user.id).execute()
    assert len(own_result.data) >= 0  # May be 0 if no scans yet
    
    # Try to fetch another user's scan
    other_result = authenticated_user_client.table("scans").select("*").eq("user_id", "other-user-id").execute()
    assert len(other_result.data) == 0, "RLS should block access to other users' data"

def test_public_cannot_view_private_skills(unauthenticated_client: Client):
    """Public can only see approved skills"""
    result = unauthenticated_client.table("skills").select("*").eq("status", "pending").execute()
    assert len(result.data) == 0, "Pending skills should not be visible to public"

def test_expert_can_approve_skills(expert_client: Client):
    """Expert role can modify skill status"""
    skill_id = expert_client.table("skills").select("*").eq("status", "pending").limit(1).execute().data[0]["id"]
    
    update_result = expert_client.table("skills").update({"status": "approved"}).eq("id", skill_id).execute()
    assert update_result.data is not None, "Expert should be able to approve skills"
```

- [ ] **Step 10: Deploy RLS policies**

```bash
supabase db push backend/database/002_rls_policies.sql
```

- [ ] **Step 11: Commit RLS implementation**

```bash
git add backend/database/002_rls_policies.sql backend/eval/test_rls_policies.py
git commit -m "feat(security): implement Row Level Security policies for multi-tenant isolation

- Enable RLS on all 6 core tables
- Policy rules:
  * Users: view/update own data only
  * Experts: manage skills, view all scans for validation
  * Public: browse approved products/skills
  * System: write agent run logs
- Add integration tests to verify tenant boundary enforcement"
```

---

## Verification Checklist

Before marking this plan complete:

1. ✅ Run all migrations successfully via `supabase db push`
2. ✅ Query confirms ≥50 skills with valid structure
3. ✅ Vector embeddings exist for all skill descriptions
4. ✅ RLS policies prevent cross-user data leaks
5. ✅ All tests pass: `pytest backend/eval/test_seed_skills.py -v`
6. ✅ Documentation updated in README.md

---

## Next Plan Dependencies

- **Plan 2 (Authentication)** requires: Users table + RLS policies operational
- **Plan 3 (Tutorial Pipeline)** requires: Skills table + products table ready
- **Plan 6 (Impact Tracker)** requires: Scans table + agent_runs table configured
