# myBookClub Context

## Repo Layout

- UI: [my-book-club-ui](/Users/jushita/git/myBookClub/my-book-club-ui)
- API: [my-book-club-api](/Users/jushita/git/myBookClub/my-book-club-api)

## Current UI State

- Expo React Native app with bottom nav: `Home`, `Clubs`, `Search`, `Library`, `Profile`
- Liquid-glass purple/orange/white theme
- `App.tsx` is thin; app composition lives in [useBookClubApp.ts](/Users/jushita/git/myBookClub/my-book-club-ui/hooks/useBookClubApp.ts)
- State is split into hooks:
  - [useAuthFlow.ts](/Users/jushita/git/myBookClub/my-book-club-ui/hooks/useAuthFlow.ts)
  - [useClubState.ts](/Users/jushita/git/myBookClub/my-book-club-ui/hooks/useClubState.ts)
  - [useBookLibrary.ts](/Users/jushita/git/myBookClub/my-book-club-ui/hooks/useBookLibrary.ts)
  - [useSearchCatalog.ts](/Users/jushita/git/myBookClub/my-book-club-ui/hooks/useSearchCatalog.ts)
  - [usePickNext.ts](/Users/jushita/git/myBookClub/my-book-club-ui/hooks/usePickNext.ts)
- Screen components:
  - [HomeScreen.tsx](/Users/jushita/git/myBookClub/my-book-club-ui/components/screens/HomeScreen.tsx)
  - [ClubsScreen.tsx](/Users/jushita/git/myBookClub/my-book-club-ui/components/screens/ClubsScreen.tsx)
  - [SearchScreen.tsx](/Users/jushita/git/myBookClub/my-book-club-ui/components/screens/SearchScreen.tsx)
  - [LibraryScreen.tsx](/Users/jushita/git/myBookClub/my-book-club-ui/components/screens/LibraryScreen.tsx)
  - [ProfileScreen.tsx](/Users/jushita/git/myBookClub/my-book-club-ui/components/screens/ProfileScreen.tsx)
  - [PickNextScreen.tsx](/Users/jushita/git/myBookClub/my-book-club-ui/components/screens/PickNextScreen.tsx)
- Navigation wrapper:
  - [AppNavigator.tsx](/Users/jushita/git/myBookClub/my-book-club-ui/components/navigation/AppNavigator.tsx)
- Header:
  - [AppHeader.tsx](/Users/jushita/git/myBookClub/my-book-club-ui/components/layout/AppHeader.tsx)
- Shared screen prop contracts:
  - [screenModels.ts](/Users/jushita/git/myBookClub/my-book-club-ui/types/screenModels.ts)

## Current UI Behavior

- Guest users can browse Home/Search/Library
- Signed-in users use real API-backed clubs and club libraries
- Search save star persists books into the active club
- Clubs tab now defaults to active club overview
- `Create a club` and `Join a club` are buttons that open dedicated subviews inside Clubs
- Join flow:
  - search club name
  - select join target
  - preview current members
  - join club
- Create flow:
  - name
  - description
  - vibe
  - create club
- Wheel/randomizer/AI pick UI exists in Pick Next screen

## Current UI API Integration

- Auth:
  - [services/auth.ts](/Users/jushita/git/myBookClub/my-book-club-ui/services/auth.ts)
- HTTP base:
  - [services/http.ts](/Users/jushita/git/myBookClub/my-book-club-ui/services/http.ts)
- Books:
  - [services/api.ts](/Users/jushita/git/myBookClub/my-book-club-ui/services/api.ts)
- Clubs:
  - [services/clubs.ts](/Users/jushita/git/myBookClub/my-book-club-ui/services/clubs.ts)

## Important UI Caveats

- Guest flow still uses mock guest books/recommendations from [mockData.ts](/Users/jushita/git/myBookClub/my-book-club-ui/data/mockData.ts)
- Signed-in clubs flow no longer uses `MOCK_CLUBS` / `MOCK_USERS`
- UI typecheck passed last

## Current API State

- Converted to TypeScript
- Entry points:
  - [server.ts](/Users/jushita/git/myBookClub/my-book-club-api/src/server.ts)
  - [app.ts](/Users/jushita/git/myBookClub/my-book-club-api/src/app.ts)
- Auto-loads `.env` via:
  - [env.ts](/Users/jushita/git/myBookClub/my-book-club-api/src/config/env.ts)
- Postgres schema in:
  - [schema.sql](/Users/jushita/git/myBookClub/my-book-club-api/src/db/schema.sql)
