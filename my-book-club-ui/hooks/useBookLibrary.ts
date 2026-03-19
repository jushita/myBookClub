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
      await saveSampleBookToClub(selectedClub.id, authUser.id);
      await reloadLibrary();
      setBooksError(null);
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

    const savedBook = await saveBookToClub(selectedClub.id, authUser.id, book);
    await reloadLibrary();
    setBooksError(null);

    return savedBook;
  };

  const removeBook = async (bookId: string) => {
    if (!authUser || !selectedClub) {
      return;
    }

    await removeBookFromClub(selectedClub.id, authUser.id, bookId);
    await reloadLibrary();
    setBooksError(null);
  };

  const updateBookStatus = async (bookId: string, status: "saved" | "finished") => {
    if (!authUser || !selectedClub) {
      return;
    }

    const entry =
      status === "finished"
        ? await updateClubBookEntry(selectedClub.id, authUser.id, bookId, {
            status: "finished",
            isCurrentRead: false,
          })
        : await updateClubBookStatus(selectedClub.id, authUser.id, bookId, status);
    await reloadLibrary();
    setBooksError(null);
    return entry;
  };

  const pickBookForClub = async (bookId: string) => {
    if (!authUser || !selectedClub) {
      return;
    }

    const currentEntry = libraryEntries.find(
      (entry) => entry.book.id !== bookId && (entry.isCurrentRead || entry.status === "current")
    );

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

    const updatedEntries = await Promise.all(updates);
    if (updatedEntries.length > 0) {
      await reloadLibrary();
    }
    setBooksError(null);
  };

  const clearPickedBookForClub = async (bookId: string) => {
    if (!authUser || !selectedClub) {
      return;
    }

    await updateClubBookEntry(selectedClub.id, authUser.id, bookId, {
      status: "saved",
      isCurrentRead: false,
    });
    await reloadLibrary();
    setBooksError(null);
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
