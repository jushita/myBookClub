import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Circle, G, Line, Path, Text as SvgText } from "react-native-svg";
import { BookCard } from "./components/BookCard";
import { MOCK_BOOKS, MOCK_CLUBS, MOCK_RECOMMENDATIONS, MOCK_USERS } from "./data/mockData";
import { loginWithEmail, loginWithSocial, signUpWithEmail } from "./services/auth";
import { createBook, fetchBooks } from "./services/api";
import type { AuthUser, Book, Club, ClubMember, Recommendation } from "./types";

WebBrowser.maybeCompleteAuthSession();

type Screen = "home" | "clubs" | "search" | "library" | "profile" | "pick-next";
type EmailAuthMode = "signup" | "login";
type PickMode = "randomizer" | "wheel" | "ai";

const WHEEL_SIZE = 280;
const WHEEL_RADIUS = 126;
const WHEEL_CENTER = WHEEL_SIZE / 2;
const WHEEL_COLORS = [
  "rgba(255, 175, 92, 0.92)",
  "rgba(255, 255, 255, 0.28)",
  "rgba(252, 145, 94, 0.9)",
  "rgba(210, 170, 255, 0.34)",
  "rgba(255, 211, 137, 0.9)",
  "rgba(255, 255, 255, 0.22)",
];

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeWheelSlice(startAngle: number, endAngle: number) {
  const start = polarToCartesian(WHEEL_CENTER, WHEEL_CENTER, WHEEL_RADIUS, endAngle);
  const end = polarToCartesian(WHEEL_CENTER, WHEEL_CENTER, WHEEL_RADIUS, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    `M ${WHEEL_CENTER} ${WHEEL_CENTER}`,
    `L ${start.x} ${start.y}`,
    `A ${WHEEL_RADIUS} ${WHEEL_RADIUS} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

function wheelLabelPosition(index: number, count: number) {
  const segmentAngle = 360 / count;
  const angle = index * segmentAngle + segmentAngle / 2;
  const point = polarToCartesian(WHEEL_CENTER, WHEEL_CENTER, WHEEL_RADIUS * 0.66, angle);

  return {
    x: point.x,
    y: point.y,
    rotation: angle,
  };
}

function formatWheelLabel(book: string) {
  if (book.length <= 14) {
    return [book];
  }

  const words = book.split(" ");
  if (words.length === 1) {
    return [`${book.slice(0, 14)}…`];
  }

  const midpoint = Math.ceil(words.length / 2);
  const first = words.slice(0, midpoint).join(" ");
  const second = words.slice(midpoint).join(" ");

  return [
    first.length > 14 ? `${first.slice(0, 14)}…` : first,
    second.length > 14 ? `${second.slice(0, 14)}…` : second,
  ];
}

function buildDefaultWheelSlices() {
  const count = 3;
  const segmentAngle = 360 / count;

  return Array.from({ length: count }, (_, index) => {
    const startAngle = index * segmentAngle;
    const endAngle = startAngle + segmentAngle;

    return {
      path: describeWheelSlice(startAngle, endAngle),
      fill: index === 0
        ? "rgba(255, 183, 111, 0.34)"
        : index === 1
          ? "rgba(255, 255, 255, 0.16)"
          : "rgba(231, 177, 255, 0.22)",
    };
  });
}

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
  const [authMode, setAuthMode] = useState<"social" | "email">("social");
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

  const selectedClub = useMemo(() => {
    return clubs.find((club) => club.id === selectedClubId) ?? clubs[0];
  }, [clubs, selectedClubId]);
  const [query, setQuery] = useState(selectedClub?.promptSeed || "cozy mystery for a rainy weekend");
  const wheelSpin = React.useRef(new Animated.Value(0)).current;

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

  const recommendations = useMemo<Recommendation[]>(() => {
    const normalized = query.toLowerCase();
    return MOCK_RECOMMENDATIONS.map((item) => ({
      ...item,
      matchReason: normalized.includes("mystery")
        ? `${item.matchReason} ${selectedClub?.name || "This club"} also leans into ${selectedClub?.vibe.toLowerCase() || "layered"} picks.`
      : `${item.matchReason} This fits the ${selectedClub?.vibe.toLowerCase() || "current"} club mood.`,
    }));
  }, [query, selectedClub]);
  const aiPickerQuery = aiPickerPrompt.trim() || selectedClub?.promptSeed || "club taste";
  const aiPickerRecommendations = useMemo<Recommendation[]>(() => {
    const normalized = aiPickerQuery.toLowerCase();
    return MOCK_RECOMMENDATIONS.map((item) => ({
      ...item,
      matchReason: aiPickerPrompt.trim()
        ? normalized.includes("mystery")
          ? `${item.matchReason} It also aligns with the request for ${aiPickerPrompt.trim().toLowerCase()}.`
          : `${item.matchReason} It fits the request for ${aiPickerPrompt.trim().toLowerCase()}.`
        : `${item.matchReason} It pulls from ${selectedClub?.name || "the club"} taste and the ${selectedClub?.vibe.toLowerCase() || "current"} mood.`,
    }));
  }, [aiPickerPrompt, aiPickerQuery, selectedClub]);
  const guestLibraryBooks = useMemo<Book[]>(() => MOCK_BOOKS, []);
  const searchBooks = useMemo<Book[]>(() => {
    const merged = [...guestLibraryBooks, ...favoriteBooks, ...recommendations];
    const seen = new Set<string>();

    return merged.filter((book) => {
      if (seen.has(book.id)) {
        return false;
      }

      seen.add(book.id);
      return true;
    });
  }, [favoriteBooks, guestLibraryBooks, recommendations]);
  const filteredSearchBooks = useMemo<Book[]>(() => {
    const normalized = searchTerm.trim().toLowerCase();

    if (!normalized) {
      return searchBooks;
    }

    return searchBooks.filter((book) =>
      [book.title, book.author, book.genre, book.note].some((value) =>
        value.toLowerCase().includes(normalized)
      )
    );
  }, [searchBooks, searchTerm]);
  const selectedSearchBook = useMemo<Book | null>(() => {
    if (!selectedSearchBookId) {
      return filteredSearchBooks[0] ?? searchBooks[0] ?? null;
    }

    return searchBooks.find((book) => book.id === selectedSearchBookId) ?? null;
  }, [filteredSearchBooks, searchBooks, selectedSearchBookId]);
  const randomizerPool = useMemo<Book[]>(() => {
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
  const wheelSlices = useMemo(() => {
    if (wheelBooks.length === 0) {
      return [];
    }

    const segmentAngle = 360 / wheelBooks.length;
    return wheelBooks.map((book, index) => {
      const startAngle = index * segmentAngle;
      const endAngle = startAngle + segmentAngle;
      const label = wheelLabelPosition(index, wheelBooks.length);

      return {
        index,
        book,
        path: describeWheelSlice(startAngle, endAngle),
        label,
        fill: WHEEL_COLORS[index % WHEEL_COLORS.length],
        labelLines: formatWheelLabel(book),
      };
    });
  }, [wheelBooks]);
  const defaultWheelSlices = useMemo(() => buildDefaultWheelSlices(), []);

  useEffect(() => {
    if (!selectedClub) {
      return;
    }

    setQuery(selectedClub.promptSeed);
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
  }, [selectedClub]);

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

    const winningIndex = Math.floor(Math.random() * wheelBooks.length);
    const segmentAngle = 360 / wheelBooks.length;
    const winningCenterAngle = winningIndex * segmentAngle + segmentAngle / 2;
    const finalOffset = (((360 - winningCenterAngle) % 360) + 360) % 360;
    const nextTarget = 360 * 6 + finalOffset;

    setWheelSpinning(true);
    setWheelResult(null);
    setWheelWinnerIndex(null);
    setWheelSpinTarget(nextTarget);
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
      setWheelResult(wheelBooks[winningIndex]);
      setWheelSpinning(false);
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.appShell}>
        <View style={styles.hero}>
          <View style={styles.topBar}>
            <View style={styles.titleGroup}>
              <Text style={styles.kicker}>{screen === "clubs" ? "My Book Club" : "AI-Powered Book Club"}</Text>
              <Text style={styles.title}>
                {screen === "clubs"
                  ? selectedClub?.name || "My Book Club"
                  : screen === "pick-next"
                    ? "Pick Next Book"
                    : "My Book Club"}
              </Text>
            </View>
          </View>
          <Text style={styles.subtitle}>
            {screen === "clubs"
              ? `Currently tuned to ${selectedClub?.vibe.toLowerCase() || "your club mood"}.`
              : screen === "pick-next"
                ? `Three ways to choose the next read for ${selectedClub?.name || "your club"}.`
              : "Discover standout reads, explore genre moods, and build a smarter shared shelf."}
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {screen === "home" ? (
            <View style={styles.stack}>
              <Card>
                <Text style={styles.sectionTitle}>Today</Text>
                <Text style={styles.clubName}>
                  {authUser ? `Welcome back, ${authUser.name}` : "Welcome to My Book Club"}
                </Text>
                <Text style={styles.bodyText}>
                  {authUser
                    ? `${selectedClub?.name || "Your club"} is tuned for ${selectedClub?.vibe.toLowerCase() || "atmospheric"} picks. Start with the next read or review the shared shelf.`
                    : `Start with ${selectedClub?.vibe.toLowerCase() || "genre-led"} discovery and top-charted favorites, then shape the vibe that fits your next discussion.`}
                </Text>
              </Card>

              {!authUser ? (
                <Card accent>
                  <Text style={styles.sectionTitle}>Get started</Text>
                  <Text style={styles.clubName}>Sign in or sign up</Text>
                  <Text style={styles.bodyText}>
                    Create an account to join a club, start your own club, and save picks across the app.
                  </Text>
                  <View style={styles.authCtaRow}>
                    <Pressable
                      style={[styles.neuButton, styles.primaryButton, styles.authCtaButton]}
                      onPress={() => {
                        setAuthMode("social");
                        setEmailAuthMode("login");
                        setScreen("profile");
                      }}
                    >
                      <Text style={styles.primaryButtonText}>Sign in</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.secondaryButton, styles.authCtaButton]}
                      onPress={() => {
                        setAuthMode("email");
                        setEmailAuthMode("signup");
                        setScreen("profile");
                      }}
                    >
                      <Text style={styles.secondaryButtonText}>Sign up</Text>
                    </Pressable>
                  </View>
                </Card>
              ) : null}

              <Card accent>
                <Text style={styles.sectionTitle}>This week</Text>
                <View style={styles.statRow}>
                  <Stat label="Club mates" value={String(selectedClubMembers.length + (authUser ? 1 : 0))} />
                  <Stat label="Saved books" value={String(favoriteBooks.length)} />
                  <Stat label="Mood" value={selectedClub?.vibe || "Glass cozy"} />
                </View>
              </Card>
            </View>
          ) : null}

          {screen === "clubs" ? (
            <View style={styles.stack}>
              {!authUser ? (
                <Card accent>
                  <Text style={styles.sectionTitle}>Clubs</Text>
                  <Text style={styles.clubName}>Sign in to join a club or create a club</Text>
                  <Text style={styles.bodyText}>
                    You can browse the app as a guest, but club membership and creation require an account.
                  </Text>
                  <View style={styles.authCtaRow}>
                    <Pressable
                      style={[styles.neuButton, styles.primaryButton, styles.authCtaButton]}
                      onPress={() => {
                        setAuthMode("social");
                        setEmailAuthMode("login");
                        setScreen("profile");
                      }}
                    >
                      <Text style={styles.primaryButtonText}>Sign in</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.secondaryButton, styles.authCtaButton]}
                      onPress={() => {
                        setAuthMode("email");
                        setEmailAuthMode("signup");
                        setScreen("profile");
                      }}
                    >
                      <Text style={styles.secondaryButtonText}>Sign up</Text>
                    </Pressable>
                  </View>
                </Card>
              ) : null}

              <Card>
                <Text style={styles.sectionTitle}>Active club</Text>
                <Pressable style={styles.clubAccordionButton} onPress={() => setClubSelectorOpen((open) => !open)}>
                  <View style={styles.clubAccordionCopy}>
                    <Text style={styles.clubName}>{selectedClub?.name || "Reading club"}</Text>
                    <Text style={styles.bodyText}>{selectedClub?.vibe || "Club mood"}</Text>
                  </View>
                  <Text style={styles.clubAccordionIcon}>{clubSelectorOpen ? "−" : "+"}</Text>
                </Pressable>
                <Text style={styles.helperText}>Currently reading: {currentClubBook}</Text>
                {clubs.length > 1 && clubSelectorOpen ? (
                  <View style={styles.clubSelector}>
                    {clubs.map((club) => (
                      <Pressable
                        key={club.id}
                        style={[
                          styles.clubChip,
                          selectedClub?.id === club.id ? styles.clubChipActive : null,
                        ]}
                        onPress={() => {
                          setSelectedClubId(club.id);
                          setClubSelectorOpen(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.clubChipTitle,
                            selectedClub?.id === club.id ? styles.clubChipTitleActive : null,
                          ]}
                        >
                          {club.name}
                        </Text>
                        <Text
                          style={[
                            styles.clubChipMeta,
                            selectedClub?.id === club.id ? styles.clubChipMetaActive : null,
                          ]}
                        >
                          {club.vibe}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <View style={styles.memberRow}>
                  {selectedClubMembers.map((member) => (
                    <View key={member.id} style={styles.memberChip}>
                      <Text style={styles.memberName}>{member.name}</Text>
                    </View>
                  ))}
                  {authUser ? (
                    <View style={styles.memberChip}>
                      <Text style={styles.memberName}>{authUser.name}</Text>
                    </View>
                  ) : null}
                </View>
              </Card>

              <Card accent>
                <Text style={styles.sectionTitle}>Discussion</Text>
                <Text style={styles.bodyText}>
                  Start discussion for {currentClubBook}
                </Text>
                <Pressable style={[styles.neuButton, styles.primaryButton]}>
                  <Text style={styles.primaryButtonText}>Generate Questions</Text>
                </Pressable>
              </Card>

              <Card accent>
                <Text style={styles.sectionTitle}>Next Book</Text>
                <Text style={styles.bodyText}>
                  Pick your next book for {selectedClub?.name || "this club"}
                </Text>
                <Pressable style={[styles.neuButton, styles.primaryButton]} onPress={() => setScreen("pick-next")}>
                  <Text style={styles.primaryButtonText}>Pick your next book</Text>
                </Pressable>
              </Card>

              <Card>
                <Text style={styles.sectionTitle}>Taste snapshot</Text>
                <View style={styles.statRow}>
                  <Stat label="Members" value={String(selectedClubMembers.length + (authUser ? 1 : 0))} />
                  <Stat label="Saved books" value={String(favoriteBooks.length)} />
                  <Stat label="Top vibe" value={selectedClub?.vibe || "Smart + cozy"} />
                </View>
                <Pressable style={styles.secondaryButton} onPress={() => void addSampleBook()}>
                  <Text style={styles.secondaryButtonText}>Add a sample favorite via API</Text>
                </Pressable>
                {booksLoading ? <Text style={styles.helperText}>Loading books from API...</Text> : null}
                {booksError ? <Text style={styles.errorText}>{booksError}</Text> : null}
              </Card>
            </View>
          ) : null}

          {screen === "search" ? (
            <View style={styles.stack}>
              <Card accent>
                <Text style={styles.sectionTitle}>Search books</Text>
                <TextInput
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  placeholder="Search by title, author, or genre"
                  placeholderTextColor="rgba(255, 232, 244, 0.52)"
                  style={styles.field}
                />
              </Card>

              <Card>
                <Text style={styles.sectionTitle}>Results</Text>
                <View style={styles.candidateStack}>
                  {filteredSearchBooks.slice(0, 6).map((book) => (
                    <Pressable
                      key={book.id}
                      style={[
                        styles.searchResultRow,
                        selectedSearchBook?.id === book.id ? styles.searchResultRowActive : null,
                      ]}
                      onPress={() => setSelectedSearchBookId(book.id)}
                    >
                      <View style={styles.searchResultCopy}>
                        <Text style={styles.candidateTitle}>{book.title}</Text>
                        <Text style={styles.candidateMeta}>{book.author}</Text>
                      </View>
                      <Text style={styles.searchResultChevron}>›</Text>
                    </Pressable>
                  ))}
                  {filteredSearchBooks.length === 0 ? (
                    <Text style={styles.bodyText}>No books matched that search.</Text>
                  ) : null}
                </View>
              </Card>

              {selectedSearchBook ? (
                <Card accent>
                  <View style={styles.searchDetailHeader}>
                    <View style={styles.searchDetailCopy}>
                      <Text style={styles.sectionTitle}>Book details</Text>
                      <Text style={styles.clubName}>{selectedSearchBook.title}</Text>
                      <Text style={styles.bodyText}>{selectedSearchBook.author}</Text>
                    </View>
                    <Pressable
                      style={styles.searchStarButton}
                      onPress={() => toggleSaveSearchBook(selectedSearchBook)}
                    >
                      <Text style={styles.searchStarIcon}>
                        {savedSearchBookIds.includes(selectedSearchBook.id) ? "★" : "☆"}
                      </Text>
                    </Pressable>
                  </View>
                  <Text style={styles.searchSynopsisLabel}>Synopsis</Text>
                  <Text style={styles.bodyText}>{selectedSearchBook.note}</Text>
                </Card>
              ) : null}
            </View>
          ) : null}

          {screen === "pick-next" ? (
            <View style={styles.stack}>
              <Card>
                <Text style={styles.sectionTitle}>Choose your method</Text>
                <View style={styles.pickModeRow}>
                  <Pressable
                    style={[styles.pickModeButton, pickMode === "randomizer" ? styles.pickModeButtonActive : null]}
                    onPress={() => setPickMode("randomizer")}
                  >
                    <Text style={[styles.pickModeTitle, pickMode === "randomizer" ? styles.pickModeTitleActive : null]}>
                      Randomize
                    </Text>
                    <Text style={[styles.pickModeMeta, pickMode === "randomizer" ? styles.pickModeMetaActive : null]}>
                      Group shelf
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.pickModeButton, pickMode === "wheel" ? styles.pickModeButtonActive : null]}
                    onPress={() => setPickMode("wheel")}
                  >
                    <Text style={[styles.pickModeTitle, pickMode === "wheel" ? styles.pickModeTitleActive : null]}>
                      Wheel
                    </Text>
                    <Text style={[styles.pickModeMeta, pickMode === "wheel" ? styles.pickModeMetaActive : null]}>
                      Spin to pick
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.pickModeButton, pickMode === "ai" ? styles.pickModeButtonActive : null]}
                    onPress={() => setPickMode("ai")}
                  >
                    <Text style={[styles.pickModeTitle, pickMode === "ai" ? styles.pickModeTitleActive : null]}>
                      AI Pick
                    </Text>
                    <Text style={[styles.pickModeMeta, pickMode === "ai" ? styles.pickModeMetaActive : null]}>
                      Taste-led
                    </Text>
                  </Pressable>
                </View>
              </Card>

              {pickMode === "randomizer" ? (
                <Card accent>
                  <Text style={styles.sectionTitle}>Randomizer</Text>
                  <Text style={styles.bodyText}>
                    Shuffle from the books saved by {selectedClub?.name || "your club"} and let luck pick the next read.
                  </Text>
                  <View style={styles.candidateStack}>
                    {randomizerPool.slice(0, 3).map((book) => (
                      <View key={book.id} style={styles.candidateRow}>
                        <Text style={styles.candidateTitle}>{book.title}</Text>
                        <Text style={styles.candidateMeta}>{book.author}</Text>
                      </View>
                    ))}
                  </View>
                  <Pressable style={[styles.neuButton, styles.primaryButton]} onPress={runRandomizer}>
                    <Text style={styles.primaryButtonText}>Run randomizer</Text>
                  </Pressable>
                  {randomizerResult ? (
                    <View key={`${randomizerResult.id}-${randomizerRunCount}`} style={styles.randomizerWinnerCard}>
                      <Text style={styles.randomizerWinnerLabel}>Picked for your club</Text>
                      <Text style={styles.randomizerWinnerTitle}>{randomizerResult.title}</Text>
                      <Text style={styles.randomizerWinnerMeta}>
                        {randomizerResult.author}
                      </Text>
                      <Text style={styles.randomizerWinnerBody}>
                        The randomizer landed here from the current club shelf.
                      </Text>
                    </View>
                  ) : null}
                </Card>
              ) : null}

              {pickMode === "wheel" ? (
                <Card accent>
                  <Text style={styles.sectionTitle}>Wheel of fortune</Text>
                  <Text style={styles.bodyText}>
                    Add up to {maxWheelBooks} books, then spin the wheel to pick the club's next read.
                  </Text>
                  <View style={styles.wheelInputRow}>
                    <TextInput
                      value={wheelBookInput}
                      onChangeText={setWheelBookInput}
                      placeholder="Add a book to the wheel"
                      placeholderTextColor="rgba(255, 232, 244, 0.52)"
                      style={[styles.field, styles.wheelField]}
                      editable={!wheelSpinning}
                    />
                    <Pressable
                      style={[styles.neuButton, styles.wheelAddButton, wheelSpinning ? styles.buttonDisabled : null]}
                      onPress={addWheelBook}
                      disabled={wheelSpinning}
                    >
                      <Text style={styles.primaryButtonText}>Add</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.helperText}>
                    {wheelBooks.length} of {maxWheelBooks} books added
                  </Text>
                  <View style={styles.wheelShell}>
                    <View style={styles.wheelPointer} />
                    <Animated.View style={[styles.wheelPlaceholder, { transform: [{ rotate: wheelRotation }] }]}>
                      <Svg width={WHEEL_SIZE} height={WHEEL_SIZE} viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}>
                        {wheelSlices.length > 0 ? (
                          <>
                            {wheelSlices.map((slice) => (
                              <Path
                                key={slice.book}
                                d={slice.path}
                                fill={
                                  wheelWinnerIndex === slice.index
                                    ? "rgba(255, 244, 181, 0.96)"
                                    : slice.fill
                                }
                                stroke="rgba(255,255,255,0.55)"
                                strokeWidth={1.5}
                              />
                            ))}
                            {wheelSlices.map((slice, index) => {
                              const segmentAngle = 360 / wheelSlices.length;
                              const boundaryPoint = polarToCartesian(
                                WHEEL_CENTER,
                                WHEEL_CENTER,
                                WHEEL_RADIUS,
                                index * segmentAngle
                              );

                              return (
                                <Line
                                  key={`${slice.book}-separator`}
                                  x1={WHEEL_CENTER}
                                  y1={WHEEL_CENTER}
                                  x2={boundaryPoint.x}
                                  y2={boundaryPoint.y}
                                  stroke="rgba(255,255,255,0.34)"
                                  strokeWidth={1}
                                />
                              );
                            })}
                            <Circle
                              cx={WHEEL_CENTER}
                              cy={WHEEL_CENTER}
                              r={WHEEL_RADIUS}
                              fill="transparent"
                              stroke="rgba(255,255,255,0.3)"
                              strokeWidth={1.5}
                            />
                            {wheelSlices.map((slice) => (
                              <G key={`${slice.book}-label`}>
                                {slice.labelLines.map((line, lineIndex) => (
                                  <SvgText
                                    key={`${slice.book}-${lineIndex}`}
                                    x={slice.label.x}
                                    y={slice.label.y + lineIndex * 12 - (slice.labelLines.length - 1) * 6}
                                    fill={wheelWinnerIndex === slice.index ? "#6D4199" : "#FFF8FD"}
                                    fontSize="10"
                                    fontWeight="800"
                                    textAnchor="middle"
                                  >
                                    {line}
                                  </SvgText>
                                ))}
                              </G>
                            ))}
                            <Circle
                              cx={WHEEL_CENTER}
                              cy={WHEEL_CENTER}
                              r={38}
                              fill="rgba(131, 76, 190, 0.95)"
                              stroke="rgba(255,255,255,0.78)"
                              strokeWidth={2}
                            />
                          </>
                        ) : (
                          <>
                            {defaultWheelSlices.map((slice, index) => (
                              <Path
                                key={`default-slice-${index}`}
                                d={slice.path}
                                fill={slice.fill}
                                stroke="rgba(255,255,255,0.32)"
                                strokeWidth={1.25}
                              />
                            ))}
                            <Circle
                              cx={WHEEL_CENTER}
                              cy={WHEEL_CENTER}
                              r={WHEEL_RADIUS}
                              fill="transparent"
                              stroke="rgba(255,255,255,0.24)"
                              strokeWidth={1.5}
                            />
                            <Circle
                              cx={WHEEL_CENTER}
                              cy={WHEEL_CENTER}
                              r={38}
                              fill="rgba(255,255,255,0.95)"
                              stroke="rgba(255,255,255,0.72)"
                              strokeWidth={2}
                            />
                          </>
                        )}
                      </Svg>
                      {wheelBooks.length > 0 ? (
                        <View style={styles.wheelHubOverlay} pointerEvents="none" />
                      ) : null}
                    </Animated.View>
                  </View>
                  <View style={styles.memberRow}>
                    {wheelBooks.map((book) => (
                      <Pressable
                        key={book}
                        style={styles.memberChip}
                        onPress={() => removeWheelBook(book)}
                        disabled={wheelSpinning}
                      >
                        <Text style={styles.memberName}>{book} ×</Text>
                      </Pressable>
                    ))}
                  </View>
                  {wheelBooks.length >= 3 ? (
                    <Pressable
                      style={[styles.neuButton, styles.primaryButton, wheelSpinning ? styles.buttonDisabled : null]}
                      onPress={spinWheel}
                      disabled={wheelSpinning}
                    >
                      <Text style={styles.primaryButtonText}>{wheelSpinning ? "Spinning..." : "Spin wheel"}</Text>
                    </Pressable>
                  ) : null}
                  {wheelResult ? (
                    <View style={styles.candidateRow}>
                      <Text style={styles.candidateTitle}>{wheelResult}</Text>
                      <Text style={styles.candidateMeta}>The wheel picked this as the next club read.</Text>
                    </View>
                  ) : null}
                </Card>
              ) : null}

              {pickMode === "ai" ? (
                <Card accent>
                  <Text style={styles.sectionTitle}>AI recommendation</Text>
                  <Text style={styles.bodyText}>
                    Tell the AI what kind of book you want, or leave it blank and it will choose from the club's taste.
                  </Text>
                  <TextInput
                    multiline
                    value={aiPickerPrompt}
                    onChangeText={(value) => {
                      setAiPickerPrompt(value);
                      setAiPickerGenerated(false);
                    }}
                    placeholder="A warm fantasy, a sharp thriller, a short literary read..."
                    placeholderTextColor="rgba(255, 232, 244, 0.52)"
                    style={styles.input}
                  />
                  <Pressable style={[styles.neuButton, styles.primaryButton]} onPress={generateAiPick}>
                    <Text style={styles.primaryButtonText}>Generate AI pick</Text>
                  </Pressable>
                  {aiPickerGenerated ? (
                    <View style={styles.candidateStack}>
                      <View style={styles.candidateRow}>
                        <Text style={styles.candidateTitle}>{aiPickerRecommendations[0]?.title || currentClubBook}</Text>
                        <Text style={styles.candidateMeta}>
                          {aiPickerPrompt.trim()
                            ? `Picked for: ${aiPickerPrompt.trim()}`
                            : `Picked from ${selectedClub?.name || "your club"} preferences.`}
                        </Text>
                      </View>
                      {aiPickerRecommendations.slice(0, 2).map((book) => (
                        <View key={book.id} style={styles.candidateRow}>
                          <Text style={styles.candidateTitle}>{book.title}</Text>
                          <Text style={styles.candidateMeta}>{book.matchReason}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </Card>
              ) : null}
            </View>
          ) : null}

          {screen === "library" ? (
            <View style={styles.stack}>
              <Text style={styles.screenHeading}>Favorite books from the group</Text>
              {!authUser ? (
                <Text style={styles.bodyText}>Guest shelf: a few top-charted picks to explore before signing in.</Text>
              ) : null}
              {authUser && booksLoading ? <Text style={styles.bodyText}>Loading books from API...</Text> : null}
              {authUser && booksError ? <Text style={styles.errorText}>{booksError}</Text> : null}
              {authUser && !booksLoading && favoriteBooks.length === 0 ? (
                <Text style={styles.bodyText}>No books returned by the API yet.</Text>
              ) : null}
              {(authUser ? favoriteBooks : guestLibraryBooks).map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </View>
          ) : null}

          {screen === "profile" ? (
            <View style={styles.stack}>
              {authUser ? (
                <>
                  <Card>
                    <Text style={styles.sectionTitle}>Profile</Text>
                    <Text style={styles.clubName}>{authUser.name}</Text>
                    <Text style={styles.bodyText}>{authUser.email}</Text>
                    <Text style={styles.helperText}>Active club: {selectedClub?.name || "None selected"}</Text>
                  </Card>

                  <Card accent>
                    <Text style={styles.sectionTitle}>Account state</Text>
                    <View style={styles.statRow}>
                      <Stat label="Provider" value={authUser.provider} />
                      <Stat label="Club" value={String(clubs.length)} />
                      <Stat label="Shelf" value={String(favoriteBooks.length)} />
                    </View>
                  </Card>

                  <Pressable style={styles.secondaryButton} onPress={signOut}>
                    <Text style={styles.secondaryButtonText}>Sign out</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={styles.authHero}>
                    <Text style={styles.sectionTitle}>Sign in to personalize</Text>
                    <Text style={styles.bodyText}>
                      Keep exploring as a guest, or create an account to save books, join clubs, and sync your recommendations.
                    </Text>
                  </View>

                  <View style={styles.authCard}>
                    <Text style={styles.sectionTitle}>Create your account</Text>
                    <Text style={styles.bodyText}>
                      Sign in with Google or use email and password to join your club and sync your shelf.
                    </Text>

                    <Pressable
                      style={[styles.neuButton, styles.primaryButton, !googleRequest ? styles.buttonDisabled : null]}
                      onPress={() => void startGoogleSignIn()}
                      disabled={!googleRequest || authLoading}
                    >
                      <Text style={styles.primaryButtonText}>
                        {authLoading ? "Working..." : "Continue with Google"}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.modeToggleShell}
                      onPress={() => setAuthMode(authMode === "social" ? "email" : "social")}
                    >
                      <Text style={styles.modeToggleText}>
                        {authMode === "social" ? "Use email instead" : "Back to Google sign in"}
                      </Text>
                    </Pressable>

                    {authMode === "email" ? (
                      <View style={styles.formStack}>
                        <View style={styles.inlineToggle}>
                          <Pressable
                            style={[
                              styles.inlineToggleButton,
                              emailAuthMode === "signup" ? styles.inlineToggleButtonActive : null,
                            ]}
                            onPress={() => setEmailAuthMode("signup")}
                          >
                            <Text
                              style={[
                                styles.inlineToggleText,
                                emailAuthMode === "signup" ? styles.inlineToggleTextActive : null,
                              ]}
                            >
                              Sign up
                            </Text>
                          </Pressable>
                          <Pressable
                            style={[
                              styles.inlineToggleButton,
                              emailAuthMode === "login" ? styles.inlineToggleButtonActive : null,
                            ]}
                            onPress={() => setEmailAuthMode("login")}
                          >
                            <Text
                              style={[
                                styles.inlineToggleText,
                                emailAuthMode === "login" ? styles.inlineToggleTextActive : null,
                              ]}
                            >
                              Log in
                            </Text>
                          </Pressable>
                        </View>

                        {emailAuthMode === "signup" ? (
                          <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="Name"
                            placeholderTextColor="#8E96A4"
                            style={styles.field}
                            autoCapitalize="words"
                          />
                        ) : null}
                        <TextInput
                          value={email}
                          onChangeText={setEmail}
                          placeholder="Email"
                          placeholderTextColor="#8E96A4"
                          style={styles.field}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                        <TextInput
                          value={password}
                          onChangeText={setPassword}
                          placeholder="Password"
                          placeholderTextColor="#8E96A4"
                          style={styles.field}
                          secureTextEntry
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                        <Pressable
                          style={[styles.neuButton, styles.primaryButton, authLoading ? styles.buttonDisabled : null]}
                          onPress={() => void finishEmailAuth()}
                          disabled={authLoading}
                        >
                          <Text style={styles.primaryButtonText}>
                            {authLoading
                              ? "Working..."
                              : emailAuthMode === "signup"
                                ? "Create account"
                                : "Log in"}
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}

                    <Text style={styles.helperText}>
                      Google sign-in expects native client IDs in `my-book-club-ui/.env`.
                    </Text>
                  </View>
                </>
              )}
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.bottomNav}>
          <NavButton
            icon="⌂"
            label="Home"
            active={screen === "home"}
            onPress={() => setScreen("home")}
          />
          <NavButton
            icon="◫"
            label="Clubs"
            active={screen === "clubs"}
            onPress={() => setScreen("clubs")}
          />
          <NavButton
            icon="⌕"
            label="Search"
            active={screen === "search"}
            onPress={() => setScreen("search")}
          />
          <NavButton
            icon="☰"
            label="Library"
            active={screen === "library"}
            onPress={() => setScreen("library")}
          />
          <NavButton
            icon="◌"
            label="Profile"
            active={screen === "profile"}
            onPress={() => setScreen("profile")}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function Card({
  children,
  accent = false,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return <View style={[styles.card, accent ? styles.cardAccent : null]}>{children}</View>;
}

function NavButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: string;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.navButton, active ? styles.navButtonActive : null]} onPress={onPress}>
      <Text style={[styles.navIcon, active ? styles.navIconActive : null]}>{icon}</Text>
      <Text style={[styles.navLabel, active ? styles.navLabelActive : null]}>{label}</Text>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#8B61D6",
  },
  authScroll: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingVertical: 26,
    justifyContent: "center",
    backgroundColor: "#8B61D6",
  },
  authHero: {
    gap: 10,
    marginBottom: 24,
  },
  authCard: {
    backgroundColor: "rgba(255, 246, 255, 0.22)",
    borderRadius: 30,
    padding: 22,
    gap: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.64)",
    shadowColor: "#5E2C99",
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 18 },
    elevation: 9,
  },
  appShell: {
    flex: 1,
    backgroundColor: "#8B61D6",
  },
  hero: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 14,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  titleGroup: {
    flex: 1,
  },
  kicker: {
    color: "rgba(255, 244, 255, 0.86)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    color: "#F8FBFF",
    fontSize: 36,
    fontWeight: "800",
    marginTop: 4,
  },
  subtitle: {
    color: "rgba(255, 239, 248, 0.9)",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 8,
    maxWidth: 330,
  },
  content: {
    padding: 22,
    paddingTop: 16,
    paddingBottom: 120,
  },
  stack: {
    gap: 18,
  },
  pickModeRow: {
    flexDirection: "row",
    gap: 8,
  },
  pickModeButton: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.54)",
    alignItems: "center",
  },
  pickModeButtonActive: {
    backgroundColor: "rgba(255, 191, 109, 0.22)",
    borderColor: "rgba(255, 255, 255, 0.74)",
  },
  pickModeTitle: {
    color: "#FFF7FD",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  pickModeTitleActive: {
    color: "#FFFFFF",
  },
  pickModeMeta: {
    color: "rgba(255, 227, 239, 0.76)",
    fontSize: 11,
    marginTop: 3,
    textAlign: "center",
  },
  pickModeMetaActive: {
    color: "rgba(255, 248, 240, 0.92)",
  },
  clubSelector: {
    gap: 10,
  },
  clubAccordionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  clubAccordionCopy: {
    flex: 1,
  },
  clubAccordionIcon: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "500",
    lineHeight: 28,
  },
  clubChip: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.58)",
  },
  clubChipActive: {
    backgroundColor: "rgba(255, 191, 109, 0.22)",
    borderColor: "rgba(255, 255, 255, 0.76)",
  },
  clubChipTitle: {
    color: "#FFF7FD",
    fontSize: 15,
    fontWeight: "800",
  },
  clubChipTitleActive: {
    color: "#FFFFFF",
  },
  clubChipMeta: {
    color: "rgba(255, 227, 239, 0.78)",
    fontSize: 12,
    marginTop: 4,
  },
  clubChipMetaActive: {
    color: "rgba(255, 248, 240, 0.92)",
  },
  card: {
    backgroundColor: "rgba(255, 244, 253, 0.18)",
    borderRadius: 28,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.62)",
    shadowColor: "#5D2F96",
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 16 },
    elevation: 8,
  },
  cardAccent: {
    backgroundColor: "rgba(255, 193, 120, 0.22)",
  },
  sectionTitle: {
    color: "#FFD7AE",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  clubName: {
    color: "#F8FBFF",
    fontSize: 24,
    fontWeight: "800",
  },
  bodyText: {
    color: "rgba(255, 242, 249, 0.92)",
    fontSize: 15,
    lineHeight: 23,
  },
  helperText: {
    color: "rgba(255, 234, 246, 0.8)",
    fontSize: 13,
    lineHeight: 19,
  },
  errorText: {
    color: "#B15E56",
    fontSize: 13,
    lineHeight: 19,
  },
  memberRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  memberChip: {
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.58)",
    shadowColor: "#6634A3",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  memberName: {
    color: "#F5FAFF",
    fontSize: 13,
    fontWeight: "700",
  },
  candidateStack: {
    gap: 10,
  },
  candidateRow: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.56)",
  },
  candidateTitle: {
    color: "#FFF8FD",
    fontSize: 15,
    fontWeight: "800",
  },
  candidateMeta: {
    color: "rgba(255, 236, 245, 0.8)",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  searchResultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.56)",
  },
  searchResultRowActive: {
    backgroundColor: "rgba(255, 191, 109, 0.2)",
    borderColor: "rgba(255, 255, 255, 0.76)",
  },
  searchResultCopy: {
    flex: 1,
    paddingRight: 10,
  },
  searchResultChevron: {
    color: "#FFF8FD",
    fontSize: 24,
    lineHeight: 24,
  },
  searchDetailHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
  },
  searchDetailCopy: {
    flex: 1,
  },
  searchStarButton: {
    width: 46,
    height: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.68)",
  },
  searchStarIcon: {
    color: "#FFF2AE",
    fontSize: 24,
    lineHeight: 24,
  },
  searchSynopsisLabel: {
    color: "#FFE0A8",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  randomizerWinnerCard: {
    backgroundColor: "rgba(255, 248, 214, 0.22)",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.74)",
    shadowColor: "#6A2E87",
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  randomizerWinnerLabel: {
    color: "#FFE0A8",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  randomizerWinnerTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 8,
  },
  randomizerWinnerMeta: {
    color: "rgba(255, 244, 249, 0.88)",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },
  randomizerWinnerBody: {
    color: "rgba(255, 240, 247, 0.86)",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },
  wheelPlaceholder: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.58)",
    overflow: "hidden",
    position: "relative",
    shadowColor: "#4D1E78",
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
  },
  wheelShell: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 26,
  },
  wheelPointer: {
    position: "absolute",
    top: 6,
    width: 0,
    height: 0,
    borderLeftWidth: 14,
    borderRightWidth: 14,
    borderTopWidth: 26,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#FFF7FD",
    zIndex: 2,
    shadowColor: "#4E216F",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  wheelHubOverlay: {
    position: "absolute",
    width: 76,
    height: 76,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  wheelInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  wheelField: {
    flex: 1,
    minHeight: 56,
  },
  wheelAddButton: {
    backgroundColor: "rgba(255, 191, 109, 0.2)",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  input: {
    minHeight: 120,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: 24,
    padding: 16,
    color: "#F8FBFF",
    textAlignVertical: "top",
    fontSize: 15,
    lineHeight: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.64)",
    shadowColor: "#7B409E",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
  },
  field: {
    minHeight: 54,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: "#F8FBFF",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.64)",
    shadowColor: "#7B409E",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
  },
  neuButton: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.68)",
    shadowColor: "#5B2E96",
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  primaryButton: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderRadius: 22,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#F8FBFF",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    backgroundColor: "rgba(255, 191, 109, 0.16)",
    borderRadius: 22,
    paddingVertical: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.62)",
    shadowColor: "#7C438F",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  secondaryButtonText: {
    color: "#F7FBFF",
    fontSize: 15,
    fontWeight: "700",
  },
  authCtaRow: {
    flexDirection: "row",
    gap: 10,
  },
  authCtaButton: {
    flex: 1,
  },
  modeToggleShell: {
    alignSelf: "center",
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.62)",
    shadowColor: "#5D2F96",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 9 },
    elevation: 4,
  },
  modeToggleText: {
    color: "#FFF7FD",
    fontSize: 14,
    fontWeight: "700",
  },
  formStack: {
    gap: 12,
  },
  inlineToggle: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 999,
    padding: 5,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.56)",
  },
  inlineToggleButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
  },
  inlineToggleButtonActive: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.68)",
    shadowColor: "#6C359F",
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
  },
  inlineToggleText: {
    color: "rgba(255, 234, 246, 0.76)",
    fontSize: 14,
    fontWeight: "700",
  },
  inlineToggleTextActive: {
    color: "#F8FBFF",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  statRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.62)",
    shadowColor: "#62309D",
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  statValue: {
    color: "#F8FBFF",
    fontSize: 17,
    fontWeight: "800",
  },
  statLabel: {
    color: "rgba(255, 227, 239, 0.78)",
    fontSize: 13,
    marginTop: 4,
  },
  screenHeading: {
    color: "#F8FBFF",
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 6,
  },
  bottomNav: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "rgba(102, 47, 143, 0.82)",
    borderRadius: 28,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.24)",
    shadowColor: "#40176B",
    shadowOpacity: 0.42,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  navButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 18,
  },
  navButtonActive: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
  navIcon: {
    color: "rgba(255, 243, 249, 0.9)",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 20,
  },
  navIconActive: {
    color: "#FFFFFF",
  },
  navLabel: {
    color: "rgba(255, 240, 247, 0.9)",
    fontSize: 11,
    fontWeight: "700",
  },
  navLabelActive: {
    color: "#FFFFFF",
  },
});
