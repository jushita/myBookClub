# my-book-club-api

Minimal Node.js + Express API for book data.

## Run locally

```bash
cd /Users/jushita/git/myBookClub/my-book-club-api
npm install
npm run dev
```

The API starts on `http://localhost:4000`.

## Endpoints

- `GET /health`
- `GET /api/books`
- `GET /api/books?q=mystery`
- `GET /api/books/:id`
- `POST /api/books`

## Example request

```bash
curl http://localhost:4000/api/books
```
