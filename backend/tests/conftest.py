import os

for key, value in {
    "OPENROUTER_API_KEY": "test",
    "DEEPINFRA_API_KEY": "test",
    "SUPABASE_URL": "http://localhost:54321",
    "SUPABASE_SERVICE_KEY": "test-service-key",
    "SUPABASE_JWT_SECRET": "test-jwt-secret-for-testing-only",
}.items():
    os.environ.setdefault(key, value)
