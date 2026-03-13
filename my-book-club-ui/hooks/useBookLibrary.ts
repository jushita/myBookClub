import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { fetchClubBooks, saveSampleBookToClub } from "../services/clubs";
import type { AuthUser, Book, Club } from "../types";

export function useBookLibrary(authUser: AuthUser | null, selectedClub?: Club, setCurrentClubBook?: (title: string) => void) {
  const [favoriteBooks, setFavoriteBooks] = useState<Book[]>([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [booksError, setBooksError] = useState<string | null>(null);

  useEffect(() => {
    if (!authUser || !selectedClub) {
      setFavoriteBooks([]);
      setBooksLoading(false);
      setBooksError(null);
      return;
    }

    let ignore = false;

    const loadBooks = async () => {
      setBooksLoading(true);
      setBooksError(null);

      try {
        const { books, currentBookTitle } = await fetchClubBooks(selectedClub.id);
        if (!ignore) {
          setFavoriteBooks(books);
          if (currentBookTitle) {
            setCurrentClubBook?.(currentBookTitle);
          }
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
      const nextBook = await saveSampleBookToClub(selectedClub.id, authUser.id);

      setFavoriteBooks((current) => {
        if (current.some((book) => book.id === nextBook.id)) {
          return current;
        }

        return [nextBook, ...current];
      });
      setBooksError(null);
      onSaved?.();
    } catch (error) {
      Alert.alert(
        "Could not save book",
        error instanceof Error ? error.message : "The API is unavailable."
      );
    }
  };

  const resetLibrary = () => {
    setFavoriteBooks([]);
    setBooksError(null);
  };

  return {
    favoriteBooks,
    booksLoading,
    booksError,
    setFavoriteBooks,
    setBooksError,
    addSampleBook,
    resetLibrary,
  };
}
