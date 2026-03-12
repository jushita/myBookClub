import React from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { AuthUser } from "../../types";
import { appStyles } from "../../styles/appStyles";
import { Card } from "../common/Card";
import { Stat } from "../common/Stat";

type ProfileScreenProps = {
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
  onSignOut: () => void;
  onStartGoogleSignIn: () => void;
  onEmailModeChange: (mode: "signup" | "login") => void;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onFinishEmailAuth: () => void;
};

export function ProfileScreen({
  authUser,
  selectedClubName,
  clubsCount,
  favoriteBooksCount,
  emailAuthMode,
  authLoading,
  hasGoogleRequest,
  name,
  email,
  password,
  onSignOut,
  onStartGoogleSignIn,
  onEmailModeChange,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onFinishEmailAuth,
}: ProfileScreenProps) {
  if (authUser) {
    return (
      <View style={appStyles.stack}>
        <Card>
          <Text style={appStyles.sectionTitle}>Profile</Text>
          <Text style={appStyles.clubName}>{authUser.name}</Text>
          <Text style={appStyles.bodyText}>{authUser.email}</Text>
          <Text style={appStyles.helperText}>Active club: {selectedClubName}</Text>
        </Card>

        <Card accent>
          <Text style={appStyles.sectionTitle}>Account state</Text>
          <View style={appStyles.statRow}>
            <Stat label="Provider" value={authUser.provider} />
            <Stat label="Club" value={String(clubsCount)} />
            <Stat label="Shelf" value={String(favoriteBooksCount)} />
          </View>
        </Card>

        <Pressable style={appStyles.secondaryButton} onPress={onSignOut}>
          <Text style={appStyles.secondaryButtonText}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={appStyles.stack}>
      <View style={appStyles.authHero}>
        <Text style={appStyles.sectionTitle}>Get started</Text>
        <Text style={appStyles.bodyText}>
          Save books, join clubs, and keep your recommendations in one place.
        </Text>
      </View>

      <View style={appStyles.authCard}>
        <Text style={appStyles.sectionTitle}>Sign in or sign up</Text>
        <Text style={appStyles.bodyText}>Use Google for the fastest start, or continue with email below.</Text>

        <Pressable
          style={[appStyles.neuButton, appStyles.primaryButton, !hasGoogleRequest ? appStyles.buttonDisabled : null]}
          onPress={onStartGoogleSignIn}
          disabled={!hasGoogleRequest || authLoading}
        >
          <Text style={appStyles.primaryButtonText}>{authLoading ? "Working..." : "Continue with Google"}</Text>
        </Pressable>

        <View style={appStyles.formStack}>
          <View style={appStyles.inlineToggle}>
            <Pressable
              style={[appStyles.inlineToggleButton, emailAuthMode === "login" ? appStyles.inlineToggleButtonActive : null]}
              onPress={() => onEmailModeChange("login")}
            >
              <Text style={[appStyles.inlineToggleText, emailAuthMode === "login" ? appStyles.inlineToggleTextActive : null]}>
                Log in
              </Text>
            </Pressable>
            <Pressable
              style={[appStyles.inlineToggleButton, emailAuthMode === "signup" ? appStyles.inlineToggleButtonActive : null]}
              onPress={() => onEmailModeChange("signup")}
            >
              <Text style={[appStyles.inlineToggleText, emailAuthMode === "signup" ? appStyles.inlineToggleTextActive : null]}>
                Sign up
              </Text>
            </Pressable>
          </View>

          {emailAuthMode === "signup" ? (
            <TextInput
              value={name}
              onChangeText={onNameChange}
              placeholder="Name"
              placeholderTextColor="rgba(255, 243, 249, 0.72)"
              style={appStyles.field}
              autoCapitalize="words"
            />
          ) : null}
          <TextInput
            value={email}
            onChangeText={onEmailChange}
            placeholder="Email"
            placeholderTextColor="rgba(255, 243, 249, 0.72)"
            style={appStyles.field}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            value={password}
            onChangeText={onPasswordChange}
            placeholder="Password"
            placeholderTextColor="rgba(255, 243, 249, 0.72)"
            style={appStyles.field}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            style={[appStyles.neuButton, appStyles.primaryButton, authLoading ? appStyles.buttonDisabled : null]}
            onPress={onFinishEmailAuth}
            disabled={authLoading}
          >
            <Text style={appStyles.primaryButtonText}>
              {authLoading ? "Working..." : emailAuthMode === "signup" ? "Create account" : "Log in"}
            </Text>
          </Pressable>
        </View>

        <Text style={appStyles.helperText}>
          Google sign-in expects native client IDs in `my-book-club-ui/.env`.
        </Text>
      </View>
    </View>
  );
}
