import React from "react";
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from "react-native";
import { useActionFeedback } from "../../hooks/useActionFeedback";
import { appStyles } from "../../styles/appStyles";
import type { SearchScreenActions, SearchScreenModel } from "../../types/screenModels";
import { BookCard } from "../BookCard";
import { Card } from "../common/Card";

function getBookLookupKey(title: string, author: string) {
  return `${title.trim().toLowerCase()}::${author.trim().toLowerCase()}`;
}

type SearchScreenProps = {
  model: SearchScreenModel;
  actions: SearchScreenActions;
};

export function SearchScreen({ model, actions }: SearchScreenProps) {
  const { labels, runWithFeedback } = useActionFeedback();
  const selectedBookIsSaved = model.selectedSearchBook
    ? model.savedSearchBookIds.includes(model.selectedSearchBook.id) ||
      model.savedSearchBookKeys.includes(getBookLookupKey(model.selectedSearchBook.title, model.selectedSearchBook.author))
    : false;
  const selectedBookIsPicked = model.selectedSearchBook
    ? model.currentPickedBookId === model.selectedSearchBook.id ||
      model.currentPickedBookKeys.includes(getBookLookupKey(model.selectedSearchBook.title, model.selectedSearchBook.author))
    : false;

  return (
    <View style={appStyles.stack}>
      <Card accent>
        <TextInput
          value={model.searchTerm}
          onChangeText={actions.onSearchTermChange}
          placeholder="Search by title, author, or genre"
          placeholderTextColor="rgba(255, 232, 244, 0.52)"
          style={appStyles.field}
        />
      </Card>

      <Card>
        <View style={appStyles.candidateStack}>
          {model.searchTerm.trim() && model.searchLoading ? (
            <View style={appStyles.discussionLoadingCard}>
              <View style={appStyles.discussionLoadingHeader}>
                <ActivityIndicator size="small" color="#FFD7AE" />
                <Text style={appStyles.discussionLoadingTitle}>Searching books</Text>
              </View>
              <Text style={appStyles.discussionLoadingBody}>
                Checking your catalog first, then looking wider if needed.
              </Text>
            </View>
          ) : null}
          {model.filteredSearchBooks.slice(0, 6).map((book) => (
            <Pressable
              key={book.id}
              style={({ pressed }) => [
                appStyles.searchResultRow,
                model.selectedSearchBook?.id === book.id ? appStyles.searchResultRowActive : null,
                pressed ? appStyles.chipPressed : null,
              ]}
              onPress={() => actions.onSelectBook(book.id)}
              disabled={model.searchLoading}
            >
              <View style={appStyles.searchResultCopy}>
                <Text style={appStyles.candidateTitle}>{book.title}</Text>
                <Text style={appStyles.candidateMeta}>{book.author}</Text>
              </View>
              <Text style={appStyles.searchResultChevron}>›</Text>
            </Pressable>
          ))}
          {model.searchTerm.trim() && !model.searchLoading && model.filteredSearchBooks.length === 0 ? (
            <Text style={appStyles.bodyText}>No books matched that search.</Text>
          ) : null}
          {!model.searchTerm.trim() ? (
            <Text style={appStyles.helperText}>Start typing to search your catalog and Open Library.</Text>
          ) : null}
        </View>
      </Card>

      <Modal
        visible={Boolean(model.selectedSearchBook)}
        animationType="fade"
        transparent
        onRequestClose={actions.onCloseBookDetails}
      >
        <View style={appStyles.searchModalBackdrop}>
          <View style={appStyles.searchModalCard}>
            {model.selectedSearchBook ? (
              <>
                <View style={appStyles.searchModalTopRow}>
                  <Text style={appStyles.sectionTitle}>Book details</Text>
                  <Pressable
                    style={({ pressed }) => [
                      appStyles.searchModalCloseButton,
                      pressed ? appStyles.secondaryButtonPressed : null,
                    ]}
                    onPress={actions.onCloseBookDetails}
                  >
                    <Text style={appStyles.searchModalCloseText}>Close</Text>
                  </Pressable>
                </View>

                <BookCard
                  book={{
                    ...model.selectedSearchBook,
                    genre: selectedBookIsSaved ? `${model.selectedSearchBook.genre} · Saved` : model.selectedSearchBook.genre,
                  }}
                  actionLabel={labels["search-want"] || "Want to Read"}
                  onActionPress={() =>
                    void runWithFeedback("search-want", "Added", () =>
                      actions.onAddSearchBookToWantToRead(model.selectedSearchBook!)
                    )
                  }
                  secondaryActionLabel={labels["search-finished"] || "Finished"}
                  onSecondaryActionPress={() =>
                    void runWithFeedback("search-finished", "Finished", () =>
                      actions.onMarkSearchBookFinished(model.selectedSearchBook!)
                    )
                  }
                  tertiaryActionLabel={labels["search-pick"] || (selectedBookIsPicked ? "Picked" : "Pick For Club")}
                  onTertiaryActionPress={() =>
                    void runWithFeedback("search-pick", selectedBookIsPicked ? "Cleared" : "Picked", () =>
                      actions.onPickSearchBookForClub(model.selectedSearchBook!)
                    )
                  }
                />
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}
