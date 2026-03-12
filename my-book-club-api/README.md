# my-book-club-api

Minimal Node.js + Express API for book data.

Includes:

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/social`
- `GET /api/books`
- `POST /api/books`

## Run locally

```bash
cd /Users/jushita/git/myBookClub/my-book-club-api
npm install
npm run db:init
npm run dev
```

The API starts on `http://localhost:4000`.

Copy `.env.example` to `.env` and set:

- `AUTH_JWT_SECRET`
- `DATABASE_URL`

Example local Postgres URL:

```bash
postgres://postgres:postgres@localhost:5432/mybookclub
```

## Endpoints

- `GET /health`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/social`
- `GET /api/books`
- `GET /api/books?q=mystery`
- `GET /api/books/:id`
- `POST /api/books`

## Example request

```bash
curl http://localhost:4000/api/books
```
