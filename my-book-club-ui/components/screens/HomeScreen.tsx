import React, { useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import { useActionFeedback } from "../../hooks/useActionFeedback";
import { fetchBookDetails, mergeDetailedBook } from "../../services/api";
import { appStyles } from "../../styles/appStyles";
import type { HomeScreenActions, HomeScreenModel } from "../../types/screenModels";
import type { Book } from "../../types";
import { BookCard } from "../BookCard";
import { BookDetailsModal } from "../BookDetailsModal";
import { Card } from "../common/Card";
import { GuestAccessCard } from "../common/GuestAccessCard";

type HomeScreenProps = {
  model: HomeScreenModel;
  actions: HomeScreenActions;
};

export function HomeScreen({ model, actions }: HomeScreenProps) {
  const { labels, runWithFeedback } = useActionFeedback();
  const heroRecommendation = model.aiPickerRecommendations[0];
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [bookDetailsLoading, setBookDetailsLoading] = useState(false);

  const openBookDetails = (book: Book) => {
    setSelectedBook(book);
    setBookDetailsLoading(true);
    void fetchBookDetails(book.id)
      .then((details) => {
        setSelectedBook(mergeDetailedBook(book, details));
      })
      .finally(() => {
        setBookDetailsLoading(false);
      });
  };

  return (
    <View style={appStyles.stack}>
      {model.authUser ? (
        <>
          <Card accent>
            <Text style={appStyles.sectionTitle}>Ask AI</Text>
            <Text style={appStyles.bodyText}>
              Ask for a vibe, a genre mashup, or a very specific kind of read and save the best hit straight to your shelf.
            </Text>
            <TextInput
              multiline
              value={model.aiPickerPrompt}
              onChangeText={actions.onAiPromptChange}
              placeholder="A romantic gothic read, a smart fast thriller, a warm fantasy with found family..."
              placeholderTextColor="rgba(255, 232, 244, 0.52)"
              style={appStyles.input}
            />
            <Pressable style={[appStyles.neuButton, appStyles.primaryButton]} onPress={actions.onGenerateAiPick}>
              <Text style={appStyles.primaryButtonText}>Get recommendation</Text>
            </Pressable>
            {model.aiPickerLoading ? (
              <View style={appStyles.aiStatusCard}>
                <Text style={appStyles.aiStatusEyebrow}>AI librarian at work</Text>
                <Text style={appStyles.aiStatusTitle}>Pulling a book that actually fits your mood...</Text>
                <Text style={appStyles.aiStatusBody}>
                  Checking your prompt against the catalog, club taste, and a few likely page-turners.
                </Text>
              </View>
            ) : null}
            {model.aiPickerGenerated ? (
              heroRecommendation ? (
                <BookCard
                  book={heroRecommendation}
                  recommendation
                  onPress={() => openBookDetails(heroRecommendation)}
                  actionLabel={labels["home-ai-save"] || "Want to Read"}
                  onActionPress={() =>
                    void runWithFeedback("home-ai-save", "Added", () =>
                      actions.onAddHomeAiPickToWantToRead(heroRecommendation)
                    )
                  }
                />
              ) : (
                <View style={appStyles.randomizerWinnerCard}>
                  <Text style={appStyles.randomizerWinnerTitle}>No recommendations found</Text>
                  <Text style={appStyles.randomizerWinnerBody}>Try a broader prompt or seed more books into the catalog.</Text>
                </View>
              )
            ) : null}
          </Card>

          <Card>
            <Text style={appStyles.sectionTitle}>Because of your taste</Text>
            <Text style={appStyles.bodyText}>
              Quick picks shaped by your shelf, your club vibe, and the kinds of books you have been circling lately.
            </Text>
            <View style={appStyles.stack}>
              {model.personalizedRecommendations.length > 0 ? (
                model.personalizedRecommendations.map((book) => (
                  <BookCard
                    key={`home-personalized-${book.id}`}
                    book={book}
                    recommendation
                    onPress={() => openBookDetails(book)}
                    actionLabel={labels[`home-personalized-${book.id}`] || "Want to Read"}
                    onActionPress={() =>
                      void runWithFeedback(`home-personalized-${book.id}`, "Added", () =>
                        actions.onAddPersonalizedPickToWantToRead(book)
                      )
                    }
                  />
                ))
              ) : (
                <Text style={appStyles.helperText}>Save a few books and this section will get sharper fast.</Text>
              )}
            </View>
          </Card>

          <Card>
            <Text style={appStyles.sectionTitle}>Currently reading with your club</Text>
            {model.currentClubBookDetails ? (
              <View style={appStyles.currentBookHero}>
                {model.currentClubBookDetails.coverImageUrl ? (
                  <Image source={{ uri: model.currentClubBookDetails.coverImageUrl }} style={appStyles.currentBookCoverImage} />
                ) : (
                  <View style={appStyles.currentBookCover}>
                    <Text style={appStyles.currentBookCoverText}>Cover</Text>
                  </View>
                )}
                <View style={appStyles.currentBookCopy}>
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
                    onPress={actions.onOpenClubs}
                  >
                    <Text style={appStyles.primaryButtonText}>Open club</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Text style={appStyles.bodyText}>No active club read yet. Pick one from your library or choose the next club book.</Text>
            )}
          </Card>

          <Card accent>
            <Text style={appStyles.sectionTitle}>Quick actions</Text>
            <View style={appStyles.pickModeRow}>
              <Pressable
                style={({ pressed }) => [
                  appStyles.neuButton,
                  appStyles.primaryButton,
                  appStyles.flexButton,
                  pressed ? appStyles.primaryButtonPressed : null,
                ]}
                onPress={actions.onOpenLibrary}
              >
                <Text style={appStyles.primaryButtonText}>Open library</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  appStyles.neuButton,
                  appStyles.primaryButton,
                  appStyles.flexButton,
                  pressed ? appStyles.primaryButtonPressed : null,
                ]}
                onPress={actions.onOpenPickNext}
              >
                <Text style={appStyles.primaryButtonText}>Pick next book</Text>
              </Pressable>
            </View>
            <Text style={appStyles.helperText}>
              {model.selectedClub?.name || "Your club"} currently has {model.favoriteBooksCount} books on the active shelf.
            </Text>
          </Card>
        </>
      ) : (
        <>
          <GuestAccessCard
            title="Sign in or sign up"
            description="Create an account to join a club, start your own club, and save picks across the app."
            onSignIn={actions.onSignIn}
            onSignUp={actions.onSignUp}
          />

          <Card>
            <Text style={appStyles.sectionTitle}>AI-powered recommendations</Text>
            <Text style={appStyles.bodyText}>
              Tell us what kind of book you want and get a quick recommendation instantly.
            </Text>
            <TextInput
              multiline
              value={model.aiPickerPrompt}
              onChangeText={actions.onAiPromptChange}
              placeholder="A thoughtful literary novel, a romantic fantasy, a sharp mystery..."
              placeholderTextColor="rgba(255, 232, 244, 0.52)"
              style={appStyles.input}
            />
            <Pressable style={[appStyles.neuButton, appStyles.primaryButton]} onPress={actions.onGenerateAiPick}>
              <Text style={appStyles.primaryButtonText}>Generate recommendation</Text>
            </Pressable>
            {model.aiPickerLoading ? (
              <View style={appStyles.aiStatusCard}>
                <Text style={appStyles.aiStatusEyebrow}>AI librarian at work</Text>
                <Text style={appStyles.aiStatusTitle}>Reading the room and chasing your next obsession...</Text>
                <Text style={appStyles.aiStatusBody}>
                  Blending your prompt with catalog signals, club taste, and a little dramatic flair.
                </Text>
              </View>
            ) : null}
            {model.aiPickerGenerated ? (
              heroRecommendation ? (
                <BookCard book={heroRecommendation} recommendation onPress={() => openBookDetails(heroRecommendation)} />
              ) : (
                <View style={appStyles.randomizerWinnerCard}>
                  <Text style={appStyles.randomizerWinnerTitle}>No recommendations found</Text>
                  <Text style={appStyles.randomizerWinnerBody}>
                    Try a broader prompt or add more books to the catalog.
                  </Text>
                </View>
              )
            ) : null}
          </Card>
        </>
      )}
      <BookDetailsModal visible={Boolean(selectedBook)} book={selectedBook} loading={bookDetailsLoading} onClose={() => setSelectedBook(null)} />
    </View>
  );
}
