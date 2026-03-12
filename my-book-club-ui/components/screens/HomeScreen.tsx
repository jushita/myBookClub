import React from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { AuthUser, Club, Recommendation } from "../../types";
import { appStyles } from "../../styles/appStyles";
import { Card } from "../common/Card";
import { GuestAccessCard } from "../common/GuestAccessCard";
import { Stat } from "../common/Stat";

type HomeScreenProps = {
  authUser: AuthUser | null;
  selectedClub?: Club;
  selectedClubMembersCount: number;
  favoriteBooksCount: number;
  aiPickerPrompt: string;
  aiPickerGenerated: boolean;
  aiPickerRecommendations: Recommendation[];
  onAiPromptChange: (value: string) => void;
  onGenerateAiPick: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
};

export function HomeScreen({
  authUser,
  selectedClub,
  selectedClubMembersCount,
  favoriteBooksCount,
  aiPickerPrompt,
  aiPickerGenerated,
  aiPickerRecommendations,
  onAiPromptChange,
  onGenerateAiPick,
  onSignIn,
  onSignUp,
}: HomeScreenProps) {
  return (
    <View style={appStyles.stack}>
      {authUser ? (
        <>
          <Card>
            <Text style={appStyles.sectionTitle}>Today</Text>
            <Text style={appStyles.clubName}>{`Welcome back, ${authUser.name}`}</Text>
            <Text style={appStyles.bodyText}>
              {`${selectedClub?.name || "Your club"} is tuned for ${selectedClub?.vibe.toLowerCase() || "atmospheric"} picks. Start with the next read or review the shared shelf.`}
            </Text>
          </Card>

          <Card accent>
            <Text style={appStyles.sectionTitle}>This week</Text>
            <View style={appStyles.statRow}>
              <Stat label="Club mates" value={String(selectedClubMembersCount)} />
              <Stat label="Saved books" value={String(favoriteBooksCount)} />
              <Stat label="Mood" value={selectedClub?.vibe || "Glass cozy"} />
            </View>
          </Card>
        </>
      ) : (
        <>
          <GuestAccessCard
            title="Sign in or sign up"
            description="Create an account to join a club, start your own club, and save picks across the app."
            onSignIn={onSignIn}
            onSignUp={onSignUp}
          />

          <Card>
            <Text style={appStyles.sectionTitle}>AI-powered recommendations</Text>
            <Text style={appStyles.bodyText}>
              Tell us what kind of book you want and get a quick recommendation instantly.
            </Text>
            <TextInput
              multiline
              value={aiPickerPrompt}
              onChangeText={onAiPromptChange}
              placeholder="A thoughtful literary novel, a romantic fantasy, a sharp mystery..."
              placeholderTextColor="rgba(255, 232, 244, 0.52)"
              style={appStyles.input}
            />
            <Pressable style={[appStyles.neuButton, appStyles.primaryButton]} onPress={onGenerateAiPick}>
              <Text style={appStyles.primaryButtonText}>Generate recommendation</Text>
            </Pressable>
            {aiPickerGenerated ? (
              <View style={appStyles.randomizerWinnerCard}>
                <Text style={appStyles.randomizerWinnerLabel}>Recommended for you</Text>
                <Text style={appStyles.randomizerWinnerTitle}>
                  {aiPickerRecommendations[0]?.title || "The Maid"}
                </Text>
                <Text style={appStyles.randomizerWinnerMeta}>
                  {aiPickerRecommendations[0]?.author || "Nita Prose"}
                </Text>
                <Text style={appStyles.randomizerWinnerBody}>
                  {aiPickerPrompt.trim()
                    ? `Based on your prompt: ${aiPickerPrompt.trim()}`
                    : "Based on popular book club preferences and trending genre moods."}
                </Text>
              </View>
            ) : null}
          </Card>

          <Card accent>
            <Text style={appStyles.sectionTitle}>Community insights</Text>
            <View style={appStyles.statRow}>
              <Stat label="Active clubs" value="3" />
              <Stat label="Members" value="200" />
              <Stat label="Books" value="200" />
            </View>
          </Card>
        </>
      )}
    </View>
  );
}
