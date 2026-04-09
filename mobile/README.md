# FlockTrax Mobile

Initial Expo scaffold for the FlockTrax replacement UI.

## Current screens

- Login via `auth-login`
- Placements dashboard via `dashboard-placements-list`
- Placement day editor via `placement-day-get` and `placement-day-submit`

## Setup

1. Copy `.env.example` to `.env`
2. Fill in `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. Install dependencies with `npm install`
4. Start the app with `npm run start`

Default API base URL points at the hosted Supabase functions project:

- `https://frneaccbbrijpolcesjm.supabase.co/functions/v1`

## Notes

- Session state is stored locally with AsyncStorage.
- This scaffold intentionally avoids Adalo-specific adapters and reads the cleaner function responses.
- Refresh token handling and offline drafts are not implemented yet.
