import React from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { Book } from "../../types";
import { appStyles } from "../../styles/appStyles";
import { Card } from "../common/Card";

type SearchScreenProps = {
  searchTerm: string;
  filteredSearchBooks: Book[];
  selectedSearchBook: Book | null;
  savedSearchBookIds: string[];
  onSearchTermChange: (value: string) => void;
  onSelectBook: (bookId: string) => void;
  onToggleSaveBook: (book: Book) => void;
};

export function SearchScreen({
  searchTerm,
  filteredSearchBooks,
  selectedSearchBook,
  savedSearchBookIds,
  onSearchTermChange,
  onSelectBook,
  onToggleSaveBook,
}: SearchScreenProps) {
  return (
    <View style={appStyles.stack}>
      <Card accent>
        <Text style={appStyles.sectionTitle}>Search books</Text>
        <TextInput
          value={searchTerm}
          onChangeText={onSearchTermChange}
          placeholder="Search by title, author, or genre"
          placeholderTextColor="rgba(255, 232, 244, 0.52)"
          style={appStyles.field}
        />
      </Card>

      <Card>
        <Text style={appStyles.sectionTitle}>Results</Text>
        <View style={appStyles.candidateStack}>
          {filteredSearchBooks.slice(0, 6).map((book) => (
            <Pressable
              key={book.id}
              style={[appStyles.searchResultRow, selectedSearchBook?.id === book.id ? appStyles.searchResultRowActive : null]}
              onPress={() => onSelectBook(book.id)}
            >
              <View style={appStyles.searchResultCopy}>
                <Text style={appStyles.candidateTitle}>{book.title}</Text>
                <Text style={appStyles.candidateMeta}>{book.author}</Text>
              </View>
              <Text style={appStyles.searchResultChevron}>›</Text>
            </Pressable>
          ))}
          {filteredSearchBooks.length === 0 ? <Text style={appStyles.bodyText}>No books matched that search.</Text> : null}
        </View>
      </Card>

      {selectedSearchBook ? (
        <Card accent>
          <View style={appStyles.searchDetailHeader}>
            <View style={appStyles.searchDetailCopy}>
              <Text style={appStyles.sectionTitle}>Book details</Text>
              <Text style={appStyles.clubName}>{selectedSearchBook.title}</Text>
              <Text style={appStyles.bodyText}>{selectedSearchBook.author}</Text>
            </View>
            <Pressable style={appStyles.searchStarButton} onPress={() => onToggleSaveBook(selectedSearchBook)}>
              <Text style={appStyles.searchStarIcon}>
                {savedSearchBookIds.includes(selectedSearchBook.id) ? "★" : "☆"}
              </Text>
            </Pressable>
          </View>
          <Text style={appStyles.searchSynopsisLabel}>Synopsis</Text>
          <Text style={appStyles.bodyText}>{selectedSearchBook.note}</Text>
        </Card>
      ) : null}
    </View>
  );
}
