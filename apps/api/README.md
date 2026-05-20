# FastAPI Backend - Smoothie Recommendation Engine

## Project Structure

```
apps/api/
├── main.py              # FastAPI app entry point
├── requirements.txt     # Python dependencies
├── .env.example        # Environment variables template
├── .gitignore          # Git ignore rules
└── app/
    ├── config.py       # Settings from environment
    ├── middleware/
    │   └── auth.py     # JWT verification middleware
    ├── routes/
    │   └── recommendations.py  # Recommendation endpoints
    ├── schemas/
    │   └── recommendations.py  # Pydantic models
    ├── services/
    │   └── recommendations.py  # Recommendation logic (TODO)
    └── utils/
        └── supabase.py # Supabase client utilities
```

## Setup

1. **Install dependencies:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Fill in your Supabase credentials in `.env`

3. **Run the server:**
   ```bash
   python main.py
   # or
   uvicorn main:app --reload
   ```

Server runs on `http://localhost:8000`

## API Endpoints

### GET /health
Health check endpoint (no auth required)

### POST /api/recommendations
Get plant food recommendations for authenticated user.

**Request Headers:**
```
Authorization: Bearer <user_jwt_token_from_supabase>
```

**Request Body:**
```json
{
  "limit": 5
}
```

**Response:**
```json
{
  "user_id": "user-123",
  "recommendations": []
}
```

## Security

- **JWT Verification:** All endpoints (except `/health`) require a valid Supabase JWT token
- **Service Role Key:** Only stored in backend `.env`, never exposed to frontend
- **User Context:** User ID extracted from JWT payload and attached to request

## Next Steps

1. Implement recommendation logic in `app/services/recommendations.py`
2. Query Supabase for user data (consumed foods, allergies, etc.)
3. Query recommendation cache table
4. Return cached or newly generated recommendations
