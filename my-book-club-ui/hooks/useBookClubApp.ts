import * as WebBrowser from "expo-web-browser";
import { Alert } from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { MOCK_BOOKS, MOCK_RECOMMENDATIONS } from "../data/mockData";
import { RecommendationEngine } from "../domain/RecommendationEngine";
import { WheelEngine } from "../domain/WheelEngine";
import { fetchBooks, mergeDetailedBook } from "../services/api";
import { fetchRecommendedBooks } from "../services/recommendations";
import {
  fetchClubInsight,
  fetchCurrentClubDiscussionQuestions,
  getCachedClubInsight,
  getCachedCurrentClubDiscussionQuestions,
} from "../services/clubs";
import type { ClubInsight } from "../services/clubs";
import { useAppNavigation } from "./useAppNavigation";
import { useAuthFlow } from "./useAuthFlow";
import { useBookLibrary } from "./useBookLibrary";
import { useClubState } from "./useClubState";
import { useHeaderContent } from "./useHeaderContent";
import { usePickNext } from "./usePickNext";
import { useSearchCatalog } from "./useSearchCatalog";
import type { AppScreenViews } from "../types/screenModels";
import type { Book } from "../types";

WebBrowser.maybeCompleteAuthSession();
const AI_PICK_BATCH_SIZE = 5;
const AI_PICK_POOL_FETCH_SIZE = 24;
const AI_PICK_PARTIAL_BATCH_SIZE = 2;

function mergeUniqueById<T extends { id: string }>(...groups: T[][]): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const group of groups) {
    for (const item of group) {
      if (seen.has(item.id)) {
        continue;
      }

      seen.add(item.id);
      merged.push(item);
    }
  }

  return merged;
}

