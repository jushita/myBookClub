import React from "react";
import { Pressable, Text, View } from "react-native";
import type { AuthUser, Club, ClubMember } from "../../types";
import { appStyles } from "../../styles/appStyles";
import { Card } from "../common/Card";
import { GuestAccessCard } from "../common/GuestAccessCard";
import { Stat } from "../common/Stat";

type ClubsScreenProps = {
  authUser: AuthUser | null;
  clubs: Club[];
  selectedClub?: Club;
  selectedClubMembers: ClubMember[];
  currentClubBook: string;
  clubSelectorOpen: boolean;
  favoriteBooksCount: number;
  booksLoading: boolean;
  booksError: string | null;
  onToggleClubSelector: () => void;
  onSelectClub: (clubId: string) => void;
  onGenerateQuestions: () => void;
  onOpenPickNext: () => void;
  onAddSampleBook: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
};

export function ClubsScreen({
  authUser,
  clubs,
  selectedClub,
  selectedClubMembers,
  currentClubBook,
  clubSelectorOpen,
  favoriteBooksCount,
  booksLoading,
  booksError,
  onToggleClubSelector,
  onSelectClub,
  onGenerateQuestions,
  onOpenPickNext,
  onAddSampleBook,
  onSignIn,
  onSignUp,
}: ClubsScreenProps) {
  return (
    <View style={appStyles.stack}>
      {!authUser ? (
        <GuestAccessCard
          sectionTitle="Clubs"
          title="Sign in to join a club or create a club"
          description="You can browse the app as a guest, but club membership and creation require an account."
          onSignIn={onSignIn}
          onSignUp={onSignUp}
        />
      ) : null}

      {authUser ? (
        <>
          <Card>
            <Text style={appStyles.sectionTitle}>Active club</Text>
            <Pressable style={appStyles.clubAccordionButton} onPress={onToggleClubSelector}>
              <View style={appStyles.clubAccordionCopy}>
                <Text style={appStyles.clubName}>{selectedClub?.name || "Reading club"}</Text>
                <Text style={appStyles.bodyText}>{selectedClub?.vibe || "Club mood"}</Text>
              </View>
              <Text style={appStyles.clubAccordionIcon}>{clubSelectorOpen ? "−" : "+"}</Text>
            </Pressable>
            <Text style={appStyles.helperText}>Currently reading: {currentClubBook}</Text>
            {clubs.length > 1 && clubSelectorOpen ? (
              <View style={appStyles.clubSelector}>
                {clubs.map((club) => (
                  <Pressable
                    key={club.id}
                    style={[appStyles.clubChip, selectedClub?.id === club.id ? appStyles.clubChipActive : null]}
                    onPress={() => onSelectClub(club.id)}
                  >
                    <Text style={[appStyles.clubChipTitle, selectedClub?.id === club.id ? appStyles.clubChipTitleActive : null]}>
                      {club.name}
                    </Text>
                    <Text style={[appStyles.clubChipMeta, selectedClub?.id === club.id ? appStyles.clubChipMetaActive : null]}>
                      {club.vibe}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={appStyles.memberRow}>
              {selectedClubMembers.map((member) => (
                <View key={member.id} style={appStyles.memberChip}>
                  <Text style={appStyles.memberName}>{member.name}</Text>
                </View>
              ))}
              <View style={appStyles.memberChip}>
                <Text style={appStyles.memberName}>{authUser.name}</Text>
              </View>
            </View>
          </Card>

          <Card accent>
            <Text style={appStyles.sectionTitle}>Discussion</Text>
            <Text style={appStyles.bodyText}>Start discussion for {currentClubBook}</Text>
            <Pressable style={[appStyles.neuButton, appStyles.primaryButton]} onPress={onGenerateQuestions}>
              <Text style={appStyles.primaryButtonText}>Generate Questions</Text>
            </Pressable>
          </Card>

          <Card accent>
            <Text style={appStyles.sectionTitle}>Next Book</Text>
            <Text style={appStyles.bodyText}>Pick your next book for {selectedClub?.name || "this club"}</Text>
            <Pressable style={[appStyles.neuButton, appStyles.primaryButton]} onPress={onOpenPickNext}>
              <Text style={appStyles.primaryButtonText}>Pick your next book</Text>
            </Pressable>
          </Card>

          <Card>
            <Text style={appStyles.sectionTitle}>Taste snapshot</Text>
            <View style={appStyles.statRow}>
              <Stat label="Members" value={String(selectedClubMembers.length + 1)} />
              <Stat label="Saved books" value={String(favoriteBooksCount)} />
              <Stat label="Top vibe" value={selectedClub?.vibe || "Smart + cozy"} />
            </View>
            <Pressable style={appStyles.secondaryButton} onPress={onAddSampleBook}>
              <Text style={appStyles.secondaryButtonText}>Add a sample favorite via API</Text>
            </Pressable>
            {booksLoading ? <Text style={appStyles.helperText}>Loading books from API...</Text> : null}
            {booksError ? <Text style={appStyles.errorText}>{booksError}</Text> : null}
          </Card>
        </>
      ) : null}
    </View>
  );
}
