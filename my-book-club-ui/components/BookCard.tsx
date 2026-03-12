import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Book, Recommendation } from "../types";

type Props = {
  book: Book | Recommendation;
  recommendation?: boolean;
};

export function BookCard({ book, recommendation = false }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{book.title}</Text>
          <Text style={styles.author}>{book.author}</Text>
        </View>
        <View style={styles.genrePill}>
          <Text style={styles.genreText}>{book.genre}</Text>
        </View>
      </View>
      <Text style={styles.note}>
        {recommendation && "matchReason" in book ? book.matchReason : book.note}
      </Text>
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
  },
  author: {
    color: "rgba(255, 230, 242, 0.8)",
    fontSize: 14,
    fontWeight: "600",
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
  },
  genreText: {
    color: "#FFF9F4",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  note: {
    color: "rgba(255, 242, 249, 0.92)",
    fontSize: 15,
    lineHeight: 22,
  },
});
