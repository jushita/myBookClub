import type { Animated } from "react-native";
import type { DefaultWheelSlice, WheelSlice, WheelEngine } from "../domain/WheelEngine";
import type { AuthUser, Book, Club, ClubMember, Recommendation } from "../types";

export type HomeScreenModel = {
  authUser: AuthUser | null;
  selectedClub?: Club;
  selectedClubMembersCount: number;
  favoriteBooksCount: number;
  aiPickerPrompt: string;
  aiPickerGenerated: boolean;
  aiPickerRecommendations: Recommendation[];
};

export type HomeScreenActions = {
  onAiPromptChange: (value: string) => void;
  onGenerateAiPick: () => void;
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
  booksLoading: boolean;
  booksError: string | null;
};

export type ClubsScreenActions = {
  onOpenCreateClub: () => void;
  onOpenJoinClub: () => void;
  onCloseClubManagement: () => void;
  onToggleClubSelector: () => void;
  onSelectClub: (clubId: string) => void;
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
};

export type SearchScreenActions = {
  onSearchTermChange: (value: string) => void;
  onSelectBook: (bookId: string) => void;
  onToggleSaveBook: (book: Book) => void;
};

export type SearchScreenView = {
  model: SearchScreenModel;
  actions: SearchScreenActions;
};

export type LibraryScreenModel = {
  authUser: AuthUser | null;
  booksLoading: boolean;
  booksError: string | null;
  favoriteBooks: Book[];
  guestLibraryBooks: Book[];
};

export type LibraryScreenActions = {
  onSignIn: () => void;
  onSignUp: () => void;
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
  wheelBooks: string[];
  wheelBookInput: string;
  wheelSpinning: boolean;
  wheelResult: string | null;
  wheelWinnerIndex: number | null;
  wheelRotation: Animated.AnimatedInterpolation<string>;
  wheelSlices: WheelSlice[];
  defaultWheelSlices: DefaultWheelSlice[];
  maxWheelBooks: number;
  aiPickerPrompt: string;
  aiPickerGenerated: boolean;
  aiPickerRecommendations: Recommendation[];
  wheelEngine: WheelEngine;
};

export type PickNextScreenActions = {
  onPickModeChange: (mode: "randomizer" | "wheel" | "ai") => void;
  onRunRandomizer: () => void;
  onWheelBookInputChange: (value: string) => void;
  onAddWheelBook: () => void;
  onRemoveWheelBook: (book: string) => void;
  onSpinWheel: () => void;
  onAiPromptChange: (value: string) => void;
  onGenerateAiPick: () => void;
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
