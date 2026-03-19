import type { Animated } from "react-native";
import type { DefaultWheelSlice, WheelSlice, WheelEngine } from "../domain/WheelEngine";
import type { AuthUser, Book, Club, ClubLibraryEntry, ClubMember, Recommendation } from "../types";
import type { ClubInsight } from "../services/clubs";

export type HomeScreenModel = {
  authUser: AuthUser | null;
  selectedClub?: Club;
  selectedClubMembersCount: number;
  favoriteBooksCount: number;
  personalizedRecommendations: Recommendation[];
  currentClubBookDetails: Book | null;
  aiPickerPrompt: string;
  aiPickerGenerated: boolean;
  aiPickerRecommendations: Recommendation[];
  aiPickerExplanation: string | null;
  aiPickerSource: string | null;
  aiPickerLoading: boolean;
};

export type HomeScreenActions = {
  onAiPromptChange: (value: string) => void;
  onGenerateAiPick: () => void;
  onAddHomeAiPickToWantToRead: (book: Book) => Promise<void>;
  onAddPersonalizedPickToWantToRead: (book: Book) => Promise<void>;
  onOpenClubs: () => void;
  onOpenLibrary: () => void;
  onOpenPickNext: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
};

export type HomeScreenView = {
  model: HomeScreenModel;
  actions: HomeScreenActions;
};

export type ClubsScreenModel = {
  authUser: AuthUser | null;
  clubs: Club[];
  selectedClub?: Club;
  selectedClubMembers: ClubMember[];
  currentClubBook: string;
  currentClubBookDetails: Book | null;
  clubManagementMode: "overview" | "create" | "join";
  clubSelectorOpen: boolean;
  clubSearchTerm: string;
  joinableClubs: Club[];
  selectedJoinClub?: Club;
  selectedJoinClubMembers: ClubMember[];
  createClubName: string;
  createClubDescription: string;
  createClubVibe: string;
  clubActionLoading: boolean;
  clubActionError: string | null;
  favoriteBooksCount: number;
  finishedBooksCount: number;
  finishedBooks: Book[];
  booksLoading: boolean;
  booksError: string | null;
  showSwitchClub: boolean;
  discussionQuestions: string[];
  discussionQuestionsLoading: boolean;
  clubInsight: ClubInsight | null;
  clubInsightLoading: boolean;
};

export type ClubsScreenActions = {
  onOpenCreateClub: () => void;
  onOpenJoinClub: () => void;
  onOpenSwitchClub: () => void;
  onCloseClubManagement: () => void;
  onToggleClubSelector: () => void;
  onSelectClub: (clubId: string) => void;
  onMarkCurrentBookFinished: () => void;
  onGenerateQuestions: () => void;
  onOpenPickNext: () => void;
  onAddSampleBook: () => void;
  onClubSearchTermChange: (value: string) => void;
  onSelectJoinClub: (clubId: string) => void;
  onCreateClubNameChange: (value: string) => void;
  onCreateClubDescriptionChange: (value: string) => void;
  onCreateClubVibeChange: (value: string) => void;
  onCreateClub: () => void;
  onJoinSelectedClub: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
};

export type ClubsScreenView = {
  model: ClubsScreenModel;
  actions: ClubsScreenActions;
};

export type SearchScreenModel = {
  searchTerm: string;
  filteredSearchBooks: Book[];
  selectedSearchBook: Book | null;
  savedSearchBookIds: string[];
  savedSearchBookKeys: string[];
  currentPickedBookId: string | null;
  currentPickedBookKeys: string[];
};

export type SearchScreenActions = {
  onSearchTermChange: (value: string) => void;
  onSelectBook: (bookId: string) => void;
  onCloseBookDetails: () => void;
  onToggleSaveBook: (book: Book) => void;
  onAddSearchBookToWantToRead: (book: Book) => Promise<void>;
  onMarkSearchBookFinished: (book: Book) => Promise<void>;
  onPickSearchBookForClub: (book: Book) => Promise<void>;
};

