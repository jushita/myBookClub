import test from "node:test";
import assert from "node:assert/strict";
import { Club } from "./Club.js";
import { ClubBook } from "./ClubBook.js";
import { User } from "./User.js";

test("User normalizes email and trims name", () => {
  const user = new User({
    id: "u1",
    name: "  Jushita  ",
    email: "  JuShita@Example.com ",
  });

  assert.equal(user.name, "Jushita");
  assert.equal(user.email, "jushita@example.com");
});

test("User rejects invalid provider", () => {
  assert.throws(
    () =>
      new User({
        id: "u2",
        name: "Name",
        email: "name@example.com",
        provider: "github" as never,
      }),
    /Unsupported user provider/
  );
});

test("Club requires a creator id", () => {
  assert.throws(
    () =>
      new Club({
        id: "c1",
        name: "Late Night Readers",
        createdByUserId: "",
      }),
    /Club creator is required/
  );
});

test("ClubBook enforces rating range and status validity", () => {
  assert.throws(
    () =>
      new ClubBook({
        id: "cb1",
        clubId: "club",
        userId: "user",
        bookId: "book",
        rating: 9,
      }),
    /between 0 and 5/
  );

  assert.throws(
    () =>
      new ClubBook({
        id: "cb2",
        clubId: "club",
        userId: "user",
        bookId: "book",
        status: "paused" as never,
      }),
    /Unsupported club book status/
  );
});

test("ClubBook.fromDatabase maps snake_case fields", () => {
  const clubBook = ClubBook.fromDatabase({
    id: "cb3",
    club_id: "club-1",
    user_id: "user-1",
    book_id: "book-1",
    status: "current",
    is_current_read: true,
    notes: "  club pick ",
    added_at: "2026-03-19T00:00:00.000Z",
  });

  assert.equal(clubBook.clubId, "club-1");
  assert.equal(clubBook.userId, "user-1");
  assert.equal(clubBook.bookId, "book-1");
  assert.equal(clubBook.status, "current");
  assert.equal(clubBook.isCurrentRead, true);
  assert.equal(clubBook.notes, "club pick");
});
