import { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { fetchClubBooks, removeBookFromClub, saveBookToClub, saveSampleBookToClub, updateClubBookEntry, updateClubBookStatus } from "../services/clubs";
import type { AuthUser, Book, Club, ClubLibraryEntry } from "../types";

export function useBookLibrary(authUser: AuthUser | null, selectedClub?: Club, setCurrentClubBook?: (title: string) => void) {
  const [libraryEntries, setLibraryEntries] = useState<ClubLibraryEntry[]>([]);
  const [finishedEntries, setFinishedEntries] = useState<ClubLibraryEntry[]>([]);
  const [clubFinishedEntries, setClubFinishedEntries] = useState<ClubLibraryEntry[]>([]);
  const [favoriteBooks, setFavoriteBooks] = useState<Book[]>([]);
  const [finishedBooks, setFinishedBooks] = useState<Book[]>([]);
  const [clubFinishedBooks, setClubFinishedBooks] = useState<Book[]>([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [booksError, setBooksError] = useState<string | null>(null);

  const applyLibrarySnapshot = (
    nextLibraryEntries: ClubLibraryEntry[],
    nextClubFinishedEntries: ClubLibraryEntry[] = clubFinishedEntries
  ) => {
    setLibraryEntries(nextLibraryEntries);
    syncShelfState(nextLibraryEntries);
    setClubFinishedEntries(nextClubFinishedEntries);
    setClubFinishedBooks(nextClubFinishedEntries.map((entry) => entry.book));
  };

  const reconcileLibraryInBackground = (nextAuthUser = authUser, nextSelectedClub = selectedClub) => {
    void reloadLibrary(nextAuthUser, nextSelectedClub).catch((error) => {
      setBooksError(error instanceof Error ? error.message : "Failed to sync the club library.");
    });
  };

  const getCurrentClubBookTitle = (entries: ClubLibraryEntry[]) => {
    const activeEntries = entries.filter((entry) => entry.status !== "finished" && entry.status !== "removed");
    return (
      activeEntries.find((entry) => entry.isCurrentRead)?.book.title ||
      activeEntries.find((entry) => entry.status === "current")?.book.title ||
      activeEntries[0]?.book.title ||
      ""
    );
  };

  const syncShelfState = (entries: ClubLibraryEntry[]) => {
    const activeEntries = entries.filter((entry) => entry.status !== "finished" && entry.status !== "removed");
    const ownFinishedEntries = entries.filter((entry) => entry.status === "finished");

    setFavoriteBooks(activeEntries.map((entry) => entry.book));
    setFinishedBooks(ownFinishedEntries.map((entry) => entry.book));
    setFinishedEntries(ownFinishedEntries);
    setCurrentClubBook?.(getCurrentClubBookTitle(entries));
  };

  const getCurrentClubEntry = () =>
    libraryEntries.find((entry) => entry.isCurrentRead || entry.status === "current") ?? null;
  const currentClubEntry = useMemo(
    () => libraryEntries.find((entry) => entry.isCurrentRead || entry.status === "current") ?? null,
    [libraryEntries]
  );

  const reloadLibrary = async (nextAuthUser = authUser, nextSelectedClub = selectedClub) => {
    if (!nextAuthUser || !nextSelectedClub) {
      setLibraryEntries([]);
      setFinishedEntries([]);
      setClubFinishedEntries([]);
      setFavoriteBooks([]);
      setFinishedBooks([]);
      setClubFinishedBooks([]);
      setCurrentClubBook?.("");
      return;
    }

    const [{ entries, currentBookTitle }, { entries: clubFinishedEntriesFromApi, books: clubFinished }] = await Promise.all([
      fetchClubBooks(nextSelectedClub.id, nextAuthUser.id),
      fetchClubBooks(nextSelectedClub.id, undefined, "finished"),
    ]);

    setLibraryEntries(entries);
    syncShelfState(entries);
    setClubFinishedEntries(clubFinishedEntriesFromApi);
    setClubFinishedBooks(clubFinished);
    setCurrentClubBook?.(currentBookTitle || getCurrentClubBookTitle(entries));
  };

  useEffect(() => {
    if (!authUser || !selectedClub) {
      setLibraryEntries([]);
      setFinishedEntries([]);
      setClubFinishedEntries([]);
      setFavoriteBooks([]);
      setFinishedBooks([]);
      setClubFinishedBooks([]);
      setCurrentClubBook?.("");
      setBooksLoading(false);
      setBooksError(null);
      return;
    }

    let ignore = false;

    const loadBooks = async () => {
      setBooksLoading(true);
      setBooksError(null);

      try {
        await reloadLibrary(authUser, selectedClub);
        if (ignore) {
          return;
        }
      } catch (error) {
        if (!ignore) {
          setBooksError(error instanceof Error ? error.message : "Failed to load books.");
        }
      } finally {
        if (!ignore) {
          setBooksLoading(false);
        }
      }
    };

    void loadBooks();

    return () => {
      ignore = true;
    };
  }, [authUser, selectedClub, setCurrentClubBook]);

  const addSampleBook = async (onSaved?: () => void) => {
    if (!authUser || !selectedClub) {
      Alert.alert("Club required", "Select a club before adding a book.");
      return;
    }

    try {
      const savedBook = await saveSampleBookToClub(selectedClub.id, authUser.id);
      const optimisticEntry: ClubLibraryEntry = {
        id: `optimistic-sample-${savedBook.id}`,
        clubId: selectedClub.id,
        userId: authUser.id,
        bookId: savedBook.id,
        status: "saved",
        isCurrentRead: false,
        addedAt: undefined,
        book: savedBook,
      };
      applyLibrarySnapshot(
        [
          optimisticEntry,
          ...libraryEntries.filter((entry) => entry.bookId !== savedBook.id),
        ],
        clubFinishedEntries
      );
      setBooksError(null);
      reconcileLibraryInBackground();
      onSaved?.();
    } catch (error) {
      Alert.alert(
        "Could not save book",
        error instanceof Error ? error.message : "The API is unavailable."
      );
    }
  };

  const persistBook = async (book: Book) => {
    if (!authUser || !selectedClub) {
      return book;
    }

    const previousLibraryEntries = libraryEntries;
    const previousClubFinishedEntries = clubFinishedEntries;
    const optimisticEntry: ClubLibraryEntry = {
      id: `optimistic-save-${book.id}`,
      clubId: selectedClub.id,
      userId: authUser.id,
      bookId: book.id,
      status: "saved",
      isCurrentRead: false,
      addedAt: undefined,
      book,
    };

    applyLibrarySnapshot(
      [optimisticEntry, ...libraryEntries.filter((entry) => entry.bookId !== book.id)],
      clubFinishedEntries
    );

    try {
      const savedBook = await saveBookToClub(selectedClub.id, authUser.id, book);
      applyLibrarySnapshot(
        [
          {
            ...optimisticEntry,
            id: optimisticEntry.id.replace("optimistic-save", "saved"),
            book: savedBook,
          },
          ...previousLibraryEntries.filter((entry) => entry.bookId !== savedBook.id),
        ],
        previousClubFinishedEntries
      );
      setBooksError(null);
      reconcileLibraryInBackground();
      return savedBook;
    } catch (error) {
      applyLibrarySnapshot(previousLibraryEntries, previousClubFinishedEntries);
      throw error;
    }
  };

  const removeBook = async (bookId: string) => {
    if (!authUser || !selectedClub) {
      return;
    }

    const previousLibraryEntries = libraryEntries;
    const previousClubFinishedEntries = clubFinishedEntries;
    applyLibrarySnapshot(
      libraryEntries.filter((entry) => entry.bookId !== bookId),
      clubFinishedEntries.filter((entry) => entry.bookId !== bookId)
    );

    try {
      await removeBookFromClub(selectedClub.id, authUser.id, bookId);
      setBooksError(null);
      reconcileLibraryInBackground();
    } catch (error) {
      applyLibrarySnapshot(previousLibraryEntries, previousClubFinishedEntries);
      throw error;
    }
  };

  const updateBookStatus = async (bookId: string, status: "saved" | "finished") => {
    if (!authUser || !selectedClub) {
      return;
    }

    const previousLibraryEntries = libraryEntries;
    const previousClubFinishedEntries = clubFinishedEntries;
    const targetEntry = previousLibraryEntries.find((entry) => entry.bookId === bookId);

    if (!targetEntry) {
      return;
    }

    const nextEntry: ClubLibraryEntry = {
      ...targetEntry,
      status,
      isCurrentRead: status === "finished" ? false : targetEntry.isCurrentRead,
    };
    const nextLibraryEntries =
      status === "finished"
        ? previousLibraryEntries.filter((entry) => entry.bookId !== bookId)
        : previousLibraryEntries.map((entry) => (entry.bookId === bookId ? nextEntry : entry));
    const nextClubFinishedEntries =
      status === "finished"
        ? [nextEntry, ...previousClubFinishedEntries.filter((entry) => entry.bookId !== bookId)]
        : previousClubFinishedEntries.filter((entry) => entry.bookId !== bookId);

    applyLibrarySnapshot(nextLibraryEntries, nextClubFinishedEntries);

    try {
      const entry =
        status === "finished"
          ? await updateClubBookEntry(selectedClub.id, authUser.id, bookId, {
              status: "finished",
              isCurrentRead: false,
            })
          : await updateClubBookStatus(selectedClub.id, authUser.id, bookId, status);
      setBooksError(null);
      reconcileLibraryInBackground();
      return entry;
    } catch (error) {
      applyLibrarySnapshot(previousLibraryEntries, previousClubFinishedEntries);
      throw error;
    }
  };

  const pickBookForClub = async (bookId: string) => {
    if (!authUser || !selectedClub) {
      return;
    }

    const previousLibraryEntries = libraryEntries;
    const currentEntry = libraryEntries.find(
      (entry) => entry.book.id !== bookId && (entry.isCurrentRead || entry.status === "current")
    );

    const optimisticEntries: ClubLibraryEntry[] = libraryEntries.map((entry) => {
      if (entry.bookId === bookId) {
        return {
          ...entry,
          status: "current" as const,
          isCurrentRead: true,
        };
      }

      if (entry.bookId === currentEntry?.book.id) {
        return {
          ...entry,
          status: "saved" as const,
          isCurrentRead: false,
        };
      }

      return entry;
    });

    applyLibrarySnapshot(optimisticEntries, clubFinishedEntries);

    try {
      const updates = [];

      if (currentEntry) {
        updates.push(
          updateClubBookEntry(selectedClub.id, authUser.id, currentEntry.book.id, {
            status: "saved",
            isCurrentRead: false,
          })
        );
      }

      updates.push(
        updateClubBookEntry(selectedClub.id, authUser.id, bookId, {
          status: "current",
          isCurrentRead: true,
        })
      );

      await Promise.all(updates);
      setBooksError(null);
      reconcileLibraryInBackground();
    } catch (error) {
      applyLibrarySnapshot(previousLibraryEntries, clubFinishedEntries);
      throw error;
    }
  };

  const clearPickedBookForClub = async (bookId: string) => {
    if (!authUser || !selectedClub) {
      return;
    }

    const previousLibraryEntries = libraryEntries;
    applyLibrarySnapshot(
      libraryEntries.map((entry) =>
        entry.bookId === bookId
          ? {
              ...entry,
              status: "saved",
              isCurrentRead: false,
            }
          : entry
      ),
      clubFinishedEntries
    );

    try {
      await updateClubBookEntry(selectedClub.id, authUser.id, bookId, {
        status: "saved",
        isCurrentRead: false,
      });
      setBooksError(null);
      reconcileLibraryInBackground();
    } catch (error) {
      applyLibrarySnapshot(previousLibraryEntries, clubFinishedEntries);
      throw error;
    }
  };

  const togglePickBookForClub = async (bookId: string) => {
    const currentEntry = getCurrentClubEntry();

    if (currentEntry?.book.id === bookId) {
      await clearPickedBookForClub(bookId);
      return false;
    }

    await pickBookForClub(bookId);
    return true;
  };

  const resetLibrary = () => {
    setLibraryEntries([]);
    setFinishedEntries([]);
    setClubFinishedEntries([]);
    setFavoriteBooks([]);
    setFinishedBooks([]);
    setClubFinishedBooks([]);
    setCurrentClubBook?.("");
    setBooksError(null);
  };

  return {
    libraryEntries,
    finishedEntries,
    clubFinishedEntries,
    currentReadingEntry: currentClubEntry,
    favoriteBooks,
    finishedBooks,
    clubFinishedBooks,
    currentClubBookId: currentClubEntry?.book.id ?? null,
    currentClubBookTitle: currentClubEntry?.book.title ?? "",
    currentClubBookDetails: currentClubEntry?.book ?? null,
    booksLoading,
    booksError,
    setBooksError,
    addSampleBook,
    persistBook,
    removeBook,
    markBookFinished: (bookId: string) => updateBookStatus(bookId, "finished"),
    markBookSaved: (bookId: string) => updateBookStatus(bookId, "saved"),
    pickBookForClub,
    clearPickedBookForClub,
    togglePickBookForClub,
    resetLibrary,
  };
}
