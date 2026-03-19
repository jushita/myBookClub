import React from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { getBookCoverUrl } from "../data/bookCoverFallbacks";
import { appStyles } from "../styles/appStyles";
import type { Book } from "../types";
import { Card } from "./common/Card";

type Props = {
  visible: boolean;
  book: Book | null;
  loading?: boolean;
  onClose: () => void;
};

export function BookDetailsModal({ visible, book, loading = false, onClose }: Props) {
  const coverImageUrl = book ? getBookCoverUrl(book) : null;
  const synopsis = book?.synopsis || book?.description || book?.note || "Synopsis unavailable.";
  const hasRatings = typeof book?.averageRating === "number" || typeof book?.ratingsCount === "number";

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={appStyles.searchModalBackdrop}>
        <View style={appStyles.searchModalCard}>
          <View style={appStyles.searchModalTopRow}>
            <Text style={appStyles.sectionTitle}>Book details</Text>
            <Pressable
              style={({ pressed }) => [appStyles.searchModalCloseButton, pressed ? appStyles.secondaryButtonPressed : null]}
              onPress={onClose}
            >
              <Text style={appStyles.searchModalCloseText}>Close</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={appStyles.discussionLoadingCard}>
              <View style={appStyles.discussionLoadingHeader}>
                <ActivityIndicator size="small" color="#FFD7AE" />
                <Text style={appStyles.discussionLoadingTitle}>Loading book details</Text>
              </View>
              <Text style={appStyles.discussionLoadingBody}>Fetching synopsis, cover metadata, and ratings.</Text>
            </View>
          ) : book ? (
            <ScrollView contentContainerStyle={{ gap: 14 }} showsVerticalScrollIndicator={false}>
              <Card accent>
                <View style={appStyles.currentBookHero}>
                  {coverImageUrl ? (
                    <Image source={{ uri: coverImageUrl }} style={appStyles.currentBookCoverImage} />
                  ) : (
                    <View style={appStyles.currentBookCover}>
                      <Text style={appStyles.currentBookCoverText}>Cover</Text>
                    </View>
                  )}
                  <View style={appStyles.currentBookCopy}>
                    <Text style={appStyles.clubName}>{book.title}</Text>
                    <Text style={appStyles.bodyText}>{book.author}</Text>
                    {book.genre ? <Text style={appStyles.helperText}>{book.genre}</Text> : null}
                    {hasRatings ? (
                      <Text style={appStyles.helperText}>
                        {typeof book.averageRating === "number" ? `Rating ${book.averageRating.toFixed(2)}` : ""}
                        {typeof book.averageRating === "number" && typeof book.ratingsCount === "number" ? " · " : ""}
                        {typeof book.ratingsCount === "number" ? `${book.ratingsCount.toLocaleString()} ratings` : ""}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Card>

              <Card>
                <Text style={appStyles.sectionTitle}>Synopsis</Text>
                <Text style={appStyles.bodyText}>{synopsis}</Text>
              </Card>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
