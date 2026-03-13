import { useEffect, useMemo, useState } from "react";
import { RecommendationEngine } from "../domain/RecommendationEngine";
import type { Book, Recommendation } from "../types";

export function useSearchCatalog(
  recommendationEngine: RecommendationEngine,
  guestLibraryBooks: Book[],
  favoriteBooks: Book[],
  recommendations: Recommendation[],
  setFavoriteBooks: React.Dispatch<React.SetStateAction<Book[]>>,
  onPersistBook?: (book: Book) => Promise<void>
) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSearchBookId, setSelectedSearchBookId] = useState<string | null>(null);
  const [savedSearchBookIds, setSavedSearchBookIds] = useState<string[]>([]);

  const searchBooks = useMemo(() => {
    return recommendationEngine.mergeCatalog(guestLibraryBooks, favoriteBooks, recommendations);
  }, [favoriteBooks, guestLibraryBooks, recommendationEngine, recommendations]);

  const filteredSearchBooks = useMemo(() => {
    return recommendationEngine.filterCatalog(searchBooks, searchTerm);
  }, [recommendationEngine, searchBooks, searchTerm]);

  const selectedSearchBook = useMemo<Book | null>(() => {
    if (!selectedSearchBookId) {
      return filteredSearchBooks[0] ?? searchBooks[0] ?? null;
    }

    return searchBooks.find((book) => book.id === selectedSearchBookId) ?? null;
  }, [filteredSearchBooks, searchBooks, selectedSearchBookId]);

  useEffect(() => {
    setSavedSearchBookIds(favoriteBooks.map((book) => book.id));
  }, [favoriteBooks]);

  const toggleSaveSearchBook = async (book: Book) => {
    const isSaved = savedSearchBookIds.includes(book.id);

    setSavedSearchBookIds((current) =>
      isSaved ? current.filter((id) => id !== book.id) : [...current, book.id]
    );

    if (!isSaved) {
      await onPersistBook?.(book);
      setFavoriteBooks((current) => {
        if (current.some((savedBook) => savedBook.id === book.id)) {
          return current;
        }

        return [book, ...current];
      });
    }
  };

  return {
    searchTerm,
    selectedSearchBookId,
    savedSearchBookIds,
    filteredSearchBooks,
    selectedSearchBook,
    setSearchTerm,
    setSelectedSearchBookId,
    toggleSaveSearchBook,
  };
}
