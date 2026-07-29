# WASTEX Database Deployment Guide

## Overview
This guide walks you through setting up and deploying the Supabase database infrastructure for WASTEX.

---

## Prerequisites

1. **Supabase Account**: [Sign up at supabase.com](https://supabase.com/dashboard)
2. **Node.js** (optional, for Supabase CLI)
3. **Python 3.10+** (for seeding scripts)
4. **psql** client (optional, for direct SQL execution)

---

## Step 1: Create Supabase Project

1. Visit https://supabase.com/dashboard
2. Click "New Project"
3. Enter project details:
   - **Name**: `wastex-gemastik`
   - **Region**: `ap-southeast-1` (Singapore) ← Important for Indonesia latency
   - **Password**: Generate strong password and save it securely
   - **Database Version**: Latest PostgreSQL

4. Wait for project provisioning (~2 minutes)

---

## Step 2: Retrieve API Keys

Navigate to your project settings:

### Access Service Role Key
1. Go to **Settings** → **API**
2. Find **"Project API keys"** section
3. Copy:
   - **Service Role Key**: `eyJhbGci...` (long string)
   - **anon/public key**: Another `eyJhbGci...` string

### Save in .env file
```bash
cd /home/vascosera/document/github/gemastik/WASTEX_Gemastik
nano backend/database/.env
```

Update with:
```bash
SUPABASE_URL=https://xxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
SUPABASE_ANON_KEY=your-anon-key-here
OPENAI_API_KEY=sk-your-openai-key-here  # For embeddings generation
```

⚠️ **CRITICAL**: Never commit `.env` file with real credentials to git!

---

## Step 3: Install Dependencies

### Option A: Using pip (recommended for Python scripts)
```bash
pip install psycopg2-binary python-dotenv openai
```

### Option B: Using npm (if using Supabase CLI)
```bash
npm install -g supabase
```

Verify installation:
```bash
psycopg2 --version  # Should show installed version
```

---

## Step 4: Run Migration Scripts

### Method 1: Using psql directly
```bash
# Connect to your database
psql "postgresql://postgres:YOUR_PASSWORD@db.xxxxxx.supabase.co:5432/postgres" \
  -f backend/database/000_initial_schema.sql

psql "postgresql://postgres:YOUR_PASSWORD@db.xxxxxx.supabase.co:5432/postgres" \
  -f backend/database/002_rls_policies.sql
```

### Method 2: Using Supabase CLI (if installed)
```bash
# Link to your project
supabase login
supabase link --project-ref wastex-gemastik

# Apply migrations
supabase db push
```

### Method 3: Using Python script
```bash
cd /home/vascosera/document/github/gemastik/WASTEX_Gemastik
python scripts/setup_supabase.py
```

---

## Step 5: Verify Setup

Run this query in Supabase SQL Editor or via psql:

```sql
-- Check if all tables were created
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

Expected output:
```
agent_runs | skill_chunks | scans
users      | products     | skills
```

---

## Step 6: Seed Knowledge Base (Optional)

To populate 50+ upcycling skills:

```bash
cd scripts
python seed_skills.py
```

This will insert sample skills into the database. You can expand this script with more content from sources.yaml mentioned in your design spec.

---

## Troubleshooting

### Error: "Connection refused"
- Ensure your IP is whitelisted in Supabase dashboard (Settings → Database → Connection Mode)
- Try "Allow all IPs" temporarily for testing

### Error: "permission denied for table users"
- RLS policies may be blocking access
- Run as service role instead of anon user
- Double-check policy definitions in `002_rls_policies.sql`

### Error: "relation already exists"
- Tables already created
- Delete old tables: `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`
- Re-run migrations

---

## Security Best Practices

1. **Never share Service Role Key** publicly
2. **Use environment variables** not hardcoded values
3. **Enable RLS** on all sensitive tables (already done)
4. **Rotate keys periodically** in Supabase dashboard
5. **Monitor access logs** via Supabase Logs tab

---

## Testing Checklist

- [ ] Can connect to database successfully
- [ ] All 6 tables exist (users, scans, products, skills, skill_chunks, agent_runs)
- [ ] Vector extension enabled (run `SELECT * FROM pg_extension WHERE extname='vector';`)
- [ ] RLS policies active (run `SELECT tablename, rowsecurity FROM pg_tables WHERE rowsecurity=true;`)
- [ ] Sample data inserted successfully (optional)

---

## Next Steps

After database setup is complete:

1. Update frontend connection string in mobile app
2. Implement authentication flow (Plan 2)
3. Build scan submission feature
4. Test vision detection integration

---

## Support

For issues, check:
- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- This repo's GitHub Issues

---

**Status**: Ready for deployment ✅  
**Last Updated**: 2026-07-29
