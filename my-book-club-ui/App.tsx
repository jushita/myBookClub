import React, { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BookCard } from "./components/BookCard";
import { MOCK_BOOKS, MOCK_RECOMMENDATIONS, MOCK_USERS } from "./data/mockData";
import type { AuthProvider, AuthUser, Book, ClubMember, Recommendation } from "./types";

type Screen = "home" | "books" | "recommendations";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [members] = useState<ClubMember[]>(MOCK_USERS);
  const [favoriteBooks, setFavoriteBooks] = useState<Book[]>(MOCK_BOOKS);
  const [query, setQuery] = useState("cozy mystery for a rainy weekend");
  const [authMode, setAuthMode] = useState<"social" | "email">("social");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const recommendations = useMemo<Recommendation[]>(() => {
    const normalized = query.toLowerCase();
    return MOCK_RECOMMENDATIONS.map((item) => ({
      ...item,
      matchReason: normalized.includes("mystery")
        ? `${item.matchReason} The current prompt also emphasizes mystery.`
        : item.matchReason,
    }));
  }, [query]);

  const addSampleBook = () => {
    const nextBook: Book = {
      id: String(Date.now()),
      title: "The House in the Cerulean Sea",
      author: "TJ Klune",
      genre: "Fantasy",
      note: "Warm character-driven pick for the club shortlist.",
    };

    setFavoriteBooks((current) => [nextBook, ...current]);
    setScreen("books");
  };

  const completeAuth = (provider: AuthProvider, nextName: string, nextEmail: string) => {
    const resolvedName = nextName.trim() || nextEmail.split("@")[0] || "Reader";

    setAuthUser({
      id: String(Date.now()),
      name: resolvedName,
      email: nextEmail,
      provider,
    });
    setName("");
    setEmail("");
    setPassword("");
  };

  const handleSocialSignIn = (provider: AuthProvider) => {
    const label = provider === "google" ? "Google" : "Facebook";
    completeAuth(provider, `${label} Reader`, `${provider}@mybookclub.app`);
    Alert.alert("Signed in", `${label} sign-up is mocked in this MVP UI.`);
  };

  const handleEmailSignUp = () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      Alert.alert("Name required", "Enter your name to create the account.");
      return;
    }

    if (!trimmedEmail.includes("@")) {
      Alert.alert("Email required", "Enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      Alert.alert("Password too short", "Use at least 8 characters.");
      return;
    }

    completeAuth("email", trimmedName, trimmedEmail);
  };

  if (!authUser) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <ScrollView contentContainerStyle={styles.authScroll}>
          <View style={styles.authHero}>
            <Text style={styles.kicker}>Welcome</Text>
            <Text style={styles.title}>myBookClub</Text>
            <Text style={styles.subtitle}>
              Sign up with Google, Facebook, or create an account with email and password.
            </Text>
          </View>

          <View style={styles.authCard}>
            <Text style={styles.sectionTitle}>Create your account</Text>
            <Text style={styles.bodyText}>
              Join your club, save favorite reads, and get group-tailored recommendations.
            </Text>

            <Pressable style={styles.socialButton} onPress={() => handleSocialSignIn("google")}>
              <Text style={styles.socialButtonText}>Continue with Google</Text>
            </Pressable>

            <Pressable
              style={[styles.socialButton, styles.facebookButton]}
              onPress={() => handleSocialSignIn("facebook")}
            >
              <Text style={styles.socialButtonText}>Continue with Facebook</Text>
            </Pressable>

            <Pressable
              style={styles.modeToggle}
              onPress={() => setAuthMode(authMode === "social" ? "email" : "social")}
            >
              <Text style={styles.modeToggleText}>
                {authMode === "social" ? "Use email instead" : "Back to social sign up"}
              </Text>
            </Pressable>

            {authMode === "email" ? (
              <View style={styles.formStack}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Name"
                  placeholderTextColor="#8B8479"
                  style={styles.field}
                  autoCapitalize="words"
                />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email"
                  placeholderTextColor="#8B8479"
                  style={styles.field}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor="#8B8479"
                  style={styles.field}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable style={styles.primaryButton} onPress={handleEmailSignUp}>
                  <Text style={styles.primaryButtonText}>Create account</Text>
                </Pressable>
              </View>
            ) : null}

            <Text style={styles.helperText}>
              Google and Facebook sign-in are UI placeholders here. Real OAuth still needs Expo auth
              libraries, provider app IDs, and backend token verification.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.appShell}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>Mobile Book Club</Text>
          <Text style={styles.title}>myBookClub</Text>
          <Text style={styles.subtitle}>
            A small-screen recommendation room for shared reading taste.
          </Text>
          <View style={styles.sessionRow}>
            <Text style={styles.sessionText}>
              Signed in as {authUser.name} via {authUser.provider}
            </Text>
            <Pressable onPress={() => setAuthUser(null)}>
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.tabBar}>
          <TabButton label="Club" active={screen === "home"} onPress={() => setScreen("home")} />
          <TabButton label="Books" active={screen === "books"} onPress={() => setScreen("books")} />
          <TabButton
            label="AI Picks"
            active={screen === "recommendations"}
            onPress={() => setScreen("recommendations")}
          />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {screen === "home" ? (
            <View style={styles.stack}>
              <Card>
                <Text style={styles.sectionTitle}>Your club</Text>
                <Text style={styles.clubName}>Wednesday Night Readers</Text>
                <Text style={styles.bodyText}>
                  Built for quick consensus: collect favorites, capture the mood, and shortlist books
                  with an AI explanation.
                </Text>
                <View style={styles.memberRow}>
                  {members.map((member) => (
                    <View key={member.id} style={styles.memberChip}>
                      <Text style={styles.memberName}>{member.name}</Text>
                    </View>
                  ))}
                  <View style={styles.memberChip}>
                    <Text style={styles.memberName}>{authUser.name}</Text>
                  </View>
                </View>
              </Card>

              <Card accent>
                <Text style={styles.sectionTitle}>Recommendation prompt</Text>
                <TextInput
                  multiline
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Describe your next read"
                  placeholderTextColor="#8B8479"
                  style={styles.input}
                />
                <Pressable style={styles.primaryButton} onPress={() => setScreen("recommendations")}>
                  <Text style={styles.primaryButtonText}>See AI recommendations</Text>
                </Pressable>
              </Card>

              <Card>
                <Text style={styles.sectionTitle}>Taste snapshot</Text>
                <View style={styles.statRow}>
                  <Stat label="Members" value={String(members.length + 1)} />
                  <Stat label="Saved books" value={String(favoriteBooks.length)} />
                  <Stat label="Top vibe" value="Smart + cozy" />
                </View>
                <Pressable style={styles.secondaryButton} onPress={addSampleBook}>
                  <Text style={styles.secondaryButtonText}>Add a sample favorite</Text>
                </Pressable>
              </Card>
            </View>
          ) : null}

          {screen === "books" ? (
            <View style={styles.stack}>
              <Text style={styles.screenHeading}>Favorite books from the group</Text>
              {favoriteBooks.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </View>
          ) : null}

          {screen === "recommendations" ? (
            <View style={styles.stack}>
              <Text style={styles.screenHeading}>Recommended for this prompt</Text>
              <Text style={styles.bodyText}>{query}</Text>
              {recommendations.map((book) => (
                <BookCard key={book.id} book={book} recommendation />
              ))}
            </View>
          ) : null}
        </ScrollView>
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

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.tabButton, active ? styles.tabButtonActive : null]} onPress={onPress}>
      <Text style={[styles.tabButtonText, active ? styles.tabButtonTextActive : null]}>{label}</Text>
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
    backgroundColor: "#E9E0D2",
  },
  authScroll: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
  },
  authHero: {
    gap: 8,
    marginBottom: 20,
  },
  authCard: {
    backgroundColor: "#FFFDF9",
    borderRadius: 28,
    padding: 20,
    gap: 14,
    shadowColor: "#7A5C3E",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  appShell: {
    flex: 1,
    backgroundColor: "#F6F1E8",
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  kicker: {
    color: "#7A5C3E",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: "#201A15",
    fontSize: 34,
    fontWeight: "800",
    marginTop: 6,
  },
  subtitle: {
    color: "#5E554C",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    maxWidth: 320,
  },
  sessionRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sessionText: {
    color: "#5E554C",
    fontSize: 13,
    flex: 1,
  },
  signOutText: {
    color: "#7A5C3E",
    fontSize: 13,
    fontWeight: "800",
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
  },
  tabButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D6C8B7",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tabButtonActive: {
    backgroundColor: "#201A15",
    borderColor: "#201A15",
  },
  tabButtonText: {
    color: "#6E6358",
    fontSize: 14,
    fontWeight: "700",
  },
  tabButtonTextActive: {
    color: "#F6F1E8",
  },
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  stack: {
    gap: 16,
  },
  card: {
    backgroundColor: "#FFFDF9",
    borderRadius: 24,
    padding: 18,
    gap: 12,
    shadowColor: "#7A5C3E",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  cardAccent: {
    backgroundColor: "#E8D3B9",
  },
  sectionTitle: {
    color: "#43372D",
    fontSize: 16,
    fontWeight: "800",
  },
  clubName: {
    color: "#201A15",
    fontSize: 22,
    fontWeight: "800",
  },
  bodyText: {
    color: "#5E554C",
    fontSize: 15,
    lineHeight: 22,
  },
  helperText: {
    color: "#7B7268",
    fontSize: 13,
    lineHeight: 19,
  },
  memberRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  memberChip: {
    backgroundColor: "#EFE4D6",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  memberName: {
    color: "#43372D",
    fontSize: 13,
    fontWeight: "700",
  },
  input: {
    minHeight: 110,
    backgroundColor: "#FFF9F1",
    borderRadius: 18,
    padding: 14,
    color: "#201A15",
    textAlignVertical: "top",
    fontSize: 15,
    lineHeight: 22,
  },
  field: {
    minHeight: 52,
    backgroundColor: "#FFF9F1",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#201A15",
    fontSize: 15,
  },
  socialButton: {
    borderRadius: 16,
    backgroundColor: "#201A15",
    paddingVertical: 14,
    alignItems: "center",
  },
  facebookButton: {
    backgroundColor: "#355797",
  },
  socialButtonText: {
    color: "#F6F1E8",
    fontSize: 15,
    fontWeight: "800",
  },
  modeToggle: {
    alignSelf: "center",
    paddingVertical: 4,
  },
  modeToggleText: {
    color: "#7A5C3E",
    fontSize: 14,
    fontWeight: "700",
  },
  formStack: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: "#201A15",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#F6F1E8",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#C8B8A4",
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#43372D",
    fontSize: 15,
    fontWeight: "700",
  },
  statRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#F5EADB",
    borderRadius: 18,
    padding: 12,
  },
  statValue: {
    color: "#201A15",
    fontSize: 16,
    fontWeight: "800",
  },
  statLabel: {
    color: "#6E6358",
    fontSize: 13,
    marginTop: 4,
  },
  screenHeading: {
    color: "#201A15",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 4,
  },
});
