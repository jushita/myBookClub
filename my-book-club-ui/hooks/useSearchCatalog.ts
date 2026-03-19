import { useEffect, useMemo, useState } from "react";
import { RecommendationEngine } from "../domain/RecommendationEngine";
import { prewarmBookDetails } from "../services/api";
import type { Book, Recommendation } from "../types";

function getBookLookupKey(book: Pick<Book, "title" | "author">) {
  return `${book.title.trim().toLowerCase()}::${book.author.trim().toLowerCase()}`;
}

export function useSearchCatalog(
  recommendationEngine: RecommendationEngine,
  defaultCatalogBooks: Book[],
  libraryBooks: Book[],
  recommendations: Recommendation[],
  onSearchBooks?: (query: string) => Promise<Book[]>,
  onHydrateBook?: (book: Book) => void,
  onPersistBook?: (book: Book) => Promise<Book>,
  onRemoveBook?: (bookId: string) => Promise<void>
) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSearchBookId, setSelectedSearchBookId] = useState<string | null>(null);
  const [savedSearchBookIds, setSavedSearchBookIds] = useState<string[]>([]);
  const [savedSearchBookKeys, setSavedSearchBookKeys] = useState<string[]>([]);
  const [remoteSearchBooks, setRemoteSearchBooks] = useState<Book[]>([]);

  const searchBooks = useMemo(() => {
    if (searchTerm.trim()) {
      return recommendationEngine.mergeCatalog(remoteSearchBooks, libraryBooks, recommendations);
    }

    return recommendationEngine.mergeCatalog(defaultCatalogBooks, libraryBooks, recommendations);
  }, [defaultCatalogBooks, libraryBooks, recommendationEngine, recommendations, remoteSearchBooks, searchTerm]);

  const filteredSearchBooks = useMemo(() => {
    if (searchTerm.trim()) {
      return searchBooks;
    }

    return recommendationEngine.filterCatalog(searchBooks, searchTerm);
  }, [recommendationEngine, searchBooks, searchTerm]);

  const selectedSearchBook = useMemo<Book | null>(() => {
    if (!selectedSearchBookId) {
      return null;
    }

    return searchBooks.find((book) => book.id === selectedSearchBookId) ?? null;
  }, [searchBooks, selectedSearchBookId]);

  useEffect(() => {
    setSavedSearchBookIds(libraryBooks.map((book) => book.id));
    setSavedSearchBookKeys(libraryBooks.map((book) => getBookLookupKey(book)));
  }, [libraryBooks]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setRemoteSearchBooks([]);
      return;
    }

    let ignore = false;

    const runSearch = async () => {
      try {
        const books = await onSearchBooks?.(searchTerm);
        if (!ignore) {
          setRemoteSearchBooks(books ?? []);
        }
      } catch {
        if (!ignore) {
          setRemoteSearchBooks([]);
        }
      }
    };

    void runSearch();

    return () => {
      ignore = true;
    };
  }, [onSearchBooks, searchTerm]);

  useEffect(() => {
    if (!searchTerm.trim() || remoteSearchBooks.length === 0) {
      return;
    }

    void prewarmBookDetails(remoteSearchBooks, (book) => {
      setRemoteSearchBooks((current) => current.map((entry) => (entry.id === book.id ? { ...entry, ...book } : entry)));
      onHydrateBook?.(book);
    });
  }, [onHydrateBook, remoteSearchBooks, searchTerm]);

  const toggleSaveSearchBook = async (book: Book) => {
    const lookupKey = getBookLookupKey(book);
    const matchedSavedBook =
      libraryBooks.find((savedBook) => savedBook.id === book.id) ||
      libraryBooks.find((savedBook) => getBookLookupKey(savedBook) === lookupKey);
    const isSaved = Boolean(matchedSavedBook);

    if (isSaved) {
      if (matchedSavedBook) {
        await onRemoveBook?.(matchedSavedBook.id);
      }

      return;
    }

    await onPersistBook?.(book);
  };

  return {
    searchTerm,
    selectedSearchBookId,
    savedSearchBookIds,
    savedSearchBookKeys,
    filteredSearchBooks,
    selectedSearchBook,
    setSearchTerm,
    setSelectedSearchBookId,
    toggleSaveSearchBook,
  };
}
