import "../config/env.js";
import { pool } from "../db/pool.js";
import { Book, Club, ClubBook, ClubMember, User } from "../domain/entities/index.js";
import { hashPassword } from "../lib/auth.js";
import { seedBooks, seedClubBooks, seedClubMembers, seedClubs, seedUsers } from "../data/seedData.js";

async function seedUsersTable(): Promise<void> {
  for (const user of seedUsers) {
    const entity = new User({
      id: user.id,
      name: user.name,
      email: user.email,
      provider: user.provider,
      providerUserId: user.providerUserId ?? null,
      passwordHash: user.password ? await hashPassword(user.password) : null,
    });
    const row = entity.toDatabase();

    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, provider, provider_user_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [row.id, row.name, row.email, row.password_hash, row.provider, row.provider_user_id, row.created_at]
    );
  }
}

async function seedClubsTable(): Promise<void> {
  for (const club of seedClubs) {
    const entity = new Club(club);
    const row = entity.toDatabase();

    await pool.query(
      `INSERT INTO clubs (id, name, description, vibe, created_by_user_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [row.id, row.name, row.description, row.vibe, row.created_by_user_id, row.created_at]
    );
  }
}

async function seedClubMembersTable(): Promise<void> {
  for (const membership of seedClubMembers) {
    const entity = new ClubMember(membership);
    const row = entity.toDatabase();

    await pool.query(
      `INSERT INTO club_members (id, club_id, user_id, role, joined_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [row.id, row.club_id, row.user_id, row.role, row.joined_at]
    );
  }
}

async function seedBooksTable(): Promise<void> {
  for (const book of seedBooks) {
    const entity = new Book(book);
    const row = entity.toDatabase();

    await pool.query(
      `INSERT INTO books (
         id, title, author, genre, description, synopsis, isbn_13, cover_image_url, embedding, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        row.id,
        row.title,
        row.author,
        row.genre,
        row.description,
        row.synopsis,
        row.isbn_13,
        row.cover_image_url,
        row.embedding,
        row.created_at,
      ]
    );
  }
}

async function seedClubBooksTable(): Promise<void> {
  for (const clubBook of seedClubBooks) {
    const entity = new ClubBook(clubBook);
    const row = entity.toDatabase();

    await pool.query(
      `INSERT INTO club_books (id, club_id, user_id, book_id, status, notes, rating, is_current_read, added_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        row.id,
        row.club_id,
        row.user_id,
        row.book_id,
        row.status,
        row.notes,
        row.rating,
        row.is_current_read,
        row.added_at,
      ]
    );
  }
}

async function resetTables(): Promise<void> {
  await pool.query("TRUNCATE TABLE club_books, club_members, books, clubs, users RESTART IDENTITY CASCADE");
}

try {
  await resetTables();
  await seedUsersTable();
  await seedClubsTable();
  await seedClubMembersTable();
  await seedBooksTable();
  await seedClubBooksTable();
  console.log("Database mock data seeded.");
} finally {
  await pool.end();
}
