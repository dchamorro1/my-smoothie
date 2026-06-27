# My Smoothie - Monorepo

Plant food recommendation engine to increase dietary variety and gut health.

## Architecture

```
my-smoothie/
├── apps/
│   ├── mobile/          # Expo React Native UI
│   │   ├── src/
│   │   ├── package.json
│   │   └── README.md
│   │
│   └── api/             # FastAPI Python backend
│       ├── app/
│       ├── requirements.txt
│       └── README.md
│
├── .git/
├── .gitignore
└── README.md (this file)
```

## Apps

### Mobile (`apps/mobile`)
- **Tech**: Expo, React Native, TypeScript
- **Responsibility**: User interface, navigation, screens
- **Setup**: `cd apps/mobile && npm install && npm start`
- **API**: Sends user JWT token to FastAPI backend

### API (`apps/api`)
- **Tech**: FastAPI, Python
- **Responsibility**: Recommendation logic, Supabase queries
- **Setup**: `cd apps/api && pip install -r requirements.txt && python main.py`
- **Security**: Verifies JWT tokens, manages Supabase credentials

## Development

### Start Mobile App
```bash
cd apps/mobile
npm start
```

### Start FastAPI Backend

**Option 1 — VS Code Run & Debug (recommended):**
1. Open the Run & Debug panel (`Cmd+Shift+D`)
2. Select **"Python: Uvicorn (apps/api)"** from the dropdown
3. Press the green play button (or `F5`)

The backend will start on `http://localhost:8000` with hot reload enabled.

**Option 2 — Terminal:**
```bash
cd apps/api
source ../../.venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Both the mobile app and backend should run simultaneously for local development.

## Communication Flow

1. User interacts with Expo app
2. App sends request to FastAPI with Supabase JWT token
3. FastAPI verifies JWT, queries Supabase
4. FastAPI returns recommendations to app
5. App displays recommendations to user

<img width="1320" height="2868" alt="image" src="https://github.com/user-attachments/assets/bfcec9e7-417f-499c-a4fa-d14457539d94" />
<img width="1320" height="2868" alt="image" src="https://github.com/user-attachments/assets/96c019f9-11c6-4669-9435-06fe72aadb5d" />
<img width="1320" height="2868" alt="image" src="https://github.com/user-attachments/assets/ceba4dfa-5618-45e2-b7d2-6b09e1995a90" />
<img width="1320" height="2868" alt="image" src="https://github.com/user-attachments/assets/cb0010f7-3bd0-4012-871b-998a53de16bd" />



