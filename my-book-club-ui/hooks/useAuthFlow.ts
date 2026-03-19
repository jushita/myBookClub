import * as Google from "expo-auth-session/providers/google";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { loginWithEmail, loginWithSocial, signUpWithEmail } from "../services/auth";
import type { AuthUser } from "../types";

type EmailAuthMode = "signup" | "login";

const DEV_AUTH_USER: AuthUser = {
  id: "u_seed_jushita",
  name: "Jushita Rahman",
  email: "jushita@example.com",
  provider: "email",
};

const DEV_AUTH_TOKEN = "dev-auth-token";

export function useAuthFlow() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [emailAuthMode, setEmailAuthMode] = useState<EmailAuthMode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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

  useEffect(() => {
    const accessToken =
      googleResponse?.type === "success" ? googleResponse.authentication?.accessToken : null;

    if (!accessToken) {
      return;
    }

    void finishGoogleSignIn(accessToken);
  }, [googleResponse]);

  useEffect(() => {
    let ignore = false;

    const bootstrapDevAuth = async () => {
      try {
        const payload = await loginWithSocial({
          provider: "google",
          email: DEV_AUTH_USER.email,
          name: DEV_AUTH_USER.name,
          providerUserId: DEV_AUTH_USER.id,
        });

        if (!ignore) {
          setAuthUser(payload.user);
          setAuthToken(payload.token);
        }
      } catch {
        if (!ignore) {
          setAuthUser(DEV_AUTH_USER);
          setAuthToken(DEV_AUTH_TOKEN);
        }
      }
    };

    void bootstrapDevAuth();

    return () => {
      ignore = true;
    };
  }, []);

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
  };

  return {
    authUser,
    authToken,
    authLoading,
    emailAuthMode,
    name,
    email,
    password,
    googleRequest,
    setAuthUser,
    setAuthToken,
    setEmailAuthMode,
    setName,
    setEmail,
    setPassword,
    finishEmailAuth,
    startGoogleSignIn,
    signOut,
  };
}
