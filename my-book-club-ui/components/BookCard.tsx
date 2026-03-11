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
    backgroundColor: "#FFFDF9",
    borderRadius: 22,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: "#E7DACA",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  titleBlock: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: "#201A15",
    fontSize: 18,
    fontWeight: "800",
  },
  author: {
    color: "#5E554C",
    fontSize: 14,
    fontWeight: "600",
  },
  genrePill: {
    backgroundColor: "#F2E6D8",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  genreText: {
    color: "#6B5238",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  note: {
    color: "#544A40",
    fontSize: 15,
    lineHeight: 21,
  },
});
