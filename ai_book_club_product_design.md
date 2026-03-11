
# AI Book Club Mobile App
Product Design Document

## 1. Overview
The AI Book Club app is a mobile-only application that helps book clubs discover their next book based on the combined reading preferences of group members.

Users can:
- Join a book club group
- Add books they enjoyed
- Describe what kind of book they want next
- Receive AI-assisted recommendations

The system uses:
- Embeddings + vector similarity search for recommendations
- LLM reasoning for query interpretation and explanations

The goal is to provide smart, collaborative recommendations for book clubs.

---

## 2. Goals

### Primary Goals
1. Help book clubs quickly choose their next book.
2. Combine preferences of multiple users.
3. Provide intelligent recommendations using embeddings.
4. Allow natural language requests like “romance with thriller elements for Valentine’s Day”.

### Secondary Goals
1. Generate book club discussion questions.
2. Generate explanations for recommendations.
3. Provide a “book club personality” summary.

---

## 3. Non-Goals (MVP)

Not included in MVP:
- Publishing books
- Author features
- Social feeds
- Book purchasing integration
- Notifications
- Offline mode

---

## 4. System Architecture

Mobile App (React Native / Expo)
        |
Backend API (Node.js Express)
        |
PostgreSQL + pgvector
        |
Embedding Model + LLM API

---

## 5. Core Features

### 5.1 User Accounts
Users can:
- Create account
- Join book club
- Add books they like

Example:

{
  "id": "uuid",
  "name": "string",
  "email": "string"
}

### 5.2 Book Club Groups
Users belong to a shared group.

{
  "id": "uuid",
  "name": "string"
}

### 5.3 Add Favorite Books
Users add books they enjoyed. Book data fetched from OpenLibrary API.

Stored fields:
- title
- author
- description
- genres
- embedding

### 5.4 Group Taste Profile

group_vector = average(book_vectors)

### 5.5 Natural Language Requests
Users can enter prompts like:
- romance thriller for Valentine’s Day
- cozy spooky book for October
- fast vacation read

LLM converts this into structured query.

Example:

{
 "genres": ["romance", "thriller"],
 "tone": "suspenseful",
 "theme": "relationships"
}

### 5.6 Recommendation Engine

Steps:
1. Build group vector
2. Build query embedding

final_vector =
0.7 * group_vector
+
0.3 * query_vector

3. Run vector similarity search
4. Retrieve top books

### 5.7 Diversified Ranking

Maximal Marginal Relevance (MMR)

score =
similarity_to_group
-
0.5 * similarity_to_selected_books

### 5.8 AI Explanation

Example prompt:

Explain why these books are good recommendations for readers who liked Gone Girl, Silent Patient, and Sharp Objects.

### 5.9 Discussion Questions

LLM generates 5 discussion questions for each book.

---

## 6. API Design

POST /books/add

{
 "title": "Gone Girl"
}

GET /recommendations

{
 "books":[
  {
   "title":"Rebecca",
   "author":"Daphne du Maurier"
  }
 ]
}

POST /query

{
 "query":"romantic thriller for valentines day"
}

---

## 7. Database Schema

Users
id
name
email

Groups
id
name

Books
id
title
author
description
embedding

UserBooks
user_id
book_id

---

## 8. Frontend Architecture

Framework: React Native (Expo)

File Structure

mobile-app/
├── App.js
├── screens/
│   ├── LoginScreen.js
│   ├── AddBookScreen.js
│   ├── RecommendationsScreen.js
├── components/
│   ├── BookCard.js
│   ├── SearchBar.js
├── services/
│   ├── api.js
└── utils/
    ├── embeddings.js

---

## 9. Backend Architecture

Framework: Node.js + Express

File Structure

backend/
├── server.js
├── routes/
│   ├── books.js
│   ├── recommendations.js
├── services/
│   ├── embeddingService.js
│   ├── recommendationService.js
│   ├── llmService.js
├── db/
│   ├── connection.js
└── utils/
    ├── similarity.js

---

## 10. Deployment (Free)

Mobile App:
Expo

Backend:
Render free tier

Database:
Supabase free tier (PostgreSQL)

---

## 11. Non Functional Requirements

Performance:
Recommendation latency < 2 seconds

Scalability:
10k users
100k books

Reliability:
Target uptime 99%

Security:
HTTPS
password hashing
API authentication

---

## 12. Future Improvements

- book club voting
- calendar scheduling
- reading progress tracking
- push notifications
- personalized user recommendations

---

## 13. Risks

LLM cost → minimize usage
duplicate books → canonical IDs
cold start → preload dataset

---

## 14. Success Metrics

- book clubs created
- recommendation click rate
- books added per user
- weekly active users

---

## 15. MVP Timeline

Estimated development time: 1–2 weeks

| Phase | Time |
|------|------|
Frontend skeleton | 1 day |
Backend API | 2 days |
Embeddings + vector search | 2 days |
Recommendation engine | 2 days |
LLM integration | 1 day |
Testing | 1 day |