- Domain entities:
  - [User.ts](/Users/jushita/git/myBookClub/my-book-club-api/src/domain/entities/User.ts)
  - [Club.ts](/Users/jushita/git/myBookClub/my-book-club-api/src/domain/entities/Club.ts)
  - [ClubMember.ts](/Users/jushita/git/myBookClub/my-book-club-api/src/domain/entities/ClubMember.ts)
  - [Book.ts](/Users/jushita/git/myBookClub/my-book-club-api/src/domain/entities/Book.ts)
  - [ClubBook.ts](/Users/jushita/git/myBookClub/my-book-club-api/src/domain/entities/ClubBook.ts)

## API Tables

- `users`
- `clubs`
- `club_members`
- `books`
- `club_books`

## Repositories

- [users.ts](/Users/jushita/git/myBookClub/my-book-club-api/src/repositories/users.ts)
- [clubs.ts](/Users/jushita/git/myBookClub/my-book-club-api/src/repositories/clubs.ts)
- [clubMembers.ts](/Users/jushita/git/myBookClub/my-book-club-api/src/repositories/clubMembers.ts)
- [books.ts](/Users/jushita/git/myBookClub/my-book-club-api/src/repositories/books.ts)
- [clubBooks.ts](/Users/jushita/git/myBookClub/my-book-club-api/src/repositories/clubBooks.ts)

## API Routes

### Auth

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/social`

### Books

- `GET /api/books`
- `GET /api/books/:id`
- `POST /api/books`

### Clubs

- `GET /api/clubs`
- `POST /api/clubs`
- `GET /api/clubs/:clubId`
- `PATCH /api/clubs/:clubId`
- `DELETE /api/clubs/:clubId`
- `GET /api/clubs/:clubId/members`
- `POST /api/clubs/:clubId/members`
- `GET /api/clubs/:clubId/members/:userId`
- `PATCH /api/clubs/:clubId/members/:userId`
- `DELETE /api/clubs/:clubId/members/:userId`
- `GET /api/clubs/:clubId/books`
- `POST /api/clubs/:clubId/books`
- `GET /api/clubs/:clubId/users/:userId/books/:bookId`
- `PATCH /api/clubs/:clubId/users/:userId/books/:bookId`
- `DELETE /api/clubs/:clubId/users/:userId/books/:bookId`

## Important Backend Improvement

- `GET /api/clubs/:clubId/members` returns membership plus joined `user` info, which the UI uses for member names

## DB Scripts

- `npm run db:init`
- `npm run db:seed`
- `npm run db:psql`
- `npm run dev`

## Seed Data

- Implemented in:
  - [seedData.ts](/Users/jushita/git/myBookClub/my-book-club-api/src/data/seedData.ts)
  - [seedDb.ts](/Users/jushita/git/myBookClub/my-book-club-api/src/scripts/seedDb.ts)
- Seeded users include:
  - `jushita@example.com / password123`
  - `maya@example.com / password123`
  - `sofia@example.com / password123`
  - one Google-seeded user too
- Seeded clubs include:
  - `Wednesday Night Readers`
  - `Horror Readers`
  - `Weekend Escape Shelf`

## Current Scripts

### UI [package.json](/Users/jushita/git/myBookClub/my-book-club-ui/package.json)

- `npm run build`
- `npm run build:ios`
- `npm run build:android`
- `npm run start:clear`

### API [package.json](/Users/jushita/git/myBookClub/my-book-club-api/package.json)

- `npm run db:init`
- `npm run db:seed`
- `npm run db:psql`
- `npm run dev`

## Important Environment Notes

### API `.env`

- `AUTH_JWT_SECRET=...`
- `DATABASE_URL=postgres://jushita@localhost:5432/mybookclub`

### UI `.env`

- `EXPO_PUBLIC_API_BASE_URL=http://localhost:4000`
- Google client IDs

## Known Current Direction / Likely Next Steps

- likely next UI work:
  - wire create/join success UX more cleanly
  - add leave club
  - maybe make create/join views feel more page-like
- likely next backend/UI integration:
  - create/join flows are now wired
  - remaining major work is deeper CRUD usage from UI and auth/session hardening

## Recent Status

- UI typecheck passed
- API typecheck passed

## Suggested New Chat Prompt

Use the existing myBookClub repo context. UI is API-backed for clubs and club libraries, Clubs tab has overview/create/join modes, backend is TS with Postgres tables/users/clubs/club_members/books/club_books and full CRUD for clubs/members/club_books. Continue from there.
