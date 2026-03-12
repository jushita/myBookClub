import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Animated, Easing, SafeAreaView, ScrollView, StatusBar, View } from "react-native";
import { NavButton } from "./components/common/NavButton";
import { AppHeader } from "./components/layout/AppHeader";
import { ClubsScreen } from "./components/screens/ClubsScreen";
import { HomeScreen } from "./components/screens/HomeScreen";
import { LibraryScreen } from "./components/screens/LibraryScreen";
import { PickNextScreen } from "./components/screens/PickNextScreen";
import { ProfileScreen } from "./components/screens/ProfileScreen";
import { SearchScreen } from "./components/screens/SearchScreen";
import { MOCK_BOOKS, MOCK_CLUBS, MOCK_RECOMMENDATIONS, MOCK_USERS } from "./data/mockData";
import { RecommendationEngine } from "./domain/RecommendationEngine";
import { WheelEngine } from "./domain/WheelEngine";
import { loginWithEmail, loginWithSocial, signUpWithEmail } from "./services/auth";
import { createBook, fetchBooks } from "./services/api";
import { appStyles } from "./styles/appStyles";
import type { AuthUser, Book, Club, ClubMember } from "./types";

WebBrowser.maybeCompleteAuthSession();

type Screen = "home" | "clubs" | "search" | "library" | "profile" | "pick-next";
type EmailAuthMode = "signup" | "login";
type PickMode = "randomizer" | "wheel" | "ai";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [members] = useState<ClubMember[]>(MOCK_USERS);
  const [clubs] = useState<Club[]>(MOCK_CLUBS);
  const [selectedClubId, setSelectedClubId] = useState<string>(MOCK_CLUBS[0]?.id ?? "");
  const [clubSelectorOpen, setClubSelectorOpen] = useState(false);
  const [favoriteBooks, setFavoriteBooks] = useState<Book[]>([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [booksError, setBooksError] = useState<string | null>(null);
  const [emailAuthMode, setEmailAuthMode] = useState<EmailAuthMode>("signup");
  const [pickMode, setPickMode] = useState<PickMode>("randomizer");
  const [aiPickerPrompt, setAiPickerPrompt] = useState("");
  const [aiPickerGenerated, setAiPickerGenerated] = useState(false);
  const [wheelBookInput, setWheelBookInput] = useState("");
  const [wheelBooks, setWheelBooks] = useState<string[]>([]);
  const [wheelResult, setWheelResult] = useState<string | null>(null);
  const [wheelWinnerIndex, setWheelWinnerIndex] = useState<number | null>(null);
  const [wheelSpinTarget, setWheelSpinTarget] = useState(360 * 5);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [randomizerResult, setRandomizerResult] = useState<Book | null>(null);
  const [randomizerRunCount, setRandomizerRunCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSearchBookId, setSelectedSearchBookId] = useState<string | null>(null);
  const [savedSearchBookIds, setSavedSearchBookIds] = useState<string[]>([]);
  const [authLoading, setAuthLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const recommendationEngine = useMemo(() => new RecommendationEngine(MOCK_RECOMMENDATIONS), []);
  const wheelEngine = useMemo(() => new WheelEngine(), []);
  const wheelSpin = React.useRef(new Animated.Value(0)).current;

  const selectedClub = useMemo(() => {
    return clubs.find((club) => club.id === selectedClubId) ?? clubs[0];
  }, [clubs, selectedClubId]);

  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  const [googleRequest, googleResponse, promptGoogle] = Google.useAuthRequest({
    iosClientId: googleIosClientId,
    androidClientId: googleAndroidClientId,
    webClientId: googleWebClientId,
    scopes: ["openid", "profile", "email"],
    selectAccount: true,
  });

  const clubRecommendations = useMemo(() => {
    return recommendationEngine.buildClubRecommendations(
      selectedClub?.promptSeed || "cozy mystery for a rainy weekend",
      selectedClub
    );
  }, [recommendationEngine, selectedClub]);

  const aiPickerQuery = aiPickerPrompt.trim() || selectedClub?.promptSeed || "club taste";
  const aiPickerRecommendations = useMemo(() => {
    return recommendationEngine.buildAiRecommendations(aiPickerQuery, selectedClub);
  }, [aiPickerQuery, recommendationEngine, selectedClub]);

  const guestLibraryBooks = useMemo<Book[]>(() => MOCK_BOOKS, []);
  const searchBooks = useMemo(() => {
    return recommendationEngine.mergeCatalog(guestLibraryBooks, favoriteBooks, clubRecommendations);
  }, [clubRecommendations, favoriteBooks, guestLibraryBooks, recommendationEngine]);

  const filteredSearchBooks = useMemo(() => {
    return recommendationEngine.filterCatalog(searchBooks, searchTerm);
  }, [recommendationEngine, searchBooks, searchTerm]);

  const selectedSearchBook = useMemo<Book | null>(() => {
    if (!selectedSearchBookId) {
      return filteredSearchBooks[0] ?? searchBooks[0] ?? null;
    }

    return searchBooks.find((book) => book.id === selectedSearchBookId) ?? null;
  }, [filteredSearchBooks, searchBooks, selectedSearchBookId]);

  const randomizerPool = useMemo(() => {
    if (authUser && favoriteBooks.length > 0) {
      return favoriteBooks;
    }

    return guestLibraryBooks;
  }, [authUser, favoriteBooks, guestLibraryBooks]);

  const selectedClubMembers = useMemo(() => {
    if (!selectedClub) {
      return members;
    }

    return members.filter((member) => selectedClub.memberIds.includes(member.id));
  }, [members, selectedClub]);

  const currentClubBook = useMemo(() => {
    if (!selectedClub) {
      return "The Maid";
    }

    const clubBooks: Record<string, string> = {
      c1: "The Maid",
      c2: "The House in the Cerulean Sea",
      c3: "Rebecca",
    };

    return clubBooks[selectedClub.id] || "The Maid";
  }, [selectedClub]);

  const maxWheelBooks = Math.max(selectedClubMembers.length, 3);
  const wheelRotation = wheelSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", `${wheelSpinTarget}deg`],
  });

  const wheelSlices = useMemo(() => wheelEngine.buildSlices(wheelBooks), [wheelBooks, wheelEngine]);
  const defaultWheelSlices = useMemo(() => wheelEngine.buildDefaultSlices(), [wheelEngine]);

  const headerContent = useMemo(() => {
    const isCompact = screen === "search" || screen === "library";

    return {
      kicker: isCompact || screen === "clubs" ? "My Book Club" : "AI-Powered Book Club",
      title: isCompact
        ? null
        : screen === "clubs"
          ? authUser
            ? selectedClub?.name || "My Book Club"
            : "Clubs"
          : screen === "pick-next"
            ? "Pick Next Book"
            : "My Book Club",
      subtitle: isCompact
        ? null
        : screen === "clubs"
          ? authUser
            ? `Currently tuned to ${selectedClub?.vibe.toLowerCase() || "your club mood"}.`
            : "Join a club, create a club, and unlock shared reading experiences."
          : screen === "pick-next"
            ? `Three ways to choose the next read for ${selectedClub?.name || "your club"}.`
            : "Discover standout reads, explore genre moods, and build a smarter shared shelf.",
    };
  }, [authUser, screen, selectedClub]);

  useEffect(() => {
    if (!selectedClub) {
      return;
    }

    setAiPickerGenerated(false);
    setRandomizerResult(null);
    setRandomizerRunCount(0);
    setWheelBookInput("");
    setWheelBooks([]);
    setWheelResult(null);
    setWheelWinnerIndex(null);
    setWheelSpinTarget(360 * 5);
    wheelSpin.stopAnimation();
    wheelSpin.setValue(0);
  }, [selectedClub, wheelSpin]);

  useEffect(() => {
    if (!authUser) {
      return;
    }

    let ignore = false;

    const loadBooks = async () => {
      setBooksLoading(true);
      setBooksError(null);

      try {
        const books = await fetchBooks();
        if (!ignore) {
          setFavoriteBooks(books);
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
  }, [authUser]);

  useEffect(() => {
    const accessToken =
      googleResponse?.type === "success" ? googleResponse.authentication?.accessToken : null;

    if (!accessToken) {
      return;
    }

    void finishGoogleSignIn(accessToken);
  }, [googleResponse]);

  const goToLogin = () => {
    setEmailAuthMode("login");
    setScreen("profile");
  };

  const goToSignup = () => {
    setEmailAuthMode("signup");
    setScreen("profile");
  };

  const addSampleBook = async () => {
    try {
      const nextBook = await createBook({
        title: "The House in the Cerulean Sea",
        author: "TJ Klune",
        genre: "Fantasy",
        description: "Warm character-driven pick for the club shortlist.",
      });

      setFavoriteBooks((current) => [nextBook, ...current]);
      setScreen("library");
      setBooksError(null);
    } catch (error) {
      Alert.alert(
        "Could not save book",
        error instanceof Error ? error.message : "The API is unavailable."
      );
    }
  };

  const finishEmailAuth = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail.includes("@")) {
      Alert.alert("Email required", "Enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      Alert.alert("Password too short", "Use at least 8 characters.");
      return;
    }

    if (emailAuthMode === "signup" && !trimmedName) {
      Alert.alert("Name required", "Enter your name to create the account.");
      return;
    }

    try {
      setAuthLoading(true);

      const payload =
        emailAuthMode === "signup"
          ? await signUpWithEmail({
              name: trimmedName,
              email: trimmedEmail,
              password,
            })
          : await loginWithEmail({
              email: trimmedEmail,
              password,
            });

      setAuthUser(payload.user);
      setAuthToken(payload.token);
      setName("");
      setEmail("");
      setPassword("");
    } catch (error) {
      Alert.alert("Authentication failed", error instanceof Error ? error.message : "Try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const finishGoogleSignIn = async (accessToken: string) => {
    try {
      setAuthLoading(true);

      const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Could not load Google profile.");
      }

      const profile = (await response.json()) as {
        sub?: string;
        email?: string;
        name?: string;
      };

      if (!profile.email || !profile.name) {
        throw new Error("Google account did not return name and email.");
      }

      const payload = await loginWithSocial({
        provider: "google",
        email: profile.email,
        name: profile.name,
        providerUserId: profile.sub,
      });

      setAuthUser(payload.user);
      setAuthToken(payload.token);
    } catch (error) {
      Alert.alert("Google sign-in failed", error instanceof Error ? error.message : "Try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const startGoogleSignIn = async () => {
    if (!googleIosClientId || !googleAndroidClientId || !googleWebClientId) {
      Alert.alert(
        "Missing Google client IDs",
        "Set the iOS, Android, and web Google client IDs in my-book-club-ui/.env."
      );
      return;
    }

    await promptGoogle();
  };

  const signOut = () => {
    setAuthUser(null);
    setAuthToken(null);
    setFavoriteBooks([]);
    setBooksError(null);
  };

  const generateAiPick = () => {
    setAiPickerGenerated(true);
  };

  const runRandomizer = () => {
    if (randomizerPool.length === 0) {
      Alert.alert("No books to randomize", "Add or load books before running the randomizer.");
      return;
    }

    const pickedBook = randomizerPool[Math.floor(Math.random() * randomizerPool.length)];
    setRandomizerResult(pickedBook);
    setRandomizerRunCount((count) => count + 1);
  };

  const toggleSaveSearchBook = (book: Book) => {
    const isSaved = savedSearchBookIds.includes(book.id);

    setSavedSearchBookIds((current) =>
      isSaved ? current.filter((id) => id !== book.id) : [...current, book.id]
    );

    if (!isSaved) {
      setFavoriteBooks((current) => {
        if (current.some((savedBook) => savedBook.id === book.id)) {
          return current;
        }

        return [book, ...current];
      });
    }
  };

  const addWheelBook = () => {
    const trimmed = wheelBookInput.trim();

    if (!trimmed) {
      Alert.alert("Book name required", "Enter a book title to add it to the wheel.");
      return;
    }

    if (wheelBooks.length >= maxWheelBooks) {
      Alert.alert("Wheel is full", `You can add up to ${maxWheelBooks} books for this club.`);
      return;
    }

    if (wheelBooks.some((book) => book.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert("Already added", "That book is already on the wheel.");
      return;
    }

    setWheelBooks((current) => [...current, trimmed]);
    setWheelBookInput("");
    setWheelResult(null);
    setWheelWinnerIndex(null);
  };

  const removeWheelBook = (bookToRemove: string) => {
    if (wheelSpinning) {
      return;
    }

    setWheelBooks((current) => current.filter((book) => book !== bookToRemove));
    setWheelResult((current) => (current === bookToRemove ? null : current));
    setWheelWinnerIndex(null);
  };

  const spinWheel = () => {
    if (wheelBooks.length < 3 || wheelSpinning) {
      return;
    }

    const { winningBook, winningIndex, spinTarget } = wheelEngine.calculateSpinResult(wheelBooks);

    setWheelSpinning(true);
    setWheelResult(null);
    setWheelWinnerIndex(null);
    setWheelSpinTarget(spinTarget);
    wheelSpin.setValue(0);

    Animated.timing(wheelSpin, {
      toValue: 1,
      duration: 3600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        setWheelSpinning(false);
        return;
      }

      setWheelWinnerIndex(winningIndex);
      setWheelResult(winningBook);
      setWheelSpinning(false);
    });
  };

  return (
    <SafeAreaView style={appStyles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={appStyles.appShell}>
        <AppHeader
          kicker={headerContent.kicker}
          title={headerContent.title}
          subtitle={headerContent.subtitle}
        />

        <ScrollView contentContainerStyle={appStyles.content}>
          {screen === "home" ? (
            <HomeScreen
              authUser={authUser}
              selectedClub={selectedClub}
              selectedClubMembersCount={selectedClubMembers.length + (authUser ? 1 : 0)}
              favoriteBooksCount={favoriteBooks.length}
              aiPickerPrompt={aiPickerPrompt}
              aiPickerGenerated={aiPickerGenerated}
              aiPickerRecommendations={aiPickerRecommendations}
              onAiPromptChange={(value) => {
                setAiPickerPrompt(value);
                setAiPickerGenerated(false);
              }}
              onGenerateAiPick={generateAiPick}
              onSignIn={goToLogin}
              onSignUp={goToSignup}
            />
          ) : null}

          {screen === "clubs" ? (
            <ClubsScreen
              authUser={authUser}
              clubs={clubs}
              selectedClub={selectedClub}
              selectedClubMembers={selectedClubMembers}
              currentClubBook={currentClubBook}
              clubSelectorOpen={clubSelectorOpen}
              favoriteBooksCount={favoriteBooks.length}
              booksLoading={booksLoading}
              booksError={booksError}
              onToggleClubSelector={() => setClubSelectorOpen((open) => !open)}
              onSelectClub={(clubId) => {
                setSelectedClubId(clubId);
                setClubSelectorOpen(false);
              }}
              onGenerateQuestions={() => Alert.alert("Discussion questions", "Question generation can be wired next.")}
              onOpenPickNext={() => setScreen("pick-next")}
              onAddSampleBook={() => void addSampleBook()}
              onSignIn={goToLogin}
              onSignUp={goToSignup}
            />
          ) : null}

          {screen === "search" ? (
            <SearchScreen
              searchTerm={searchTerm}
              filteredSearchBooks={filteredSearchBooks}
              selectedSearchBook={selectedSearchBook}
              savedSearchBookIds={savedSearchBookIds}
              onSearchTermChange={setSearchTerm}
              onSelectBook={setSelectedSearchBookId}
              onToggleSaveBook={toggleSaveSearchBook}
            />
          ) : null}

          {screen === "pick-next" ? (
            <PickNextScreen
              pickMode={pickMode}
              selectedClub={selectedClub}
              currentClubBook={currentClubBook}
              randomizerPool={randomizerPool}
              randomizerResult={randomizerResult}
              randomizerRunCount={randomizerRunCount}
              wheelBooks={wheelBooks}
              wheelBookInput={wheelBookInput}
              wheelSpinning={wheelSpinning}
              wheelResult={wheelResult}
              wheelWinnerIndex={wheelWinnerIndex}
              wheelRotation={wheelRotation}
              wheelSlices={wheelSlices}
              defaultWheelSlices={defaultWheelSlices}
              maxWheelBooks={maxWheelBooks}
              aiPickerPrompt={aiPickerPrompt}
              aiPickerGenerated={aiPickerGenerated}
              aiPickerRecommendations={aiPickerRecommendations}
              onPickModeChange={setPickMode}
              onRunRandomizer={runRandomizer}
              onWheelBookInputChange={setWheelBookInput}
              onAddWheelBook={addWheelBook}
              onRemoveWheelBook={removeWheelBook}
              onSpinWheel={spinWheel}
              onAiPromptChange={(value) => {
                setAiPickerPrompt(value);
                setAiPickerGenerated(false);
              }}
              onGenerateAiPick={generateAiPick}
              wheelEngine={wheelEngine}
            />
          ) : null}

          {screen === "library" ? (
            <LibraryScreen
              authUser={authUser}
              booksLoading={booksLoading}
              booksError={booksError}
              favoriteBooks={favoriteBooks}
              guestLibraryBooks={guestLibraryBooks}
              onSignIn={goToLogin}
              onSignUp={goToSignup}
            />
          ) : null}

          {screen === "profile" ? (
            <ProfileScreen
              authUser={authUser}
              selectedClubName={selectedClub?.name || "None selected"}
              clubsCount={clubs.length}
              favoriteBooksCount={favoriteBooks.length}
              emailAuthMode={emailAuthMode}
              authLoading={authLoading}
              hasGoogleRequest={Boolean(googleRequest)}
              name={name}
              email={email}
              password={password}
              onSignOut={signOut}
              onStartGoogleSignIn={() => void startGoogleSignIn()}
              onEmailModeChange={setEmailAuthMode}
              onNameChange={setName}
              onEmailChange={setEmail}
              onPasswordChange={setPassword}
              onFinishEmailAuth={() => void finishEmailAuth()}
            />
          ) : null}
        </ScrollView>

        <View style={appStyles.bottomNav}>
          <NavButton icon="⌂" label="Home" active={screen === "home"} onPress={() => setScreen("home")} />
          <NavButton icon="◫" label="Clubs" active={screen === "clubs"} onPress={() => setScreen("clubs")} />
          <NavButton icon="⌕" label="Search" active={screen === "search"} onPress={() => setScreen("search")} />
          <NavButton icon="☰" label="Library" active={screen === "library"} onPress={() => setScreen("library")} />
          <NavButton icon="◌" label="Profile" active={screen === "profile"} onPress={() => setScreen("profile")} />
        </View>
      </View>
    </SafeAreaView>
  );
}
