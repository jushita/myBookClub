import * as WebBrowser from "expo-web-browser";
import { Alert } from "react-native";
import { useEffect, useMemo, useRef } from "react";
import { MOCK_BOOKS, MOCK_RECOMMENDATIONS } from "../data/mockData";
import { RecommendationEngine } from "../domain/RecommendationEngine";
import { WheelEngine } from "../domain/WheelEngine";
import { saveBookToClub } from "../services/clubs";
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
  const recommendationEngine = useMemo(() => new RecommendationEngine(MOCK_RECOMMENDATIONS), []);
  const wheelEngine = useMemo(() => new WheelEngine(), []);
  const guestLibraryBooks = useMemo<Book[]>(() => MOCK_BOOKS, []);

  const auth = useAuthFlow();
  const navigation = useAppNavigation(auth.setEmailAuthMode);
  const clubs = useClubState(auth.authUser);
  const library = useBookLibrary(auth.authUser, clubs.selectedClub, clubs.setCurrentClubBook);
  const previousAuthUserId = useRef<string | null>(null);

  useEffect(() => {
    const currentAuthUserId = auth.authUser?.id ?? null;

    if (!previousAuthUserId.current && currentAuthUserId) {
      navigation.setScreen("clubs");
    }

    previousAuthUserId.current = currentAuthUserId;
  }, [auth.authUser, navigation]);

  const clubRecommendations = useMemo(() => {
    return recommendationEngine.buildClubRecommendations(
      clubs.selectedClub?.promptSeed || "cozy mystery for a rainy weekend",
      clubs.selectedClub
    );
  }, [clubs.selectedClub, recommendationEngine]);

  const search = useSearchCatalog(
    recommendationEngine,
    guestLibraryBooks,
    library.favoriteBooks,
    clubRecommendations,
    library.setFavoriteBooks,
    async (book) => {
      if (!auth.authUser || !clubs.selectedClub) {
        return;
      }

      try {
        await saveBookToClub(clubs.selectedClub.id, auth.authUser.id, book);
        library.setBooksError(null);
      } catch (error) {
        Alert.alert("Could not save book", error instanceof Error ? error.message : "Try again.");
      }
    }
  );

  const pickNext = usePickNext(
    clubs.selectedClub,
    clubs.selectedClubMembers.length,
    guestLibraryBooks,
    library.favoriteBooks,
    auth.authUser,
    recommendationEngine.buildAiRecommendations(clubs.selectedClub?.promptSeed || "club taste", clubs.selectedClub),
    wheelEngine
  );

  const aiPickerRecommendations = useMemo(() => {
    const query = pickNext.aiPickerPrompt.trim() || clubs.selectedClub?.promptSeed || "club taste";
    return recommendationEngine.buildAiRecommendations(query, clubs.selectedClub);
  }, [clubs.selectedClub, pickNext.aiPickerPrompt, recommendationEngine]);

  const header = useHeaderContent(navigation.screen, auth.authUser, clubs.selectedClub);

  const handleAddSampleBook = async () => {
    await library.addSampleBook(() => navigation.setScreen("library"));
  };

  const handleGenerateQuestions = () => {
    Alert.alert("Discussion questions", "Question generation can be wired next.");
  };

  const handleSignOut = () => {
    auth.setAuthToken(null);
    auth.signOut();
    library.resetLibrary();
  };

  const views: AppScreenViews = {
    home: {
      model: {
        authUser: auth.authUser,
        selectedClub: clubs.selectedClub,
        selectedClubMembersCount: clubs.selectedClubMembers.length + (auth.authUser ? 1 : 0),
        favoriteBooksCount: library.favoriteBooks.length,
        aiPickerPrompt: pickNext.aiPickerPrompt,
        aiPickerGenerated: pickNext.aiPickerGenerated,
        aiPickerRecommendations,
      },
      actions: {
        onAiPromptChange: pickNext.updateAiPrompt,
        onGenerateAiPick: pickNext.generateAiPick,
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
        currentClubBook: clubs.currentClubBook,
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
        booksLoading: library.booksLoading,
        booksError: library.booksError,
      },
      actions: {
        onOpenCreateClub: () => clubs.setClubManagementMode("create"),
        onOpenJoinClub: () => clubs.setClubManagementMode("join"),
        onCloseClubManagement: () => clubs.setClubManagementMode("overview"),
        onToggleClubSelector: () => clubs.setClubSelectorOpen((open) => !open),
        onSelectClub: clubs.selectClub,
        onGenerateQuestions: handleGenerateQuestions,
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
        filteredSearchBooks: search.filteredSearchBooks,
        selectedSearchBook: search.selectedSearchBook,
        savedSearchBookIds: search.savedSearchBookIds,
      },
      actions: {
        onSearchTermChange: search.setSearchTerm,
        onSelectBook: search.setSelectedSearchBookId,
        onToggleSaveBook: search.toggleSaveSearchBook,
      },
    },
    pickNext: {
      model: {
        pickMode: pickNext.pickMode,
        selectedClub: clubs.selectedClub,
        currentClubBook: clubs.currentClubBook,
        randomizerPool: pickNext.randomizerPool,
        randomizerResult: pickNext.randomizerResult,
        randomizerRunCount: pickNext.randomizerRunCount,
        wheelBooks: pickNext.wheelBooks,
        wheelBookInput: pickNext.wheelBookInput,
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
        wheelEngine,
      },
      actions: {
        onPickModeChange: pickNext.setPickMode,
        onRunRandomizer: pickNext.runRandomizer,
        onWheelBookInputChange: pickNext.setWheelBookInput,
        onAddWheelBook: pickNext.addWheelBook,
        onRemoveWheelBook: pickNext.removeWheelBook,
        onSpinWheel: pickNext.spinWheel,
        onAiPromptChange: pickNext.updateAiPrompt,
        onGenerateAiPick: pickNext.generateAiPick,
      },
    },
    library: {
      model: {
        authUser: auth.authUser,
        booksLoading: library.booksLoading,
        booksError: library.booksError,
        favoriteBooks: library.favoriteBooks,
        guestLibraryBooks,
      },
      actions: {
        onSignIn: navigation.goToLogin,
        onSignUp: navigation.goToSignup,
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
    navigation,
    views,
  };
}
