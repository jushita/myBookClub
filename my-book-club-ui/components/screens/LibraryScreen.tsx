import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useActionFeedback } from "../../hooks/useActionFeedback";
import { fetchBookDetails, mergeDetailedBook } from "../../services/api";
import { appStyles } from "../../styles/appStyles";
import type { LibraryScreenActions, LibraryScreenModel } from "../../types/screenModels";
import type { Book } from "../../types";
import { BookCard } from "../BookCard";
import { BookDetailsModal } from "../BookDetailsModal";
import { GuestAccessCard } from "../common/GuestAccessCard";

type LibraryScreenProps = {
  model: LibraryScreenModel;
  actions: LibraryScreenActions;
};

export function LibraryScreen({ model, actions }: LibraryScreenProps) {
  const [activeTab, setActiveTab] = useState<"want" | "finished" | "club-finished">("want");
  const { labels, runWithFeedback } = useActionFeedback();
  const currentReadingEntry = model.currentReadingEntry;
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [bookDetailsLoading, setBookDetailsLoading] = useState(false);

  const currentEntries = useMemo(() => {
    if (activeTab === "want") {
      return model.favoriteEntries;
    }

    if (activeTab === "finished") {
      return model.finishedEntries;
    }

    return model.clubFinishedEntries;
  }, [activeTab, model.clubFinishedEntries, model.favoriteEntries, model.finishedEntries]);

  const openBookDetails = (book: Book) => {
    setSelectedBook(book);
    setBookDetailsLoading(true);
    void fetchBookDetails(book.id)
      .then((details) => {
        setSelectedBook(mergeDetailedBook(book, details));
      })
      .finally(() => {
        setBookDetailsLoading(false);
      });
  };

  return (
    <View style={appStyles.stack}>
      {model.authUser ? (
        <>
          <Text style={appStyles.screenHeading}>Your club library</Text>
          {model.booksLoading ? <Text style={appStyles.bodyText}>Loading books from API...</Text> : null}
          {model.booksError ? <Text style={appStyles.errorText}>{model.booksError}</Text> : null}
          {currentReadingEntry ? (
            <View style={appStyles.stack}>
              <Text style={appStyles.sectionTitle}>Currently reading</Text>
              <BookCard
                book={currentReadingEntry.book}
                onPress={() => openBookDetails(currentReadingEntry.book)}
                actionLabel={labels[`current-finished-${currentReadingEntry.bookId}`] || "Mark as read"}
                onActionPress={() =>
                  void runWithFeedback(`current-finished-${currentReadingEntry.bookId}`, "Finished", () =>
                    actions.onMarkAsRead(currentReadingEntry.bookId)
                  )
                }
                secondaryActionLabel={labels[`current-clear-${currentReadingEntry.bookId}`] || "Move to want to read"}
                onSecondaryActionPress={() =>
                  void runWithFeedback(`current-clear-${currentReadingEntry.bookId}`, "Moved", () =>
                    actions.onMarkAsSaved(currentReadingEntry.bookId)
                  )
                }
              />
            </View>
          ) : null}
          <View style={appStyles.pickModeRow}>
            <Pressable
              style={({ pressed }) => [
                appStyles.pickModeButton,
                activeTab === "want" ? appStyles.pickModeButtonActive : null,
                pressed ? appStyles.chipPressed : null,
              ]}
              onPress={() => setActiveTab("want")}
            >
              <Text style={[appStyles.pickModeTitle, activeTab === "want" ? appStyles.pickModeTitleActive : null]}>Want to read</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                appStyles.pickModeButton,
                activeTab === "finished" ? appStyles.pickModeButtonActive : null,
                pressed ? appStyles.chipPressed : null,
              ]}
              onPress={() => setActiveTab("finished")}
            >
              <Text style={[appStyles.pickModeTitle, activeTab === "finished" ? appStyles.pickModeTitleActive : null]}>Finished</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                appStyles.pickModeButton,
                activeTab === "club-finished" ? appStyles.pickModeButtonActive : null,
                pressed ? appStyles.chipPressed : null,
              ]}
              onPress={() => setActiveTab("club-finished")}
            >
              <Text style={[appStyles.pickModeTitle, activeTab === "club-finished" ? appStyles.pickModeTitleActive : null]}>
                Finished in Club
              </Text>
            </Pressable>
          </View>

          {!model.booksLoading && currentEntries.length === 0 ? (
            <Text style={appStyles.bodyText}>
              {activeTab === "want"
                ? "No additional books in your club shelf yet."
                : activeTab === "finished"
                  ? "You have not marked any finished books in this club yet."
                  : "No finished books have been tracked in this club yet."}
            </Text>
          ) : null}

          {currentEntries.map((entry) => (
            <BookCard
              key={`${activeTab}-${entry.id}`}
              book={entry.book}
              onPress={() => openBookDetails(entry.book)}
              onDismiss={
                !model.authUser || entry.userId !== model.authUser.id
                  ? undefined
                  : () => {
                      void actions.onRemoveBook(entry.bookId);
                    }
              }
              actionLabel={
                activeTab === "want"
                  ? labels[`pick-${entry.book.id}`] || (model.currentPickedBookId === entry.book.id ? "Picked" : "Pick for Club")
                  : activeTab === "finished" || activeTab === "club-finished"
                    ? labels[`move-${entry.book.id}`] || "Move to want to read"
                    : undefined
              }
              onActionPress={
                activeTab === "want"
                  ? () =>
                      void runWithFeedback(
                        `pick-${entry.bookId}`,
                        model.currentPickedBookId === entry.bookId ? "Cleared" : "Picked",
                        () => actions.onPickForClub(entry.bookId)
                      )
                  : activeTab === "finished" || activeTab === "club-finished"
                    ? () => void runWithFeedback(`move-${entry.bookId}`, "Moved", () => actions.onMarkAsSaved(entry.bookId))
                    : undefined
              }
              secondaryActionLabel={activeTab === "want" ? labels[`finished-${entry.bookId}`] || "Mark as read" : undefined}
              onSecondaryActionPress={
                activeTab === "want"
                  ? () => void runWithFeedback(`finished-${entry.bookId}`, "Finished", () => actions.onMarkAsRead(entry.bookId))
                  : undefined
              }
            />
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
            <BookCard key={book.id} book={book} onPress={() => openBookDetails(book)} />
          ))}
        </>
      )}
      <BookDetailsModal visible={Boolean(selectedBook)} book={selectedBook} loading={bookDetailsLoading} onClose={() => setSelectedBook(null)} />
    </View>
  );
}
