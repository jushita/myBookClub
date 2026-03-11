# myBookClub

Expo-based React Native mobile app scaffold for an AI-assisted book club.

The UI project now lives in `my-book-club-ui/`.
The backend API project now lives in `my-book-club-api/`.

## What is included

- Mobile-first UI for a book club home screen
- Favorite books list backed by the local Express API
- AI recommendations screen driven by mocked data
- Minimal Expo/TypeScript setup with no navigation dependency

## Run locally

1. Start the API:
   `cd my-book-club-api && npm install && npm run dev`
2. Start the UI in a separate terminal:
   `cd my-book-club-ui && npm install && npm run start`
3. Open it in Expo Go, iOS Simulator, or Android Emulator
4. If you run the app on a physical device, set `EXPO_PUBLIC_API_BASE_URL=http://YOUR_MAC_IP:4000`

## Project structure

- `my-book-club-ui/App.tsx` contains the mobile app shell and screen switching
- `my-book-club-ui/components/BookCard.tsx` renders saved books and recommendations
- `my-book-club-ui/data/mockData.ts` contains starter members, books, and recommendation data
- `my-book-club-ui/types.ts` holds shared TypeScript types

## Next steps

- Add authentication and persistent club state
- Swap the local screen switcher for Expo Router or React Navigation when flows grow
