import React from "react";
import { Text, View } from "react-native";
import type { AuthUser, Book } from "../../types";
import { appStyles } from "../../styles/appStyles";
import { BookCard } from "../BookCard";
import { GuestAccessCard } from "../common/GuestAccessCard";

type LibraryScreenProps = {
  authUser: AuthUser | null;
  booksLoading: boolean;
  booksError: string | null;
  favoriteBooks: Book[];
  guestLibraryBooks: Book[];
  onSignIn: () => void;
  onSignUp: () => void;
};

export function LibraryScreen({
  authUser,
  booksLoading,
  booksError,
  favoriteBooks,
  guestLibraryBooks,
  onSignIn,
  onSignUp,
}: LibraryScreenProps) {
  return (
    <View style={appStyles.stack}>
      {authUser ? (
        <>
          <Text style={appStyles.screenHeading}>Favorite books from the group</Text>
          {booksLoading ? <Text style={appStyles.bodyText}>Loading books from API...</Text> : null}
          {booksError ? <Text style={appStyles.errorText}>{booksError}</Text> : null}
          {!booksLoading && favoriteBooks.length === 0 ? (
            <Text style={appStyles.bodyText}>No books returned by the API yet.</Text>
          ) : null}
          {favoriteBooks.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </>
      ) : (
        <>
          <GuestAccessCard
            sectionTitle="Guest library"
            title="Browse top picks"
            description="Explore a starter shelf now, then sign in to save books and build your own library."
            onSignIn={onSignIn}
            onSignUp={onSignUp}
          />
          <Text style={appStyles.screenHeading}>Top charted reads</Text>
          <Text style={appStyles.bodyText}>
            A few strong picks to explore before you start saving books to your own shelf.
          </Text>
          {guestLibraryBooks.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </>
      )}
    </View>
  );
}
