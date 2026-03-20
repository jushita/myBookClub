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
  const [catalogBooks, setCatalogBooks] = useState<Book[]>([]);
  const [discussionQuestions, setDiscussionQuestions] = useState<string[]>([]);
  const [discussionQuestionsLoading, setDiscussionQuestionsLoading] = useState(false);
  const [discussionQuestionsVisible, setDiscussionQuestionsVisible] = useState(false);
  const [clubInsight, setClubInsight] = useState<ClubInsight | null>(null);
  const [clubInsightLoading, setClubInsightLoading] = useState(false);
  const personalizedRotationSeed = useRef<number>(Date.now()).current;
  const discussionRequestRef = useRef<Promise<{ currentBookId: string | null; questions: string[] }> | null>(null);

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
    guestLibraryBooks,
    library.favoriteBooks,
    auth.authUser,
    aiPickerRecommendations,
    wheelEngine,
    searchBooksFromApi
  );

  useEffect(() => {
    setAiPickerRecommendations([]);
    setAiPickerExplanation(null);
    setAiPickerSource(null);
    setAiPickerLoading(false);
  }, [clubs.selectedClub]);

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
    const query = pickNext.aiPickerPrompt.trim() || clubs.selectedClub?.promptSeed || "book club taste";
    setAiPickerLoading(true);

    try {
      const recommendationResult = await fetchRecommendedBooks(query, 6);
      setAiPickerRecommendations(recommendationResult.recommendations);
      setAiPickerExplanation(recommendationResult.explanation);
      setAiPickerSource(recommendationResult.source);
      pickNext.generateAiPick();

      if (recommendationResult.recommendations.length === 0) {
        Alert.alert("No recommendations found", "Try a broader prompt or add more books to the catalog.");
      }
    } catch (error) {
      setAiPickerRecommendations([]);
      setAiPickerExplanation(null);
      setAiPickerSource(null);
      pickNext.generateAiPick();
      Alert.alert(
        "Recommendation request failed",
        error instanceof Error ? error.message : "The backend recommendation service is unavailable."
      );
    } finally {
      setAiPickerLoading(false);
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
