import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { getBookCoverUrl } from "../data/bookCoverFallbacks";
import type { Book, Recommendation } from "../types";

type Props = {
  book: Book | Recommendation;
  recommendation?: boolean;
  onDismiss?: () => void;
  actionLabel?: string;
  onActionPress?: () => void;
  secondaryActionLabel?: string;
  onSecondaryActionPress?: () => void;
  tertiaryActionLabel?: string;
  onTertiaryActionPress?: () => void;
  onPress?: () => void;
};

export function BookCard({
  book,
  recommendation = false,
  onDismiss,
  actionLabel,
  onActionPress,
  secondaryActionLabel,
  onSecondaryActionPress,
  tertiaryActionLabel,
  onTertiaryActionPress,
  onPress,
}: Props) {
  const coverImageUrl = getBookCoverUrl(book);
  const description = book.description || (recommendation && "matchReason" in book ? book.matchReason : book.note);
  const genreLabel = book.genre?.trim() || "";
  const coverMonogram = book.title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <View style={styles.card}>
      <Pressable
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [styles.detailsPressArea, onPress && pressed ? styles.detailsPressAreaPressed : null]}
      >
        <View style={styles.topRow}>
          {coverImageUrl ? (
            <Image source={{ uri: coverImageUrl }} style={styles.coverImage} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <View style={styles.coverPlaceholderGlow} />
              <Text style={styles.coverPlaceholderMonogram}>{coverMonogram || "BK"}</Text>
              <Text style={styles.coverPlaceholderGenre} numberOfLines={2}>
                {book.genre || "Book"}
              </Text>
              <Text style={styles.coverPlaceholderAuthor} numberOfLines={2}>
                {book.author}
              </Text>
            </View>
          )}
          <View style={styles.contentColumn}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>{book.title}</Text>
              <Text style={styles.author}>{book.author}</Text>
            </View>
            {genreLabel ? (
              <View style={styles.headerRow}>
                <View style={styles.genrePill}>
                  <Text style={styles.genreText}>{genreLabel}</Text>
                </View>
              </View>
            ) : null}
            <Text style={styles.note} numberOfLines={4}>
              {description}
            </Text>
          </View>
        </View>
      </Pressable>
      {((actionLabel && onActionPress) ||
        (secondaryActionLabel && onSecondaryActionPress) ||
        (tertiaryActionLabel && onTertiaryActionPress)) ? (
        <View style={styles.actionRow}>
          <View style={styles.leftActionGroup}>
            {onDismiss ? (
              <Pressable
                style={({ pressed }) => [styles.dismissButton, pressed ? styles.dismissButtonPressed : null]}
                onPress={onDismiss}
              >
                <Text style={styles.dismissText}>×</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.rightActionGroup}>
            {tertiaryActionLabel && onTertiaryActionPress ? (
              <Pressable
                style={({ pressed }) => [styles.secondaryActionButton, pressed ? styles.secondaryActionButtonPressed : null]}
                onPress={onTertiaryActionPress}
              >
                <Text style={styles.secondaryActionText}>{tertiaryActionLabel}</Text>
              </Pressable>
            ) : null}
            {secondaryActionLabel && onSecondaryActionPress ? (
              <Pressable
                style={({ pressed }) => [styles.secondaryActionButton, pressed ? styles.secondaryActionButtonPressed : null]}
                onPress={onSecondaryActionPress}
              >
                <Text style={styles.secondaryActionText}>{secondaryActionLabel}</Text>
              </Pressable>
            ) : null}
            {actionLabel && onActionPress ? (
              <Pressable
                style={({ pressed }) => [styles.actionButton, pressed ? styles.actionButtonPressed : null]}
                onPress={onActionPress}
              >
                <Text style={styles.actionText}>{actionLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255, 244, 253, 0.18)",
    borderRadius: 26,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.62)",
    shadowColor: "#5D2F96",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 7,
  },
  detailsPressArea: {
    borderRadius: 18,
  },
  detailsPressAreaPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.995 }],
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  coverImage: {
    width: 92,
    height: 136,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
  coverPlaceholder: {
    width: 92,
    height: 136,
    borderRadius: 18,
    backgroundColor: "rgba(129, 80, 188, 0.62)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.62)",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 12,
    overflow: "hidden",
  },
  coverPlaceholderGlow: {
    position: "absolute",
    top: -18,
    right: -10,
    width: 62,
    height: 62,
    borderRadius: 999,
    backgroundColor: "rgba(255, 205, 132, 0.34)",
  },
  coverPlaceholderMonogram: {
    color: "#FFF8FD",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 6,
  },
  coverPlaceholderGenre: {
    color: "rgba(255, 237, 244, 0.92)",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    textAlign: "center",
    lineHeight: 13,
  },
  coverPlaceholderAuthor: {
    color: "rgba(255, 242, 249, 0.84)",
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 13,
  },
  contentColumn: {
    flex: 1,
    gap: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
  },
  titleBlock: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: "#F8FBFF",
    fontSize: 19,
    fontWeight: "800",
    flexShrink: 1,
  },
  author: {
    color: "rgba(255, 230, 242, 0.8)",
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1,
  },
  genrePill: {
    backgroundColor: "rgba(255, 190, 108, 0.18)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.62)",
    shadowColor: "#9D5A2E",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  genreText: {
    color: "#FFF9F4",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    flexShrink: 1,
  },
  note: {
    color: "rgba(255, 242, 249, 0.92)",
    fontSize: 14,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 10,
  },
  leftActionGroup: {
    width: "100%",
    alignItems: "flex-start",
  },
  rightActionGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    alignItems: "stretch",
    gap: 10,
    width: "100%",
  },
  actionButton: {
    backgroundColor: "rgba(255, 191, 109, 0.16)",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.62)",
    minWidth: 132,
    flexGrow: 1,
    alignItems: "center",
  },
  actionButtonPressed: {
    backgroundColor: "rgba(255, 191, 109, 0.28)",
    transform: [{ scale: 0.98 }],
  },
  actionText: {
    color: "#F7FBFF",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryActionButton: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
    minWidth: 132,
    flexGrow: 1,
    alignItems: "center",
  },
  secondaryActionButtonPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    transform: [{ scale: 0.98 }],
  },
  secondaryActionText: {
    color: "rgba(255, 243, 249, 0.92)",
    fontSize: 14,
    fontWeight: "700",
  },
  dismissButton: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  dismissButtonPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    transform: [{ scale: 0.95 }],
  },
  dismissText: {
    color: "rgba(255, 243, 249, 0.96)",
    fontSize: 20,
    lineHeight: 20,
    fontWeight: "700",
  },
});