export function useBookClubApp() {
  const recommendationEngine = useMemo(() => new RecommendationEngine([]), []);
  const wheelEngine = useMemo(() => new WheelEngine(), []);
  const fallbackGuestLibraryBooks = useMemo<Book[]>(() => MOCK_BOOKS, []);

  const auth = useAuthFlow();
  const navigation = useAppNavigation(auth.setEmailAuthMode);
  const clubs = useClubState(auth.authUser);
  const library = useBookLibrary(auth.authUser, clubs.selectedClub, clubs.setCurrentClubBook);
  const previousAuthUserId = useRef<string | null>(null);
  const [aiPickerRecommendations, setAiPickerRecommendations] = useState<typeof MOCK_RECOMMENDATIONS>([]);
  const [aiPickerExplanation, setAiPickerExplanation] = useState<string | null>(null);
  const [aiPickerSource, setAiPickerSource] = useState<string | null>(null);
  const [aiPickerLoading, setAiPickerLoading] = useState(false);
  const [aiPickerSeenBookIds, setAiPickerSeenBookIds] = useState<string[]>([]);
  const [aiPickerQueuedRecommendations, setAiPickerQueuedRecommendations] = useState<typeof MOCK_RECOMMENDATIONS>([]);
  const [aiPickerContextKey, setAiPickerContextKey] = useState("");
  const [catalogBooks, setCatalogBooks] = useState<Book[]>([]);
  const [discussionQuestions, setDiscussionQuestions] = useState<string[]>([]);
  const [discussionQuestionsLoading, setDiscussionQuestionsLoading] = useState(false);
  const [discussionQuestionsVisible, setDiscussionQuestionsVisible] = useState(false);
  const [clubInsight, setClubInsight] = useState<ClubInsight | null>(null);
  const [clubInsightLoading, setClubInsightLoading] = useState(false);
  const personalizedRotationSeed = useRef<number>(Date.now()).current;
  const discussionRequestRef = useRef<Promise<{ currentBookId: string | null; questions: string[] }> | null>(null);
  const aiRecommendationPrefetchRef = useRef<Promise<Awaited<ReturnType<typeof fetchRecommendedBooks>> | null> | null>(null);
  const aiRecommendationRequestIdRef = useRef(0);
  const aiPickerSeenBookIdsRef = useRef<string[]>([]);
  const aiPickerQueuedRecommendationsRef = useRef<typeof MOCK_RECOMMENDATIONS>([]);
  const aiPickerContextKeyRef = useRef("");
  const aiPickerRecommendationsRef = useRef<typeof MOCK_RECOMMENDATIONS>([]);

  useEffect(() => {
    const currentAuthUserId = auth.authUser?.id ?? null;

    if (!previousAuthUserId.current && currentAuthUserId) {
      navigation.setScreen("clubs");
    }

    previousAuthUserId.current = currentAuthUserId;
  }, [auth.authUser, navigation]);

  useEffect(() => {
    let ignore = false;

    const loadCatalog = async () => {
      try {
        const books = await fetchBooks(undefined, 200);
        if (!ignore) {
          setCatalogBooks(books);
        }
      } catch {
        if (!ignore) {
          setCatalogBooks([]);
        }
      }
    };

    void loadCatalog();

    return () => {
      ignore = true;
    };
  }, []);

  const searchLibraryBooks = useMemo(() => {
    return library.libraryEntries.map((entry) => entry.book);
  }, [library.libraryEntries]);

  const searchBooksFromApi = useMemo(() => {
    return (query: string) => fetchBooks(query, 50);
  }, []);

  const guestLibraryBooks = useMemo<Book[]>(() => {
    return catalogBooks.length > 0 ? catalogBooks : fallbackGuestLibraryBooks;
  }, [catalogBooks, fallbackGuestLibraryBooks]);

  const mergeBookIntoCatalog = (book: Book) => {
    setCatalogBooks((current) => {
      if (!current.some((entry) => entry.id === book.id)) {
        return current;
      }

      return current.map((entry) => (entry.id === book.id ? mergeDetailedBook(entry, book) : entry));
    });
  };

  const currentPickedBookKeys = useMemo(() => {
    const currentEntry = library.libraryEntries.find((entry) => entry.isCurrentRead || entry.status === "current");
    if (!currentEntry) {
      return [];
    }

    return [`${currentEntry.book.title.trim().toLowerCase()}::${currentEntry.book.author.trim().toLowerCase()}`];
  }, [library.libraryEntries]);

  const currentClubBookDetails = library.currentClubBookDetails;
  const recommendationShelfFingerprint = useMemo(() => {
    const savedIds = library.clubSavedEntries
      .map((entry) => entry.bookId)
      .sort()
      .join(",");
    const finishedIds = library.clubFinishedEntries
      .map((entry) => entry.bookId)
      .sort()
      .join(",");
    const currentBookId = library.currentClubBookId ?? "none";

    return `saved:${savedIds}|finished:${finishedIds}|current:${currentBookId}`;
  }, [library.clubFinishedEntries, library.clubSavedEntries, library.currentClubBookId]);

  const clubRecommendations = useMemo(() => {
    if (catalogBooks.length === 0) {
      return [];
    }

    return recommendationEngine.buildPersonalizedRecommendations(catalogBooks, {
      savedBooks: library.favoriteBooks,
      finishedBooks: library.clubFinishedBooks,
      currentBook: currentClubBookDetails,
      club: clubs.selectedClub,
      limit: 6,
      rotationSeed: personalizedRotationSeed,
    });
  }, [
    catalogBooks,
    clubs.selectedClub,
    currentClubBookDetails,
    library.clubFinishedBooks,
    library.favoriteBooks,
    personalizedRotationSeed,
    recommendationEngine,
  ]);

  const search = useSearchCatalog(
    recommendationEngine,
    guestLibraryBooks,
    searchLibraryBooks,
    clubRecommendations,
    searchBooksFromApi,
    mergeBookIntoCatalog,
    async (book) => {
      try {
        const savedBook = await library.persistBook(book);
        library.setBooksError(null);
        return savedBook;
      } catch (error) {
        Alert.alert("Could not save book", error instanceof Error ? error.message : "Try again.");
        throw error;
      }
    },
    async (bookId) => {
      try {
        await library.removeBook(bookId);
        library.setBooksError(null);
      } catch (error) {
        Alert.alert("Could not remove book", error instanceof Error ? error.message : "Try again.");
        throw error;
      }
    }
  );

  const personalizedRecommendations = useMemo(() => {
    return recommendationEngine.buildPersonalizedRecommendations(catalogBooks, {
      savedBooks: library.favoriteBooks,
      finishedBooks: library.finishedBooks,
      currentBook: currentClubBookDetails,
      club: clubs.selectedClub,
      limit: 3,
      rotationSeed: personalizedRotationSeed,
    });
  }, [
    catalogBooks,
    clubs.selectedClub,
    currentClubBookDetails,
    library.favoriteBooks,
    library.finishedBooks,
    personalizedRotationSeed,
    recommendationEngine,
  ]);

  const pickNext = usePickNext(
    clubs.selectedClub,
    clubs.selectedClubMembers.length,
    library.clubSavedBooks,
    aiPickerRecommendations,
    wheelEngine,
    searchBooksFromApi
  );
  const activeAiQuery = useMemo(
    () => pickNext.aiPickerPrompt.trim() || clubs.selectedClub?.promptSeed || "book club taste",
    [clubs.selectedClub?.promptSeed, pickNext.aiPickerPrompt]
  );
  const hasExplicitAiPrompt = useMemo(() => Boolean(pickNext.aiPickerPrompt.trim()), [pickNext.aiPickerPrompt]);
  const activeAiContextKey = useMemo(
    () =>
      `${clubs.selectedClub?.id || "none"}::${currentClubBookDetails?.id || "none"}::${recommendationShelfFingerprint}::${activeAiQuery
        .trim()
        .toLowerCase()}`,
    [clubs.selectedClub?.id, currentClubBookDetails?.id, recommendationShelfFingerprint, activeAiQuery]
  );

  useEffect(() => {
    aiPickerSeenBookIdsRef.current = aiPickerSeenBookIds;
  }, [aiPickerSeenBookIds]);

  useEffect(() => {
    aiPickerQueuedRecommendationsRef.current = aiPickerQueuedRecommendations;
  }, [aiPickerQueuedRecommendations]);

  useEffect(() => {
    aiPickerContextKeyRef.current = aiPickerContextKey;
  }, [aiPickerContextKey]);

  useEffect(() => {
    aiPickerRecommendationsRef.current = aiPickerRecommendations;
  }, [aiPickerRecommendations]);

  const consumeQueuedAiRecommendations = () => {
    if (aiPickerContextKeyRef.current !== activeAiContextKey || aiPickerQueuedRecommendationsRef.current.length === 0) {
      return false;
    }

    const visibleIds = new Set(aiPickerRecommendationsRef.current.map((book) => book.id));
    const queueWithoutVisible = aiPickerQueuedRecommendationsRef.current.filter((book) => !visibleIds.has(book.id));
    const nextBatch = queueWithoutVisible.slice(0, AI_PICK_BATCH_SIZE);
    const remainingQueue = queueWithoutVisible.slice(nextBatch.length);

    if (nextBatch.length === 0) {
      setAiPickerQueuedRecommendations([]);
      aiPickerQueuedRecommendationsRef.current = [];
      return false;
    }

    const nextSeenIds = [
      ...aiPickerSeenBookIdsRef.current,
      ...nextBatch.map((book) => book.id).filter((id) => !aiPickerSeenBookIdsRef.current.includes(id)),
    ];

    setAiPickerRecommendations(nextBatch);
    setAiPickerQueuedRecommendations(remainingQueue);
    setAiPickerSeenBookIds(nextSeenIds);
    aiPickerRecommendationsRef.current = nextBatch;
    aiPickerQueuedRecommendationsRef.current = remainingQueue;
    aiPickerSeenBookIdsRef.current = nextSeenIds;
    pickNext.generateAiPick();
    return true;
  };

  useEffect(() => {
    setAiPickerRecommendations([]);
    setAiPickerExplanation(null);
    setAiPickerSource(null);
    setAiPickerLoading(false);
    setAiPickerSeenBookIds([]);
    setAiPickerQueuedRecommendations([]);
    setAiPickerContextKey("");
    aiPickerSeenBookIdsRef.current = [];
    aiPickerQueuedRecommendationsRef.current = [];
    aiPickerContextKeyRef.current = "";
    aiPickerRecommendationsRef.current = [];
    aiRecommendationRequestIdRef.current += 1;
  }, [clubs.selectedClub]);

  useEffect(() => {
    let ignore = false;

    const warmAiRecommendationCache = async () => {
      if (!clubs.selectedClub) {
        return;
      }

      if (aiPickerContextKeyRef.current !== activeAiContextKey) {
        setAiPickerRecommendations([]);
        setAiPickerExplanation(null);
        setAiPickerSource(null);
        setAiPickerSeenBookIds([]);
        setAiPickerQueuedRecommendations([]);
        setAiPickerContextKey(activeAiContextKey);
        aiPickerSeenBookIdsRef.current = [];
        aiPickerQueuedRecommendationsRef.current = [];
        aiPickerContextKeyRef.current = activeAiContextKey;
        aiPickerRecommendationsRef.current = [];
        aiRecommendationRequestIdRef.current += 1;
      }

      if (aiRecommendationPrefetchRef.current) {
        return;
      }

      const seenIds = aiPickerContextKeyRef.current === activeAiContextKey ? aiPickerSeenBookIdsRef.current : [];
      const queuedIds =
        aiPickerContextKeyRef.current === activeAiContextKey
          ? aiPickerQueuedRecommendationsRef.current.map((book) => book.id)
          : [];
      const qualityMode: "fast" | "full" = seenIds.length === 0 && queuedIds.length === 0 ? "fast" : "full";

      if (queuedIds.length >= 10) {
        return;
      }

      aiRecommendationPrefetchRef.current = fetchRecommendedBooks(activeAiQuery, AI_PICK_POOL_FETCH_SIZE, {
        clubId: clubs.selectedClub.id,
        currentBookId: currentClubBookDetails?.id ?? null,
        shelfFingerprint: recommendationShelfFingerprint,
        excludeBookIds: [...seenIds, ...queuedIds],
        qualityMode,
        hasExplicitPrompt: hasExplicitAiPrompt,
      })
        .then((recommendationResult) => {
          if (ignore) {
            return null;
          }

          if (recommendationResult.recommendations.length === 0) {
            return null;
          }

          setAiPickerExplanation((current) => current ?? recommendationResult.explanation);
          setAiPickerSource((current) => current ?? recommendationResult.source);
          setAiPickerQueuedRecommendations((current) => {
            const existingIds = new Set(current.map((book) => book.id));
            const excludedIds = new Set([
              ...aiPickerSeenBookIdsRef.current,
              ...aiPickerRecommendationsRef.current.map((book) => book.id),
              ...current.map((book) => book.id),
            ]);
            const uniqueNewBooks = recommendationResult.recommendations.filter(
              (book) => !existingIds.has(book.id) && !excludedIds.has(book.id)
            );
            const nextQueue = uniqueNewBooks.length > 0 ? [...current, ...uniqueNewBooks] : current;
            aiPickerQueuedRecommendationsRef.current = nextQueue;
            return nextQueue;
          });

          return recommendationResult;
        })
        .catch(() => {
          // Best-effort prefetch.
          return null;
        })
        .finally(() => {
          aiRecommendationPrefetchRef.current = null;
        });
    };

    const timer = setTimeout(() => {
      void warmAiRecommendationCache();
    }, 500);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [
    activeAiContextKey,
    activeAiQuery,
    hasExplicitAiPrompt,
    aiPickerContextKey,
    aiPickerQueuedRecommendations,
    aiPickerSeenBookIds,
    clubs.selectedClub,
    currentClubBookDetails?.id,
    recommendationShelfFingerprint,
  ]);

  useEffect(() => {
    setDiscussionQuestions([]);
    setDiscussionQuestionsLoading(false);
    setDiscussionQuestionsVisible(false);
  }, [clubs.selectedClub?.id, currentClubBookDetails?.id]);

  useEffect(() => {
    if (!clubs.selectedClub) {
      setClubInsight(null);
      setClubInsightLoading(false);
      return;
    }

    let ignore = false;
    const cachedInsight = getCachedClubInsight(clubs.selectedClub.id);

    if (cachedInsight) {
      setClubInsight(cachedInsight);
      setClubInsightLoading(false);
    }

    const loadClubInsight = async () => {
      try {
        const insight = await fetchClubInsight(clubs.selectedClub!.id);
        if (!ignore) {
          setClubInsight(insight);
        }
      } catch {
        if (!ignore && !cachedInsight) {
          setClubInsight(null);
        }
      }
    };

    void loadClubInsight();

    return () => {
      ignore = true;
    };
  }, [
    clubs.selectedClub,
    library.favoriteBooks.length,
    library.clubFinishedBooks.length,
    currentClubBookDetails?.id,
  ]);

  useEffect(() => {
    if (!clubs.selectedClub || !currentClubBookDetails) {
      discussionRequestRef.current = null;
      return;
    }

    let ignore = false;
    const cachedDiscussion = getCachedCurrentClubDiscussionQuestions(clubs.selectedClub.id);

    if (
      cachedDiscussion &&
      (!cachedDiscussion.currentBookId || cachedDiscussion.currentBookId === currentClubBookDetails.id)
    ) {
      setDiscussionQuestions(cachedDiscussion.questions);
    }

    const startDiscussionRequest = () => {
      if (!clubs.selectedClub) {
        return null;
      }

      if (!discussionRequestRef.current) {
        discussionRequestRef.current = fetchCurrentClubDiscussionQuestions(clubs.selectedClub.id).finally(() => {
          discussionRequestRef.current = null;
        });
      }

      return discussionRequestRef.current;
    };

    const preloadDiscussionQuestions = async () => {
      try {
        const request = startDiscussionRequest();
        if (!request) {
          return;
        }

        const result = await request;

        if (ignore) {
          return;
        }

        if (!result.currentBookId || result.currentBookId === currentClubBookDetails.id) {
          setDiscussionQuestions(result.questions);
        }
      } catch {
        if (!ignore && !cachedDiscussion) {
          setDiscussionQuestions([]);
        }
      }
    };

    void preloadDiscussionQuestions();

    return () => {
      ignore = true;
    };
  }, [clubs.selectedClub, currentClubBookDetails]);

  const header = useHeaderContent(navigation.screen, auth.authUser, clubs.selectedClub);

  const handleAddSampleBook = async () => {
    await library.addSampleBook(() => navigation.setScreen("library"));
  };

  const handleGenerateQuestions = async () => {
    if (!currentClubBookDetails) {
      return;
    }

    setDiscussionQuestionsVisible(true);

    if (discussionQuestions.length > 0 || !clubs.selectedClub) {
      return;
    }

    const startDiscussionRequest = () => {
      if (!clubs.selectedClub) {
        return null;
      }

      if (!discussionRequestRef.current) {
        discussionRequestRef.current = fetchCurrentClubDiscussionQuestions(clubs.selectedClub.id).finally(() => {
          discussionRequestRef.current = null;
        });
      }

      return discussionRequestRef.current;
    };

    try {
      setDiscussionQuestionsLoading(true);
      const request = startDiscussionRequest();
      if (!request) {
        return;
      }

      const result = await request;
      if (!result.currentBookId || result.currentBookId === currentClubBookDetails.id) {
        setDiscussionQuestions(result.questions);
      }
    } catch (error) {
      Alert.alert("Could not load questions", error instanceof Error ? error.message : "Try again in a moment.");
    } finally {
      setDiscussionQuestionsLoading(false);
    }
  };

  const handleGenerateAiPick = async () => {
    if (consumeQueuedAiRecommendations()) {
      return;
    }

    if (aiRecommendationPrefetchRef.current && !hasExplicitAiPrompt) {
      const loadingTimer = setTimeout(() => {
        setAiPickerLoading(true);
      }, 250);

      try {
        await aiRecommendationPrefetchRef.current;
      } finally {
        clearTimeout(loadingTimer);
        setAiPickerLoading(false);
      }

      if (consumeQueuedAiRecommendations()) {
        return;
      }
    }

    const requestId = ++aiRecommendationRequestIdRef.current;
    const loadingTimer = setTimeout(() => {
      if (aiRecommendationRequestIdRef.current === requestId) {
        setAiPickerLoading(true);
      }
    }, 250);

    try {
      const previousContextKey = aiPickerContextKeyRef.current;
      const sameContext = previousContextKey === activeAiContextKey;
      const baseSeenIds = sameContext ? aiPickerSeenBookIdsRef.current : [];
      const baseVisibleBooks = sameContext ? aiPickerRecommendationsRef.current : [];
      const baseExcludeIds = sameContext
        ? Array.from(new Set([...baseSeenIds, ...baseVisibleBooks.map((book) => book.id)]))
        : [];

      if (hasExplicitAiPrompt) {
        const fastPromise = fetchRecommendedBooks(activeAiQuery, AI_PICK_PARTIAL_BATCH_SIZE, {
          clubId: clubs.selectedClub?.id,
          currentBookId: currentClubBookDetails?.id ?? null,
          shelfFingerprint: recommendationShelfFingerprint,
          excludeBookIds: baseExcludeIds,
          qualityMode: "fast",
          hasExplicitPrompt: true,
        });
        const fullPromise = fetchRecommendedBooks(activeAiQuery, AI_PICK_POOL_FETCH_SIZE, {
          clubId: clubs.selectedClub?.id,
          currentBookId: currentClubBookDetails?.id ?? null,
          shelfFingerprint: recommendationShelfFingerprint,
          excludeBookIds: baseExcludeIds,
          qualityMode: "full",
          hasExplicitPrompt: true,
        });

        let hasVisiblePartial = false;

        try {
          const fastResult = await fastPromise;
          if (aiRecommendationRequestIdRef.current !== requestId) {
            return;
          }

          const partialBatch = mergeUniqueById(fastResult.recommendations).slice(0, AI_PICK_PARTIAL_BATCH_SIZE);

          if (partialBatch.length > 0) {
            hasVisiblePartial = true;
            const partialSeenIds = Array.from(
              new Set([...baseSeenIds, ...partialBatch.map((book) => book.id)])
            );

            setAiPickerRecommendations(partialBatch);
            setAiPickerQueuedRecommendations([]);
            setAiPickerSeenBookIds(partialSeenIds);
            setAiPickerExplanation(fastResult.explanation);
            setAiPickerSource(fastResult.source);
            setAiPickerContextKey(activeAiContextKey);
            setAiPickerLoading(true);
            aiPickerRecommendationsRef.current = partialBatch;
            aiPickerQueuedRecommendationsRef.current = [];
            aiPickerSeenBookIdsRef.current = partialSeenIds;
            aiPickerContextKeyRef.current = activeAiContextKey;
            pickNext.generateAiPick();
          }
        } catch {
          // Best-effort fast path. The full request still owns the final result.
        }

        try {
          const fullResult = await fullPromise;
          if (aiRecommendationRequestIdRef.current !== requestId) {
            return;
          }

          const mergedPool = mergeUniqueById(
            aiPickerRecommendationsRef.current,
            aiPickerQueuedRecommendationsRef.current,
            fullResult.recommendations
          );
          const nextBatch = mergedPool.slice(0, AI_PICK_BATCH_SIZE);
          const nextQueue = mergedPool.slice(nextBatch.length);

          if (nextBatch.length === 0) {
            setAiPickerQueuedRecommendations([]);
            aiPickerQueuedRecommendationsRef.current = [];

            if (!hasVisiblePartial) {
              setAiPickerRecommendations([]);
              setAiPickerExplanation(fullResult.explanation);
              setAiPickerSource(fullResult.source);
              pickNext.generateAiPick();
            }

            return;
          }

          const nextSeenIds = Array.from(new Set([...baseSeenIds, ...nextBatch.map((book) => book.id)]));

          setAiPickerRecommendations(nextBatch);
          setAiPickerQueuedRecommendations(nextQueue);
          setAiPickerExplanation(fullResult.explanation);
          setAiPickerSource(fullResult.source);
          setAiPickerContextKey(activeAiContextKey);
          setAiPickerSeenBookIds(nextSeenIds);
          aiPickerRecommendationsRef.current = nextBatch;
          aiPickerQueuedRecommendationsRef.current = nextQueue;
          aiPickerSeenBookIdsRef.current = nextSeenIds;
          aiPickerContextKeyRef.current = activeAiContextKey;
          pickNext.generateAiPick();
          return;
        } catch (error) {
          if (aiRecommendationRequestIdRef.current !== requestId) {
            return;
          }

          if (hasVisiblePartial) {
            return;
          }

          throw error;
        }
      }

      const recommendationResult = await fetchRecommendedBooks(activeAiQuery, AI_PICK_POOL_FETCH_SIZE, {
        clubId: clubs.selectedClub?.id,
        currentBookId: currentClubBookDetails?.id ?? null,
        shelfFingerprint: recommendationShelfFingerprint,
        excludeBookIds: baseExcludeIds,
        hasExplicitPrompt: hasExplicitAiPrompt,
      });

      if (aiRecommendationRequestIdRef.current !== requestId) {
        return;
      }

      const visibleIds = new Set(aiPickerRecommendationsRef.current.map((book) => book.id));
      const unseenRecommendations = recommendationResult.recommendations.filter((book) => !visibleIds.has(book.id));
      const nextBatch = unseenRecommendations.slice(0, AI_PICK_BATCH_SIZE);
      const nextQueue = unseenRecommendations.slice(nextBatch.length);

      if (nextBatch.length === 0) {
        setAiPickerQueuedRecommendations([]);
        aiPickerQueuedRecommendationsRef.current = [];
        return;
      }

      setAiPickerRecommendations(nextBatch);
      setAiPickerQueuedRecommendations(nextQueue);
      setAiPickerExplanation(recommendationResult.explanation);
      setAiPickerSource(recommendationResult.source);
      setAiPickerContextKey(activeAiContextKey);
      aiPickerContextKeyRef.current = activeAiContextKey;
      const nextSeenIds = [
        ...baseSeenIds,
        ...nextBatch
          .map((book) => book.id)
          .filter((id) => !baseSeenIds.includes(id)),
      ];
      setAiPickerSeenBookIds(nextSeenIds);
      aiPickerRecommendationsRef.current = nextBatch;
      aiPickerQueuedRecommendationsRef.current = nextQueue;
      aiPickerSeenBookIdsRef.current = nextSeenIds;
      pickNext.generateAiPick();

      if (nextBatch.length === 0) {
        Alert.alert("No recommendations found", "Try a broader prompt or add more books to the catalog.");
      }
    } catch (error) {
      setAiPickerRecommendations([]);
      setAiPickerExplanation(null);
      setAiPickerSource(null);
      setAiPickerQueuedRecommendations([]);
      pickNext.generateAiPick();
      Alert.alert(
        "Recommendation request failed",
        error instanceof Error ? error.message : "The backend recommendation service is unavailable."
      );
    } finally {
      clearTimeout(loadingTimer);
      if (aiRecommendationRequestIdRef.current === requestId) {
        setAiPickerLoading(false);
      }
    }
  };

  const handleSignOut = () => {
    auth.setAuthToken(null);
    auth.signOut();
    library.resetLibrary();
  };

  const handleScreenChange = (screen: "home" | "clubs" | "search" | "library" | "profile" | "pick-next") => {
    if (screen === "clubs") {
      clubs.setClubManagementMode("overview");
    }

    navigation.setScreen(screen);
  };

  const views: AppScreenViews = {
    home: {
      model: {
        authUser: auth.authUser,
        selectedClub: clubs.selectedClub,
        selectedClubMembersCount: clubs.selectedClubMembers.length + (auth.authUser ? 1 : 0),
        favoriteBooksCount: library.favoriteBooks.length,
        personalizedRecommendations,
        currentClubBookDetails,
        aiPickerPrompt: pickNext.aiPickerPrompt,
        aiPickerGenerated: pickNext.aiPickerGenerated,
        aiPickerRecommendations,
        aiPickerExplanation,
        aiPickerSource,
        aiPickerLoading,
      },
      actions: {
        onAiPromptChange: pickNext.updateAiPrompt,
        onGenerateAiPick: () => void handleGenerateAiPick(),
        onAddHomeAiPickToWantToRead: (book) => {
          return library.persistBook(book).then(() => undefined).catch((error) => {
            Alert.alert("Could not add book", error instanceof Error ? error.message : "Try again.");
          });
        },
        onAddPersonalizedPickToWantToRead: (book) => {
          return library.persistBook(book).then(() => undefined).catch((error) => {
            Alert.alert("Could not add book", error instanceof Error ? error.message : "Try again.");
          });
        },
        onOpenClubs: () => navigation.setScreen("clubs"),
        onOpenLibrary: () => navigation.setScreen("library"),
        onOpenPickNext: () => navigation.setScreen("pick-next"),
        onSignIn: navigation.goToLogin,
        onSignUp: navigation.goToSignup,
      },
    },
    clubs: {
      model: {
        authUser: auth.authUser,
        clubs: clubs.clubs,
        selectedClub: clubs.selectedClub,
        selectedClubMembers: clubs.selectedClubMembers,
        currentClubBook: library.currentClubBookTitle,
        currentClubBookDetails,
        clubManagementMode: clubs.clubManagementMode,
        clubSelectorOpen: clubs.clubSelectorOpen,
        clubSearchTerm: clubs.clubSearchTerm,
        joinableClubs: clubs.joinableClubs,
        selectedJoinClub: clubs.selectedJoinClub,
        selectedJoinClubMembers: clubs.selectedJoinClubMembers,
        createClubName: clubs.createClubName,
        createClubDescription: clubs.createClubDescription,
        createClubVibe: clubs.createClubVibe,
        clubActionLoading: clubs.clubActionLoading,
        clubActionError: clubs.clubActionError,
        favoriteBooksCount: library.favoriteBooks.length,
        finishedBooksCount: library.clubFinishedBooks.length,
        finishedBooks: library.clubFinishedBooks,
        booksLoading: library.booksLoading,
        booksError: library.booksError,
        showSwitchClub: clubs.clubs.length > 1,
        discussionQuestions: discussionQuestionsVisible ? discussionQuestions : [],
        discussionQuestionsLoading,
        clubInsight,
        clubInsightLoading,
      },
      actions: {
        onOpenCreateClub: () => clubs.setClubManagementMode("create"),
        onOpenJoinClub: () => clubs.setClubManagementMode("join"),
        onOpenSwitchClub: () => clubs.setClubSelectorOpen(true),
        onCloseClubManagement: () => clubs.setClubManagementMode("overview"),
        onToggleClubSelector: () => clubs.setClubSelectorOpen((open) => !open),
        onSelectClub: clubs.selectClub,
        onMarkCurrentBookFinished: () => {
          if (!currentClubBookDetails) {
            return;
          }

          void library.markBookFinished(currentClubBookDetails.id).catch((error) => {
            Alert.alert("Could not mark book as finished", error instanceof Error ? error.message : "Try again.");
          });
        },
        onGenerateQuestions: () => void handleGenerateQuestions(),
        onOpenPickNext: () => navigation.setScreen("pick-next"),
        onAddSampleBook: () => void handleAddSampleBook(),
        onClubSearchTermChange: clubs.setClubSearchTerm,
        onSelectJoinClub: clubs.setSelectedJoinClubId,
        onCreateClubNameChange: clubs.setCreateClubName,
        onCreateClubDescriptionChange: clubs.setCreateClubDescription,
        onCreateClubVibeChange: clubs.setCreateClubVibe,
        onCreateClub: () => void clubs.createClub(),
        onJoinSelectedClub: () => void clubs.joinSelectedClub(),
        onSignIn: navigation.goToLogin,
        onSignUp: navigation.goToSignup,
      },
    },
    search: {
      model: {
        searchTerm: search.searchTerm,
        searchLoading: search.isSearching,
        filteredSearchBooks: search.filteredSearchBooks,
        selectedSearchBook: search.selectedSearchBook,
        savedSearchBookIds: search.savedSearchBookIds,
        savedSearchBookKeys: search.savedSearchBookKeys,
        currentPickedBookId: library.currentClubBookId,
        currentPickedBookKeys,
      },
      actions: {
        onSearchTermChange: search.setSearchTerm,
        onSelectBook: search.setSelectedSearchBookId,
        onCloseBookDetails: () => search.setSelectedSearchBookId(null),
        onToggleSaveBook: search.toggleSaveSearchBook,
        onAddSearchBookToWantToRead: (book) => {
          return library.persistBook(book).then(() => undefined).catch((error) => {
            Alert.alert("Could not add book", error instanceof Error ? error.message : "Try again.");
          });
        },
        onMarkSearchBookFinished: (book) => {
          return (async () => {
            const savedBook = await library.persistBook(book);
            await library.markBookFinished(savedBook.id);
          })().catch((error) => {
            Alert.alert("Could not mark book as finished", error instanceof Error ? error.message : "Try again.");
          });
        },
        onPickSearchBookForClub: (book) => {
          return (async () => {
            const savedBook = await library.persistBook(book);
            await library.togglePickBookForClub(savedBook.id);
          })().catch((error) => {
            Alert.alert("Could not pick book for club", error instanceof Error ? error.message : "Try again.");
          });
        },
      },
    },
    pickNext: {
      model: {
        pickMode: pickNext.pickMode,
        selectedClub: clubs.selectedClub,
        currentClubBook: library.currentClubBookTitle,
        randomizerPool: pickNext.randomizerPool,
        randomizerResult: pickNext.randomizerResult,
        randomizerRunCount: pickNext.randomizerRunCount,
        wheelBooks: pickNext.wheelBooks,
        wheelBookInput: pickNext.wheelBookInput,
        wheelSearchResults: pickNext.wheelSearchResults,
        wheelSearchLoading: pickNext.wheelSearchLoading,
        selectedWheelBookId: pickNext.selectedWheelBookId,
        wheelSpinning: pickNext.wheelSpinning,
        wheelResult: pickNext.wheelResult,
        wheelWinnerIndex: pickNext.wheelWinnerIndex,
        wheelRotation: pickNext.wheelRotation,
        wheelSlices: pickNext.wheelSlices,
        defaultWheelSlices: pickNext.defaultWheelSlices,
        maxWheelBooks: pickNext.maxWheelBooks,
        aiPickerPrompt: pickNext.aiPickerPrompt,
        aiPickerGenerated: pickNext.aiPickerGenerated,
        aiPickerRecommendations,
        aiPickerExplanation,
        aiPickerSource,
        aiPickerLoading,
        wheelEngine,
        currentPickedBookId: library.currentClubBookId,
        currentPickedBookKeys,
      },
      actions: {
        onPickModeChange: pickNext.setPickMode,
        onRunRandomizer: pickNext.runRandomizer,
        onWheelBookInputChange: pickNext.setWheelBookInput,
        onSelectWheelBook: pickNext.setSelectedWheelBookId,
        onAddWheelBook: pickNext.addWheelBook,
        onRemoveWheelBook: pickNext.removeWheelBook,
        onSpinWheel: pickNext.spinWheel,
        onAiPromptChange: pickNext.updateAiPrompt,
        onGenerateAiPick: () => void handleGenerateAiPick(),
        onAddSuggestedBookToWantToRead: (book) => {
          return library.persistBook(book).then(() => undefined).catch((error) => {
            Alert.alert("Could not add book", error instanceof Error ? error.message : "Try again.");
          });
        },
        onPickSuggestedBookForClub: (book) => {
          return (async () => {
            const savedBook = await library.persistBook(book);
            await library.togglePickBookForClub(savedBook.id);
          })().catch((error) => {
            Alert.alert("Could not pick book for club", error instanceof Error ? error.message : "Try again.");
          });
        },
      },
    },
    library: {
      model: {
        authUser: auth.authUser,
        booksLoading: library.booksLoading,
        booksError: library.booksError,
        currentReadingEntry: library.currentReadingEntry,
        favoriteEntries: library.libraryEntries.filter(
          (entry) =>
            entry.status !== "finished" &&
            entry.status !== "removed" &&
            !(entry.isCurrentRead || entry.status === "current")
        ),
        finishedEntries: library.finishedEntries,
        clubFinishedEntries: library.clubFinishedEntries,
        favoriteBooks: library.favoriteBooks,
        finishedBooks: library.finishedBooks,
        clubFinishedBooks: library.clubFinishedBooks,
        guestLibraryBooks,
        currentPickedBookId: library.currentClubBookId,
      },
      actions: {
        onSignIn: navigation.goToLogin,
        onSignUp: navigation.goToSignup,
        onRemoveBook: (bookId) => {
          return library.removeBook(bookId).catch((error) => {
            Alert.alert("Could not remove book", error instanceof Error ? error.message : "Try again.");
          });
        },
        onMarkAsRead: (bookId) => {
          return library.markBookFinished(bookId).then(() => undefined).catch((error) => {
            Alert.alert("Could not mark book as read", error instanceof Error ? error.message : "Try again.");
          });
        },
        onMarkAsSaved: (bookId) => {
          return library.markBookSaved(bookId).then(() => undefined).catch((error) => {
            Alert.alert("Could not move book to active shelf", error instanceof Error ? error.message : "Try again.");
          });
        },
        onPickForClub: (bookId) => {
          return library.togglePickBookForClub(bookId).then(() => undefined).catch((error) => {
            Alert.alert("Could not set next read", error instanceof Error ? error.message : "Try again.");
          });
        },
      },
    },
    profile: {
      model: {
        authUser: auth.authUser,
        selectedClubName: clubs.selectedClub?.name || "None selected",
        clubsCount: clubs.clubs.length,
        favoriteBooksCount: library.favoriteBooks.length,
        emailAuthMode: auth.emailAuthMode,
        authLoading: auth.authLoading,
        hasGoogleRequest: Boolean(auth.googleRequest),
        name: auth.name,
        email: auth.email,
        password: auth.password,
      },
      actions: {
        onSignOut: handleSignOut,
        onStartGoogleSignIn: () => void auth.startGoogleSignIn(),
        onEmailModeChange: auth.setEmailAuthMode,
        onNameChange: auth.setName,
        onEmailChange: auth.setEmail,
        onPasswordChange: auth.setPassword,
        onFinishEmailAuth: () => void auth.finishEmailAuth(),
      },
    },
  };

  return {
    header,
    navigation: {
      ...navigation,
      setScreen: handleScreenChange,
    },
    views,
  };
}
