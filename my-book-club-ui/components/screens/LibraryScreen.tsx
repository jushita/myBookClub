import React from "react";
import { Text, View } from "react-native";
import { appStyles } from "../../styles/appStyles";
import type { LibraryScreenActions, LibraryScreenModel } from "../../types/screenModels";
import { BookCard } from "../BookCard";
import { GuestAccessCard } from "../common/GuestAccessCard";

type LibraryScreenProps = {
  model: LibraryScreenModel;
  actions: LibraryScreenActions;
};

export function LibraryScreen({ model, actions }: LibraryScreenProps) {
  return (
    <View style={appStyles.stack}>
      {model.authUser ? (
        <>
          <Text style={appStyles.screenHeading}>Favorite books from the group</Text>
          {model.booksLoading ? <Text style={appStyles.bodyText}>Loading books from API...</Text> : null}
          {model.booksError ? <Text style={appStyles.errorText}>{model.booksError}</Text> : null}
          {!model.booksLoading && model.favoriteBooks.length === 0 ? (
            <Text style={appStyles.bodyText}>No books returned by the API yet.</Text>
          ) : null}
          {model.favoriteBooks.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </>
      ) : (
        <>
          <GuestAccessCard
            sectionTitle="Guest library"
            title="Browse top picks"
            description="Explore a starter shelf now, then sign in to save books and build your own library."
            onSignIn={actions.onSignIn}
            onSignUp={actions.onSignUp}
          />
          <Text style={appStyles.screenHeading}>Top charted reads</Text>
          <Text style={appStyles.bodyText}>
            A few strong picks to explore before you start saving books to your own shelf.
          </Text>
          {model.guestLibraryBooks.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </>
      )}
    </View>
  );
}