export type SearchScreenView = {
  model: SearchScreenModel;
  actions: SearchScreenActions;
};

export type LibraryScreenModel = {
  authUser: AuthUser | null;
  booksLoading: boolean;
  booksError: string | null;
  currentReadingEntry: ClubLibraryEntry | null;
  favoriteEntries: ClubLibraryEntry[];
  finishedEntries: ClubLibraryEntry[];
  clubFinishedEntries: ClubLibraryEntry[];
  favoriteBooks: Book[];
  finishedBooks: Book[];
  clubFinishedBooks: Book[];
  guestLibraryBooks: Book[];
  currentPickedBookId: string | null;
};

export type LibraryScreenActions = {
  onSignIn: () => void;
  onSignUp: () => void;
  onRemoveBook: (bookId: string) => Promise<void>;
  onMarkAsRead: (bookId: string) => Promise<void>;
  onMarkAsSaved: (bookId: string) => Promise<void>;
  onPickForClub: (bookId: string) => Promise<void>;
};

export type LibraryScreenView = {
  model: LibraryScreenModel;
  actions: LibraryScreenActions;
};

export type ProfileScreenModel = {
  authUser: AuthUser | null;
  selectedClubName: string;
  clubsCount: number;
  favoriteBooksCount: number;
  emailAuthMode: "signup" | "login";
  authLoading: boolean;
  hasGoogleRequest: boolean;
  name: string;
  email: string;
  password: string;
};

export type ProfileScreenActions = {
  onSignOut: () => void;
  onStartGoogleSignIn: () => void;
  onEmailModeChange: (mode: "signup" | "login") => void;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onFinishEmailAuth: () => void;
};

export type ProfileScreenView = {
  model: ProfileScreenModel;
  actions: ProfileScreenActions;
};

export type PickNextScreenModel = {
  pickMode: "randomizer" | "wheel" | "ai";
  selectedClub?: Club;
  currentClubBook: string;
  randomizerPool: Book[];
  randomizerResult: Book | null;
  randomizerRunCount: number;
  wheelBooks: Book[];
  wheelBookInput: string;
  wheelSearchResults: Book[];
  selectedWheelBookId: string | null;
  wheelSpinning: boolean;
  wheelResult: Book | null;
  wheelWinnerIndex: number | null;
  wheelRotation: Animated.AnimatedInterpolation<string>;
  wheelSlices: WheelSlice[];
  defaultWheelSlices: DefaultWheelSlice[];
  maxWheelBooks: number;
  aiPickerPrompt: string;
  aiPickerGenerated: boolean;
  aiPickerRecommendations: Recommendation[];
  aiPickerExplanation: string | null;
  aiPickerSource: string | null;
  aiPickerLoading: boolean;
  wheelEngine: WheelEngine;
  currentPickedBookId: string | null;
  currentPickedBookKeys: string[];
};

export type PickNextScreenActions = {
  onPickModeChange: (mode: "randomizer" | "wheel" | "ai") => void;
  onRunRandomizer: () => void;
  onWheelBookInputChange: (value: string) => void;
  onSelectWheelBook: (bookId: string) => void;
  onAddWheelBook: () => void;
  onRemoveWheelBook: (bookId: string) => void;
  onSpinWheel: () => void;
  onAiPromptChange: (value: string) => void;
  onGenerateAiPick: () => void;
  onAddSuggestedBookToWantToRead: (book: Book) => Promise<void>;
  onPickSuggestedBookForClub: (book: Book) => Promise<void>;
};

export type PickNextScreenView = {
  model: PickNextScreenModel;
  actions: PickNextScreenActions;
};

export type AppScreenViews = {
  home: HomeScreenView;
  clubs: ClubsScreenView;
  search: SearchScreenView;
  pickNext: PickNextScreenView;
  library: LibraryScreenView;
  profile: ProfileScreenView;
};
