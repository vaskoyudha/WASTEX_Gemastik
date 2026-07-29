# WASTEX Backend API

AI-powered waste identification and image generation service for the WASTEX mobile app.

## Quick Start

### 1. Install Dependencies

```bash
cd backend
uv sync --group dev
# or
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and add your OpenRouter API key
```

**Get an OpenRouter API Key:**
1. Visit https://openrouter.ai/keys
2. Sign up / log in
3. Create new API key
4. Copy key to `.env` as `OPENROUTER_API_KEY`

### 3. Run the Server

```bash
# Development mode (with auto-reload)
uv run uvicorn app.api.scan:app --reload --port 8000

# Or directly with Python
python -m uvicorn app.api.scan:app --reload
```

Server will be available at: `http://localhost:8000`

**Mobile App Configuration:**

Set the API URL in your Expo app environment:
- For local development: `EXPO_PUBLIC_API_URL=http://localhost:8000`
- Use your computer's IP address if testing on physical device: `EXPO_PUBLIC_API_URL=http://192.168.x.x:8000`

## API Endpoints

### POST `/scan`
Scan a waste photo for material classification.

**Request:**
```bash
curl -X POST "http://localhost:8000/scan" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@path/to/waste-photo.jpg"
```

**Response:**
```json
{
  "material_type": "plastik_pet",
  "material_label": "Botol Plastik PET",
  "condition": "baik",
  "confidence": 0.96,
  "risk_level": "aman",
  "difficulty": "mudah",
  "potential_value": "sedang",
  "safety_notes": [
    "Cuci bersih sebelum dipotong",
    "Gunakan sarung tangan karet"
  ],
  "potential_uses": [
    "Pot tanaman gantung",
    "Tempat pensil"
  ]
}
```

---

## Mobile App Integration

### Enable Real API (vs Mock Data)

In `src/services/index.ts`, change:
```typescript
export const USE_MOCK = true;  // ← Change to false
```

### Set API URL

Add to your `.expo.env` or environment variables:
```bash
EXPO_PUBLIC_API_URL=http://localhost:8000
```

For production deployment:
```bash
EXPO_PUBLIC_API_URL=https://your-backend.railway.app
```

**Note on CORS:** The backend includes CORS middleware configured for Expo dev server connections (`localhost:8081`). For physical device testing, update `allow_origins` in `backend/app/api/scan.py` to include your computer's IP address.

---

## Project Structure

```
backend/
├── app/
│   ├── api/
│   │   └── scan.py              # FastAPI endpoints with CORS middleware
│   ├── agent/
│   │   └── tools/
│   │       ├── vision.py        # Vision detection tool with system prompts
│   │       └── image_gen.py     # Image generation tool with style presets
│   └── schemas/
│       ├── vision.py            # Pydantic schemas for structured output
│       └── image_generation.py  # Schemas for generated content
├── tests/                       # Unit tests directory
├── requirements.txt             # Python dependencies
└── .env                         # Environment config (create from .env.example)
```

## System Prompts

### Vision Detection Prompt

Located in `vision.py`:
- Identifies 6 Indonesian non-organic waste types
- Assesses condition, risk level, difficulty
- Provides safety notes and potential uses
- Returns structured JSON via Pydantic validation

### Image Generation Prompts

Located in `image_gen.py`:
- Tutorial illustrations: clean instructional style
- Product mockups: professional photography style
- Before/After comparisons: transformation documentation

## Troubleshooting

### "Failed to connect to backend" error in app
1. Verify backend is running: `curl http://localhost:8000/health`
2. Check `EXPO_PUBLIC_API_URL` in your app environment
3. For development on physical device, use your computer's IP: `http://192.168.x.x:8000`
4. Ensure CORS allows your IP - check `allow_origins` in `backend/app/api/scan.py`

### Image upload fails with wrong content-type
- The frontend now safely extracts file extensions from URIs
- Supports data URIs, cloud storage URLs, and query strings
- Only accepts: jpeg, jpg, png, webp formats

### API returns 503 Service Unavailable
- OpenRouter API key may be invalid or exhausted
- Check `.env` file has correct `OPENROUTER_API_KEY`
- Vision model may be rate-limited; retry after a few seconds

### Low confidence scores (< 0.70)
- Ensure good lighting in photos
- Make subject clearly visible
- Minimize background clutter
- User can manually select material type as fallback

---

## Testing (Future Work)

Unit tests should cover:
- Extension extraction edge cases (data URIs, query strings)
- Timeout handling
- Mock vs real API fallback behavior
- Backend image format validation
- Rate limiting implementation
