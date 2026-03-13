import React from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { appStyles } from "../../styles/appStyles";
import type { SearchScreenActions, SearchScreenModel } from "../../types/screenModels";
import { Card } from "../common/Card";

type SearchScreenProps = {
  model: SearchScreenModel;
  actions: SearchScreenActions;
};

export function SearchScreen({ model, actions }: SearchScreenProps) {
  return (
    <View style={appStyles.stack}>
      <Card accent>
        <Text style={appStyles.sectionTitle}>Search books</Text>
        <TextInput
          value={model.searchTerm}
          onChangeText={actions.onSearchTermChange}
          placeholder="Search by title, author, or genre"
          placeholderTextColor="rgba(255, 232, 244, 0.52)"
          style={appStyles.field}
        />
      </Card>

      <Card>
        <Text style={appStyles.sectionTitle}>Results</Text>
        <View style={appStyles.candidateStack}>
          {model.filteredSearchBooks.slice(0, 6).map((book) => (
            <Pressable
              key={book.id}
              style={[appStyles.searchResultRow, model.selectedSearchBook?.id === book.id ? appStyles.searchResultRowActive : null]}
              onPress={() => actions.onSelectBook(book.id)}
            >
              <View style={appStyles.searchResultCopy}>
                <Text style={appStyles.candidateTitle}>{book.title}</Text>
                <Text style={appStyles.candidateMeta}>{book.author}</Text>
              </View>
              <Text style={appStyles.searchResultChevron}>›</Text>
            </Pressable>
          ))}
          {model.filteredSearchBooks.length === 0 ? <Text style={appStyles.bodyText}>No books matched that search.</Text> : null}
        </View>
      </Card>

      {model.selectedSearchBook ? (
        <Card accent>
          <View style={appStyles.searchDetailHeader}>
            <View style={appStyles.searchDetailCopy}>
              <Text style={appStyles.sectionTitle}>Book details</Text>
              <Text style={appStyles.clubName}>{model.selectedSearchBook.title}</Text>
              <Text style={appStyles.bodyText}>{model.selectedSearchBook.author}</Text>
            </View>
            <Pressable style={appStyles.searchStarButton} onPress={() => actions.onToggleSaveBook(model.selectedSearchBook!)}>
              <Text style={appStyles.searchStarIcon}>
                {model.savedSearchBookIds.includes(model.selectedSearchBook.id) ? "★" : "☆"}
              </Text>
            </Pressable>
          </View>
          <Text style={appStyles.searchSynopsisLabel}>Synopsis</Text>
          <Text style={appStyles.bodyText}>{model.selectedSearchBook.note}</Text>
        </Card>
      ) : null}
    </View>
  );
}
