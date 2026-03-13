import React from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { appStyles } from "../../styles/appStyles";
import type { ClubsScreenActions, ClubsScreenModel } from "../../types/screenModels";
import { Card } from "../common/Card";
import { GuestAccessCard } from "../common/GuestAccessCard";
import { Stat } from "../common/Stat";

type ClubsScreenProps = {
  model: ClubsScreenModel;
  actions: ClubsScreenActions;
};

export function ClubsScreen({ model, actions }: ClubsScreenProps) {
  const showOverview = model.clubManagementMode === "overview";
  const showCreate = model.clubManagementMode === "create";
  const showJoin = model.clubManagementMode === "join";

  return (
    <View style={appStyles.stack}>
      {!model.authUser ? (
        <GuestAccessCard
          sectionTitle="Clubs"
          title="Sign in to join a club or create a club"
          description="You can browse the app as a guest, but club membership and creation require an account."
          onSignIn={actions.onSignIn}
          onSignUp={actions.onSignUp}
        />
      ) : null}

      {model.authUser ? (
        <>
          {showOverview ? (
            <Card accent>
              <Text style={appStyles.sectionTitle}>Club actions</Text>
              <View style={appStyles.pickModeRow}>
                <Pressable style={[appStyles.neuButton, appStyles.primaryButton, appStyles.flexButton]} onPress={actions.onOpenCreateClub}>
                  <Text style={appStyles.primaryButtonText}>Create a club</Text>
                </Pressable>
                <Pressable style={[appStyles.neuButton, appStyles.primaryButton, appStyles.flexButton]} onPress={actions.onOpenJoinClub}>
                  <Text style={appStyles.primaryButtonText}>Join a club</Text>
                </Pressable>
              </View>
              {model.clubActionError ? <Text style={appStyles.errorText}>{model.clubActionError}</Text> : null}
            </Card>
          ) : null}

          {showCreate ? (
            <Card accent>
              <Text style={appStyles.sectionTitle}>Create a club</Text>
              <TextInput
                value={model.createClubName}
                onChangeText={actions.onCreateClubNameChange}
                placeholder="Club name"
                placeholderTextColor="rgba(255, 232, 244, 0.52)"
                style={appStyles.field}
              />
              <TextInput
                value={model.createClubDescription}
                onChangeText={actions.onCreateClubDescriptionChange}
                placeholder="What is this club about?"
                placeholderTextColor="rgba(255, 232, 244, 0.52)"
                style={appStyles.field}
                multiline
              />
              <TextInput
                value={model.createClubVibe}
                onChangeText={actions.onCreateClubVibeChange}
                placeholder="Club vibe"
                placeholderTextColor="rgba(255, 232, 244, 0.52)"
                style={appStyles.field}
              />
              <View style={appStyles.pickModeRow}>
                <Pressable
                  style={[appStyles.neuButton, appStyles.primaryButton, appStyles.flexButton, model.clubActionLoading ? appStyles.buttonDisabled : null]}
                  onPress={actions.onCreateClub}
                  disabled={model.clubActionLoading}
                >
                  <Text style={appStyles.primaryButtonText}>{model.clubActionLoading ? "Working..." : "Create club"}</Text>
                </Pressable>
                <Pressable style={[appStyles.secondaryButton, appStyles.flexButton]} onPress={actions.onCloseClubManagement}>
                  <Text style={appStyles.secondaryButtonText}>Back</Text>
                </Pressable>
              </View>
              {model.clubActionError ? <Text style={appStyles.errorText}>{model.clubActionError}</Text> : null}
            </Card>
          ) : null}

          {showJoin ? (
            <Card>
              <Text style={appStyles.sectionTitle}>Join a club</Text>
              <TextInput
                value={model.clubSearchTerm}
                onChangeText={actions.onClubSearchTermChange}
                placeholder="Search club name"
                placeholderTextColor="rgba(255, 232, 244, 0.52)"
                style={appStyles.field}
              />
              <View style={appStyles.clubSelector}>
                {model.joinableClubs.length === 0 ? (
                  <Text style={appStyles.bodyText}>No clubs matched that search.</Text>
                ) : (
                  model.joinableClubs.slice(0, 5).map((club) => (
                    <Pressable
                      key={club.id}
                      style={[appStyles.clubChip, model.selectedJoinClub?.id === club.id ? appStyles.clubChipActive : null]}
                      onPress={() => actions.onSelectJoinClub(club.id)}
                    >
                      <Text style={[appStyles.clubChipTitle, model.selectedJoinClub?.id === club.id ? appStyles.clubChipTitleActive : null]}>
                        {club.name}
                      </Text>
                      <Text style={[appStyles.clubChipMeta, model.selectedJoinClub?.id === club.id ? appStyles.clubChipMetaActive : null]}>
                        {club.vibe}
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
              {model.selectedJoinClub ? (
                <View style={appStyles.stack}>
                  <Text style={appStyles.bodyText}>{model.selectedJoinClub.description || "No club description yet."}</Text>
                  <View style={appStyles.memberRow}>
                    {model.selectedJoinClubMembers.map((member) => (
                      <View key={member.id} style={appStyles.memberChip}>
                        <Text style={appStyles.memberName}>{member.name}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={appStyles.pickModeRow}>
                    <Pressable
                      style={[appStyles.neuButton, appStyles.primaryButton, appStyles.flexButton, model.clubActionLoading ? appStyles.buttonDisabled : null]}
                      onPress={actions.onJoinSelectedClub}
                      disabled={model.clubActionLoading}
                    >
                      <Text style={appStyles.primaryButtonText}>{model.clubActionLoading ? "Working..." : "Join selected club"}</Text>
                    </Pressable>
                    <Pressable style={[appStyles.secondaryButton, appStyles.flexButton]} onPress={actions.onCloseClubManagement}>
                      <Text style={appStyles.secondaryButtonText}>Back</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
              {model.clubActionError ? <Text style={appStyles.errorText}>{model.clubActionError}</Text> : null}
            </Card>
          ) : null}

          {showOverview ? (
          <>
          <Card>
            <Text style={appStyles.sectionTitle}>Active club</Text>
            <Pressable style={appStyles.clubAccordionButton} onPress={actions.onToggleClubSelector}>
              <View style={appStyles.clubAccordionCopy}>
                <Text style={appStyles.clubName}>{model.selectedClub?.name || "Reading club"}</Text>
                <Text style={appStyles.bodyText}>{model.selectedClub?.vibe || "Club mood"}</Text>
              </View>
              <Text style={appStyles.clubAccordionIcon}>{model.clubSelectorOpen ? "−" : "+"}</Text>
            </Pressable>
            <Text style={appStyles.helperText}>Currently reading: {model.currentClubBook}</Text>
            {model.clubs.length > 1 && model.clubSelectorOpen ? (
              <View style={appStyles.clubSelector}>
                {model.clubs.map((club) => (
                  <Pressable
                    key={club.id}
                    style={[appStyles.clubChip, model.selectedClub?.id === club.id ? appStyles.clubChipActive : null]}
                    onPress={() => actions.onSelectClub(club.id)}
                  >
                    <Text style={[appStyles.clubChipTitle, model.selectedClub?.id === club.id ? appStyles.clubChipTitleActive : null]}>
                      {club.name}
                    </Text>
                    <Text style={[appStyles.clubChipMeta, model.selectedClub?.id === club.id ? appStyles.clubChipMetaActive : null]}>
                      {club.vibe}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={appStyles.memberRow}>
              {model.selectedClubMembers.map((member) => (
                <View key={member.id} style={appStyles.memberChip}>
                  <Text style={appStyles.memberName}>{member.name}</Text>
                </View>
              ))}
              <View style={appStyles.memberChip}>
                <Text style={appStyles.memberName}>{model.authUser.name}</Text>
              </View>
            </View>
          </Card>

          <Card accent>
            <Text style={appStyles.sectionTitle}>Discussion</Text>
            <Text style={appStyles.bodyText}>Start discussion for {model.currentClubBook}</Text>
            <Pressable style={[appStyles.neuButton, appStyles.primaryButton]} onPress={actions.onGenerateQuestions}>
              <Text style={appStyles.primaryButtonText}>Generate Questions</Text>
            </Pressable>
          </Card>

          <Card accent>
            <Text style={appStyles.sectionTitle}>Next Book</Text>
            <Text style={appStyles.bodyText}>Pick your next book for {model.selectedClub?.name || "this club"}</Text>
            <Pressable style={[appStyles.neuButton, appStyles.primaryButton]} onPress={actions.onOpenPickNext}>
              <Text style={appStyles.primaryButtonText}>Pick your next book</Text>
            </Pressable>
          </Card>

          <Card>
            <Text style={appStyles.sectionTitle}>Taste snapshot</Text>
            <View style={appStyles.statRow}>
              <Stat label="Members" value={String(model.selectedClubMembers.length + 1)} />
              <Stat label="Saved books" value={String(model.favoriteBooksCount)} />
              <Stat label="Top vibe" value={model.selectedClub?.vibe || "Smart + cozy"} />
            </View>
            <Pressable style={appStyles.secondaryButton} onPress={actions.onAddSampleBook}>
              <Text style={appStyles.secondaryButtonText}>Add a sample favorite via API</Text>
            </Pressable>
            {model.booksLoading ? <Text style={appStyles.helperText}>Loading books from API...</Text> : null}
            {model.booksError ? <Text style={appStyles.errorText}>{model.booksError}</Text> : null}
          </Card>
          </>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
