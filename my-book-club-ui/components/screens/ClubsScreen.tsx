import React from "react";
import { ActivityIndicator, Image, Pressable, Text, TextInput, View } from "react-native";
import { getBookCoverUrl } from "../../data/bookCoverFallbacks";
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
  const clubSummary = model.clubInsight?.summary
    ? `${model.clubInsight.headline}: ${model.clubInsight.summary}`
    : model.selectedClub
      ? `${model.selectedClub.vibe}: Group taste is still being mapped from the live shelf.`
      : "Club reading profile unavailable.";
  const currentBookCoverUrl = model.currentClubBookDetails ? getBookCoverUrl(model.currentClubBookDetails) : null;

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
                  style={({ pressed }) => [
                    appStyles.neuButton,
                    appStyles.primaryButton,
                    appStyles.flexButton,
                    model.clubActionLoading ? appStyles.buttonDisabled : null,
                    pressed ? appStyles.primaryButtonPressed : null,
                  ]}
                  onPress={actions.onCreateClub}
                  disabled={model.clubActionLoading}
                >
                  <Text style={appStyles.primaryButtonText}>{model.clubActionLoading ? "Working..." : "Create club"}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    appStyles.secondaryButton,
                    appStyles.flexButton,
                    pressed ? appStyles.secondaryButtonPressed : null,
                  ]}
                  onPress={actions.onCloseClubManagement}
                >
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
                      style={({ pressed }) => [
                        appStyles.clubChip,
                        model.selectedJoinClub?.id === club.id ? appStyles.clubChipActive : null,
                        pressed ? appStyles.chipPressed : null,
                      ]}
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
                </View>
              ) : null}
              <View style={appStyles.pickModeRow}>
                <Pressable
                  style={({ pressed }) => [
                    appStyles.neuButton,
                    appStyles.primaryButton,
                    appStyles.flexButton,
                    model.clubActionLoading || !model.selectedJoinClub ? appStyles.buttonDisabled : null,
                    pressed ? appStyles.primaryButtonPressed : null,
                  ]}
                  onPress={actions.onJoinSelectedClub}
                  disabled={model.clubActionLoading || !model.selectedJoinClub}
                >
                  <Text style={appStyles.primaryButtonText}>{model.clubActionLoading ? "Working..." : "Join selected club"}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    appStyles.secondaryButton,
                    appStyles.flexButton,
                    pressed ? appStyles.secondaryButtonPressed : null,
                  ]}
                  onPress={actions.onCloseClubManagement}
                >
                  <Text style={appStyles.secondaryButtonText}>Back</Text>
                </Pressable>
              </View>
              {model.clubActionError ? <Text style={appStyles.errorText}>{model.clubActionError}</Text> : null}
            </Card>
          ) : null}
        

          {showOverview ? (
          <>
          <Card>
            <Text style={appStyles.sectionTitle}>Active club</Text>
            {model.showSwitchClub ? (
              <Pressable
                style={({ pressed }) => [appStyles.clubAccordionButton, pressed ? appStyles.chipPressed : null]}
                onPress={actions.onToggleClubSelector}
              >
                <View style={appStyles.clubAccordionCopy}>
                  <Text style={appStyles.clubName}>{model.selectedClub?.name || "Reading club"}</Text>
                  <Text style={appStyles.helperText}>{clubSummary}</Text>
                </View>
                <Text style={appStyles.clubAccordionIcon}>{model.clubSelectorOpen ? "−" : "+"}</Text>
              </Pressable>
            ) : (
              <View style={appStyles.clubAccordionButton}>
                <View style={appStyles.clubAccordionCopy}>
                  <Text style={appStyles.clubName}>{model.selectedClub?.name || "Reading club"}</Text>
                  <Text style={appStyles.helperText}>{clubSummary}</Text>
                </View>
              </View>
            )}
            {model.clubs.length > 1 && model.clubSelectorOpen ? (
              <View style={appStyles.clubSelector}>
                {model.clubs.map((club) => (
                  <Pressable
                    key={club.id}
                    style={({ pressed }) => [
                      appStyles.clubChip,
                      model.selectedClub?.id === club.id ? appStyles.clubChipActive : null,
                      pressed ? appStyles.chipPressed : null,
                    ]}
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
            {model.currentClubBookDetails ? (
              <View style={appStyles.currentBookHero}>
                {currentBookCoverUrl ? (
                  <Image source={{ uri: currentBookCoverUrl }} style={appStyles.currentBookCoverImage} />
                ) : (
                  <View style={appStyles.currentBookCover}>
                    <Text style={appStyles.currentBookCoverText}>Cover</Text>
                  </View>
                )}
                <View style={appStyles.currentBookCopy}>
                  <Text style={appStyles.sectionTitle}>Currently reading</Text>
                  <Text style={appStyles.clubName}>{model.currentClubBookDetails.title}</Text>
                  <Text style={appStyles.bodyText}>{model.currentClubBookDetails.author}</Text>
                  <Text style={appStyles.helperText}>
                    {model.currentClubBookDetails.description || model.currentClubBookDetails.note}
                  </Text>
                  <Pressable
                    style={({ pressed }) => [
                      appStyles.neuButton,
                      appStyles.primaryButton,
                      pressed ? appStyles.primaryButtonPressed : null,
                    ]}
                    onPress={actions.onMarkCurrentBookFinished}
                  >
                    <Text style={appStyles.primaryButtonText}>Mark as finished</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </Card>

          {model.currentClubBookDetails ? (
            <Card accent>
              <Text style={appStyles.sectionTitle}>Discussion</Text>
              <Text style={appStyles.bodyText}>Start discussion for {model.currentClubBookDetails.title}</Text>
              <Pressable
                style={({ pressed }) => [
                  appStyles.neuButton,
                  appStyles.primaryButton,
                  model.discussionQuestionsLoading ? appStyles.buttonDisabled : null,
                  pressed ? appStyles.primaryButtonPressed : null,
                ]}
                onPress={actions.onGenerateQuestions}
                disabled={model.discussionQuestionsLoading}
              >
                <Text style={appStyles.primaryButtonText}>
                  {model.discussionQuestionsLoading ? "Generating..." : "Generate Questions"}
                </Text>
              </Pressable>
              {model.discussionQuestionsLoading ? (
                <View style={appStyles.discussionLoadingCard}>
                  <View style={appStyles.discussionLoadingHeader}>
                    <ActivityIndicator size="small" color="#FFD7AE" />
                    <Text style={appStyles.discussionLoadingTitle}>The club AI is reading the room</Text>
                  </View>
                  <Text style={appStyles.discussionLoadingBody}>
                    Pulling themes, tension, and hot takes from {model.currentClubBookDetails.title}...
                  </Text>
                </View>
              ) : null}
              {model.discussionQuestions.length > 0 ? (
                <View style={appStyles.stack}>
                  {model.discussionQuestions.map((question, index) => (
                    <View key={`${index}-${question}`} style={appStyles.discussionQuestionCard}>
                      <View style={appStyles.discussionQuestionRow}>
                      <Text style={appStyles.discussionQuestionIndex}>{index + 1}.</Text>
                        <Text style={appStyles.discussionQuestionText}>{question}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </Card>
          ) : null}

          <Card accent>
            <Text style={appStyles.sectionTitle}>Next Book</Text>
            <Text style={appStyles.bodyText}>Pick your next book for {model.selectedClub?.name || "this club"}</Text>
            <Pressable
              style={({ pressed }) => [
                appStyles.neuButton,
                appStyles.primaryButton,
                pressed ? appStyles.primaryButtonPressed : null,
              ]}
              onPress={actions.onOpenPickNext}
            >
              <Text style={appStyles.primaryButtonText}>Pick your next book</Text>
            </Pressable>
          </Card>

          <Card>
            <Text style={appStyles.sectionTitle}>Club insights</Text>
            <View style={appStyles.statRow}>
              <Stat label="Members" value={String(model.selectedClubMembers.length + 1)} />
              <Stat label="Saved books" value={String(model.favoriteBooksCount)} />
              <Stat label="Finished" value={String(model.finishedBooksCount)} />
            </View>
            {model.booksLoading ? <Text style={appStyles.helperText}>Loading books from API...</Text> : null}
            {model.booksError ? <Text style={appStyles.errorText}>{model.booksError}</Text> : null}
          </Card>

          <Card>
            <Text style={appStyles.sectionTitle}>Finished in this club</Text>
            {model.finishedBooks.length === 0 ? (
              <Text style={appStyles.bodyText}>No finished books tracked in this club yet.</Text>
            ) : (
              <View style={appStyles.memberRow}>
                {model.finishedBooks.slice(0, 4).map((book) => (
                  <View key={`club-finished-${book.id}`} style={appStyles.memberChip}>
                    <Text style={appStyles.memberName}>{book.title}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>

          <Card>
            <Text style={appStyles.sectionTitle}>Members</Text>
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
          </>
          ) : null}
          {showOverview ? (
            <Card accent>
              <Text style={appStyles.sectionTitle}>Club actions</Text>
              <View style={appStyles.pickModeRow}>
                <Pressable
                  style={({ pressed }) => [
                    appStyles.neuButton,
                    appStyles.primaryButton,
                    appStyles.flexButton,
                    pressed ? appStyles.primaryButtonPressed : null,
                  ]}
                  onPress={actions.onOpenCreateClub}
                >
                  <Text style={appStyles.primaryButtonText}>Create a club</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    appStyles.neuButton,
                    appStyles.primaryButton,
                    appStyles.flexButton,
                    pressed ? appStyles.primaryButtonPressed : null,
                  ]}
                  onPress={actions.onOpenJoinClub}
                >
                  <Text style={appStyles.primaryButtonText}>Join a club</Text>
                </Pressable>
              </View>
              {model.showSwitchClub ? (
                <Pressable
                  style={({ pressed }) => [
                    appStyles.secondaryButton,
                    appStyles.fullWidthButton,
                    pressed ? appStyles.secondaryButtonPressed : null,
                  ]}
                  onPress={actions.onOpenSwitchClub}
                >
                  <Text style={appStyles.secondaryButtonText}>Switch club</Text>
                </Pressable>
              ) : null}
              {model.clubActionError ? <Text style={appStyles.errorText}>{model.clubActionError}</Text> : null}
            </Card>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
