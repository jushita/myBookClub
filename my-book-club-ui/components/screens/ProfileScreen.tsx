import React from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { appStyles } from "../../styles/appStyles";
import type { ProfileScreenActions, ProfileScreenModel } from "../../types/screenModels";
import { Card } from "../common/Card";
import { Stat } from "../common/Stat";

type ProfileScreenProps = {
  model: ProfileScreenModel;
  actions: ProfileScreenActions;
};

export function ProfileScreen({ model, actions }: ProfileScreenProps) {
  if (model.authUser) {
    return (
      <View style={appStyles.stack}>
        <Card>
          <Text style={appStyles.sectionTitle}>Profile</Text>
          <Text style={appStyles.clubName}>{model.authUser.name}</Text>
          <Text style={appStyles.bodyText}>{model.authUser.email}</Text>
          <Text style={appStyles.helperText}>Active club: {model.selectedClubName}</Text>
        </Card>

        <Card accent>
          <Text style={appStyles.sectionTitle}>Account state</Text>
          <View style={appStyles.statRow}>
            <Stat label="Provider" value={model.authUser.provider} />
            <Stat label="Club" value={String(model.clubsCount)} />
            <Stat label="Shelf" value={String(model.favoriteBooksCount)} />
          </View>
        </Card>

        <Pressable style={appStyles.secondaryButton} onPress={actions.onSignOut}>
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
          style={[appStyles.neuButton, appStyles.primaryButton, !model.hasGoogleRequest ? appStyles.buttonDisabled : null]}
          onPress={actions.onStartGoogleSignIn}
          disabled={!model.hasGoogleRequest || model.authLoading}
        >
          <Text style={appStyles.primaryButtonText}>{model.authLoading ? "Working..." : "Continue with Google"}</Text>
        </Pressable>

        <View style={appStyles.formStack}>
          <View style={appStyles.inlineToggle}>
            <Pressable
              style={[appStyles.inlineToggleButton, model.emailAuthMode === "login" ? appStyles.inlineToggleButtonActive : null]}
              onPress={() => actions.onEmailModeChange("login")}
            >
              <Text style={[appStyles.inlineToggleText, model.emailAuthMode === "login" ? appStyles.inlineToggleTextActive : null]}>
                Log in
              </Text>
            </Pressable>
            <Pressable
              style={[appStyles.inlineToggleButton, model.emailAuthMode === "signup" ? appStyles.inlineToggleButtonActive : null]}
              onPress={() => actions.onEmailModeChange("signup")}
            >
              <Text style={[appStyles.inlineToggleText, model.emailAuthMode === "signup" ? appStyles.inlineToggleTextActive : null]}>
                Sign up
              </Text>
            </Pressable>
          </View>

          {model.emailAuthMode === "signup" ? (
            <TextInput
              value={model.name}
              onChangeText={actions.onNameChange}
              placeholder="Name"
              placeholderTextColor="rgba(255, 243, 249, 0.72)"
              style={appStyles.field}
              autoCapitalize="words"
            />
          ) : null}
          <TextInput
            value={model.email}
            onChangeText={actions.onEmailChange}
            placeholder="Email"
            placeholderTextColor="rgba(255, 243, 249, 0.72)"
            style={appStyles.field}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            value={model.password}
            onChangeText={actions.onPasswordChange}
            placeholder="Password"
            placeholderTextColor="rgba(255, 243, 249, 0.72)"
            style={appStyles.field}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            style={[appStyles.neuButton, appStyles.primaryButton, model.authLoading ? appStyles.buttonDisabled : null]}
            onPress={actions.onFinishEmailAuth}
            disabled={model.authLoading}
          >
            <Text style={appStyles.primaryButtonText}>
              {model.authLoading ? "Working..." : model.emailAuthMode === "signup" ? "Create account" : "Log in"}
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
