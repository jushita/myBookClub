# myBookClub

Expo-based React Native mobile app scaffold for an AI-assisted book club.

The UI project now lives in `my-book-club-ui/`.
The backend API project now lives in `my-book-club-api/`.

## What is included

- Mobile-first UI for a book club home screen
- Favorite books list backed by the local Express API
- Email/password auth backed by the local Express API
- Google OAuth wired for native Expo builds
- AI recommendations screen driven by mocked data
- Minimal Expo/TypeScript setup with no navigation dependency

## Start the app

### One-time setup

1. Configure the API env in `my-book-club-api/.env`
2. Configure the UI env in `my-book-club-ui/.env`
3. Install API dependencies:
   `cd my-book-club-api && npm install`
4. Install UI dependencies:
   `cd my-book-club-ui && npm install`
5. Initialize the database:
   `cd my-book-club-api && npm run db:init`

### Development startup

1. Start the API:
   `cd my-book-club-api && set -a && source .env && set +a && npm run dev`
2. Start Metro in a second terminal:
   `cd my-book-club-ui && npm run start -- --clear`
3. Open the installed `myBookClub` app in the iOS simulator

### Google auth development flow

Google sign-in will not work correctly in Expo Go for this project. Use a native development build.

1. Install the iOS development build into the simulator:
   `cd my-book-club-ui && npx expo run:ios`
2. After the app is installed, start Metro:
   `cd my-book-club-ui && npm run start -- --clear`
3. Open the `myBookClub` app in the simulator, not Expo Go

### Notes

- If you run the app on a physical device, set `EXPO_PUBLIC_API_BASE_URL=http://YOUR_MAC_IP:4000`
- Google auth expects iOS, Android, and web client IDs in `my-book-club-ui/.env`
- The API currently needs env vars loaded in-shell before `npm run dev`

## Project structure

- `my-book-club-ui/App.tsx` contains the mobile app shell and screen switching
- `my-book-club-ui/components/BookCard.tsx` renders saved books and recommendations
- `my-book-club-ui/data/mockData.ts` contains starter members, books, and recommendation data
- `my-book-club-ui/types.ts` holds shared TypeScript types

## Next steps

- Persist auth sessions and users in a database
- Swap the local screen switcher for Expo Router or React Navigation when flows grow
