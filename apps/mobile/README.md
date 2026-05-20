# Mobile App - Expo React Native UI

User-facing app experience: UI, navigation, screens, state management, and API integration.

## Project Structure

```
apps/mobile/
├── src/
│   ├── components/     # Reusable React components
│   ├── screens/        # Screen components (navigation targets)
│   ├── services/       # API calls, Supabase client setup
│   ├── i18n/          # Internationalization
│   └── assets/        # Images used in components
├── utils/             # Utility functions (Supabase client)
├── assets/            # App assets (icons, images)
├── App.tsx            # Root component
├── index.ts           # Entry point
├── app.json           # Expo configuration
├── package.json       # Dependencies
└── tsconfig.json      # TypeScript config
```

## Setup

From `apps/mobile/`:

```bash
npm install
npm start          # Start Expo development server
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
npm run web        # Run on web
```

## API Communication

The app communicates with FastAPI backend. Example:

```typescript
// Get user JWT token from Supabase Auth
const { data: { user } } = await supabase.auth.getUser();
const token = session?.access_token;

// Call FastAPI backend
const response = await fetch('http://localhost:8000/api/recommendations', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({ limit: 5 }),
});

const recommendations = await response.json();
```
