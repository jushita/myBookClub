import React, { useState } from "react";
import { Animated, Image, Pressable, Text, TextInput, View } from "react-native";
import Svg, { Circle, G, Line, Path, Text as SvgText } from "react-native-svg";
import { getBookCoverUrl } from "../../data/bookCoverFallbacks";
import { WheelEngine } from "../../domain/WheelEngine";
import { useActionFeedback } from "../../hooks/useActionFeedback";
import { fetchBookDetails, mergeDetailedBook } from "../../services/api";
import { appStyles } from "../../styles/appStyles";
import type { PickNextScreenActions, PickNextScreenModel } from "../../types/screenModels";
import type { Book } from "../../types";
import { BookCard } from "../BookCard";
import { BookDetailsModal } from "../BookDetailsModal";
import { Card } from "../common/Card";

type PickNextScreenProps = {
  model: PickNextScreenModel;
  actions: PickNextScreenActions;
};

export function PickNextScreen({ model, actions }: PickNextScreenProps) {
  const { labels, runWithFeedback } = useActionFeedback();
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [bookDetailsLoading, setBookDetailsLoading] = useState(false);
  const getBookLookupKey = (book: Pick<Book, "title" | "author">) =>
    `${book.title.trim().toLowerCase()}::${book.author.trim().toLowerCase()}`;
  const wheelWinnerIsPicked = model.wheelResult
    ? model.currentPickedBookId === model.wheelResult.id ||
      model.currentPickedBookKeys.includes(getBookLookupKey(model.wheelResult))
    : false;
  const renderSuggestedBookCard = (book: Book & { matchReason?: string }) => (
    <View key={book.id} style={appStyles.candidateRow}>
      <View style={appStyles.aiSuggestionCardTop}>
        {getBookCoverUrl(book) ? (
          <Image source={{ uri: getBookCoverUrl(book)! }} style={appStyles.aiSuggestionCover} />
        ) : (
          <View style={appStyles.aiSuggestionCoverPlaceholder}>
            <Text style={appStyles.aiSuggestionCoverPlaceholderText}>Cover</Text>
          </View>
        )}
        <View style={appStyles.aiSuggestionCopy}>
          <Text style={appStyles.candidateTitle}>{book.title}</Text>
          <Text style={appStyles.candidateMeta}>{book.author}</Text>
          <Text style={appStyles.aiSuggestionDescription} numberOfLines={4}>
            {book.description || book.note}
          </Text>
        </View>
      </View>
      <View style={appStyles.candidateActionStack}>
        <Pressable
          style={({ pressed }) => [
            appStyles.neuButton,
            appStyles.primaryButton,
            appStyles.candidatePrimaryAction,
            pressed ? appStyles.primaryButtonPressed : null,
          ]}
          onPress={() => void runWithFeedback(`picknext-want-${book.id}`, "Added", () => actions.onAddSuggestedBookToWantToRead(book))}
        >
          <Text style={appStyles.primaryButtonText}>{labels[`picknext-want-${book.id}`] || "Want to Read"}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            appStyles.secondaryButton,
            appStyles.candidateSecondaryAction,
            pressed ? appStyles.secondaryButtonPressed : null,
          ]}
          onPress={() =>
            void runWithFeedback(
              `picknext-club-${book.id}`,
              model.currentPickedBookId === book.id || model.currentPickedBookKeys.includes(getBookLookupKey(book))
                ? "Cleared"
                : "Picked",
              () => actions.onPickSuggestedBookForClub(book)
            )
          }
        >
          <Text style={appStyles.secondaryButtonText}>
            {labels[`picknext-club-${book.id}`] ||
              (model.currentPickedBookId === book.id || model.currentPickedBookKeys.includes(getBookLookupKey(book))
                ? "Picked"
                : "Pick For Club")}
          </Text>
        </Pressable>
      </View>
    </View>
  );

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
      <Card>
        <Text style={appStyles.sectionTitle}>Choose your method</Text>
        <View style={appStyles.pickModeRow}>
          {[
            { mode: "ai" as const, title: "AI Pick", meta: "Taste-led" },
            { mode: "wheel" as const, title: "Wheel", meta: "Spin to pick" },
            { mode: "randomizer" as const, title: "Randomize", meta: "Group shelf" },
          ].map((option) => (
            <Pressable
              key={option.mode}
              style={({ pressed }) => [
                appStyles.pickModeButton,
                model.pickMode === option.mode ? appStyles.pickModeButtonActive : null,
                pressed ? appStyles.chipPressed : null,
              ]}
              onPress={() => actions.onPickModeChange(option.mode)}
            >
              <Text style={[appStyles.pickModeTitle, model.pickMode === option.mode ? appStyles.pickModeTitleActive : null]}>
                {option.title}
              </Text>
              <Text style={[appStyles.pickModeMeta, model.pickMode === option.mode ? appStyles.pickModeMetaActive : null]}>
                {option.meta}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {model.pickMode === "randomizer" ? (
        <Card accent>
          <Text style={appStyles.sectionTitle}>Randomizer</Text>
          <Text style={appStyles.bodyText}>
            Shuffle from the books saved by {model.selectedClub?.name || "your club"} and let luck pick the next read.
          </Text>
          <View style={appStyles.candidateStack}>
            {model.randomizerPool.slice(0, 3).map((book) => (
              <View key={book.id} style={appStyles.candidateRow}>
                <Text style={appStyles.candidateTitle}>{book.title}</Text>
                <Text style={appStyles.candidateMeta}>{book.author}</Text>
              </View>
            ))}
          </View>
          <Pressable
            style={({ pressed }) => [
              appStyles.neuButton,
              appStyles.primaryButton,
              pressed ? appStyles.primaryButtonPressed : null,
            ]}
            onPress={actions.onRunRandomizer}
          >
            <Text style={appStyles.primaryButtonText}>Run randomizer</Text>
          </Pressable>
          {model.randomizerResult ? (
            <View key={`${model.randomizerResult.id}-${model.randomizerRunCount}`} style={appStyles.randomizerWinnerCard}>
              <Text style={appStyles.randomizerWinnerLabel}>Picked for your club</Text>
              <Text style={appStyles.randomizerWinnerTitle}>{model.randomizerResult.title}</Text>
              <Text style={appStyles.randomizerWinnerMeta}>{model.randomizerResult.author}</Text>
              <Text style={appStyles.randomizerWinnerBody}>
                The randomizer landed here from the current club shelf.
              </Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      {model.pickMode === "wheel" ? (
        <Card accent>
          <Text style={appStyles.sectionTitle}>Wheel of fortune</Text>
          <Text style={appStyles.bodyText}>
            Add 2 to {model.maxWheelBooks} books, then spin the wheel to pick the club's next read.
          </Text>
          <View style={appStyles.wheelInputRow}>
            <TextInput
              value={model.wheelBookInput}
              onChangeText={actions.onWheelBookInputChange}
              placeholder="Search by title, author, or genre"
              placeholderTextColor="rgba(255, 232, 244, 0.52)"
              style={[appStyles.field, appStyles.wheelField]}
              editable={!model.wheelSpinning}
            />
            <Pressable
              style={({ pressed }) => [
                appStyles.neuButton,
                appStyles.wheelAddButton,
                model.wheelSpinning ? appStyles.buttonDisabled : null,
                pressed ? appStyles.primaryButtonPressed : null,
              ]}
              onPress={actions.onAddWheelBook}
              disabled={model.wheelSpinning}
            >
              <Text style={appStyles.primaryButtonText}>Add</Text>
            </Pressable>
          </View>
          {model.wheelBookInput.trim() ? (
            <View style={appStyles.candidateStack}>
              {model.wheelSearchResults.slice(0, 6).map((book) => (
                <Pressable
                  key={book.id}
                  style={({ pressed }) => [
                    appStyles.searchResultRow,
                    model.selectedWheelBookId === book.id ? appStyles.searchResultRowActive : null,
                    pressed ? appStyles.chipPressed : null,
                  ]}
                  onPress={() => actions.onSelectWheelBook(book.id)}
                >
                  <View style={appStyles.searchResultCopy}>
                    <Text style={appStyles.candidateTitle}>{book.title}</Text>
                    <Text style={appStyles.candidateMeta}>{book.author}</Text>
                  </View>
                  <Text style={appStyles.searchResultChevron}>›</Text>
                </Pressable>
              ))}
              {model.wheelSearchResults.length === 0 ? (
                <Text style={appStyles.bodyText}>No books matched that search.</Text>
              ) : (
                <Text style={appStyles.helperText}>Tap a result, then add it to the wheel.</Text>
              )}
            </View>
          ) : null}
          <Text style={appStyles.helperText}>{model.wheelBooks.length} of {model.maxWheelBooks} books added</Text>
          <View style={appStyles.wheelShell}>
            <View style={appStyles.wheelPointer} />
            <Animated.View style={[appStyles.wheelPlaceholder, { transform: [{ rotate: model.wheelRotation }] }]}>
              <Svg width={WheelEngine.SIZE} height={WheelEngine.SIZE} viewBox={`0 0 ${WheelEngine.SIZE} ${WheelEngine.SIZE}`}>
                {model.wheelSlices.length > 0 ? (
                  <>
                    {model.wheelSlices.map((slice) => (
                      <Path
                        key={slice.book}
                        d={slice.path}
                        fill={model.wheelWinnerIndex === slice.index ? "rgba(255, 244, 181, 0.96)" : slice.fill}
                        stroke="rgba(255,255,255,0.55)"
                        strokeWidth={1.5}
                      />
                    ))}
                    {model.wheelSlices.map((slice, index) => {
                      const boundaryPoint = model.wheelEngine.getBoundaryPoint(index, model.wheelSlices.length);

                      return (
                        <Line
                          key={`${slice.book}-separator`}
                          x1={WheelEngine.CENTER}
                          y1={WheelEngine.CENTER}
                          x2={boundaryPoint.x}
                          y2={boundaryPoint.y}
                          stroke="rgba(255,255,255,0.34)"
                          strokeWidth={1}
                        />
                      );
                    })}
                    <Circle
                      cx={WheelEngine.CENTER}
                      cy={WheelEngine.CENTER}
                      r={WheelEngine.RADIUS}
                      fill="transparent"
                      stroke="rgba(255,255,255,0.3)"
                      strokeWidth={1.5}
                    />
                    {model.wheelSlices.map((slice) => (
                      <G key={`${slice.book}-label`}>
                        {slice.labelLines.map((line, lineIndex) => (
                          <SvgText
                            key={`${slice.book}-${lineIndex}`}
                            x={slice.label.x}
                            y={slice.label.y + lineIndex * 12 - (slice.labelLines.length - 1) * 6}
                            fill={model.wheelWinnerIndex === slice.index ? "#6D4199" : "#FFF8FD"}
                            fontSize="10"
                            fontWeight="800"
                            textAnchor="middle"
                          >
                            {line}
                          </SvgText>
                        ))}
                      </G>
                    ))}
                    <Circle
                      cx={WheelEngine.CENTER}
                      cy={WheelEngine.CENTER}
                      r={38}
                      fill="rgba(131, 76, 190, 0.95)"
                      stroke="rgba(255,255,255,0.78)"
                      strokeWidth={2}
                    />
                  </>
                ) : (
                  <>
                    {model.defaultWheelSlices.map((slice, index) => (
                      <Path
                        key={`default-slice-${index}`}
                        d={slice.path}
                        fill={slice.fill}
                        stroke="rgba(255,255,255,0.32)"
                        strokeWidth={1.25}
                      />
                    ))}
                    <Circle
                      cx={WheelEngine.CENTER}
                      cy={WheelEngine.CENTER}
                      r={WheelEngine.RADIUS}
                      fill="transparent"
                      stroke="rgba(255,255,255,0.24)"
                      strokeWidth={1.5}
                    />
                    <Circle
                      cx={WheelEngine.CENTER}
                      cy={WheelEngine.CENTER}
                      r={38}
                      fill="rgba(255,255,255,0.95)"
                      stroke="rgba(255,255,255,0.72)"
                      strokeWidth={2}
                    />
                  </>
                )}
              </Svg>
              {model.wheelBooks.length > 0 ? <View style={appStyles.wheelHubOverlay} pointerEvents="none" /> : null}
            </Animated.View>
          </View>
          <View style={appStyles.memberRow}>
            {model.wheelBooks.map((book) => (
              <Pressable
                key={book.id}
                style={({ pressed }) => [appStyles.memberChip, pressed ? appStyles.chipPressed : null]}
                onPress={() => actions.onRemoveWheelBook(book.id)}
                disabled={model.wheelSpinning}
              >
                <Text style={appStyles.memberName}>{book.title} ×</Text>
              </Pressable>
            ))}
          </View>
          {model.wheelBooks.length >= 2 ? (
            <Pressable
              style={({ pressed }) => [
                appStyles.neuButton,
                appStyles.primaryButton,
                model.wheelSpinning ? appStyles.buttonDisabled : null,
                pressed ? appStyles.primaryButtonPressed : null,
              ]}
              onPress={actions.onSpinWheel}
              disabled={model.wheelSpinning}
            >
              <Text style={appStyles.primaryButtonText}>{model.wheelSpinning ? "Spinning..." : "Spin wheel"}</Text>
            </Pressable>
          ) : null}
          {model.wheelResult ? (
            <View style={appStyles.candidateStack}>
              <Text style={appStyles.sectionTitle}>Picked for your club</Text>
              <BookCard
                book={model.wheelResult}
                onPress={() => openBookDetails(model.wheelResult!)}
                actionLabel={labels["picknext-wheel-pick"] || (wheelWinnerIsPicked ? "Picked" : "Pick For Club")}
                onActionPress={() =>
                  void runWithFeedback("picknext-wheel-pick", wheelWinnerIsPicked ? "Cleared" : "Picked", () =>
                    actions.onPickSuggestedBookForClub(model.wheelResult!)
                  )
                }
                secondaryActionLabel={labels["picknext-wheel-save"] || "Want to Read"}
                onSecondaryActionPress={() =>
                  void runWithFeedback("picknext-wheel-save", "Added", () =>
                    actions.onAddSuggestedBookToWantToRead(model.wheelResult!)
                  )
                }
              />
            </View>
          ) : null}
        </Card>
      ) : null}

      {model.pickMode === "ai" ? (
        <Card accent>
          <Text style={appStyles.sectionTitle}>AI recommendation</Text>
          <Text style={appStyles.bodyText}>
            Tell the AI what kind of book you want, or leave it blank and it will choose from the club's taste.
          </Text>
          <TextInput
            multiline
            value={model.aiPickerPrompt}
            onChangeText={actions.onAiPromptChange}
            placeholder="A warm fantasy, a sharp thriller, a short literary read..."
            placeholderTextColor="rgba(255, 232, 244, 0.52)"
            style={appStyles.input}
          />
          <Pressable
            style={({ pressed }) => [
              appStyles.neuButton,
              appStyles.primaryButton,
              pressed ? appStyles.primaryButtonPressed : null,
            ]}
            onPress={actions.onGenerateAiPick}
          >
            <Text style={appStyles.primaryButtonText}>Generate AI pick</Text>
          </Pressable>
          {model.aiPickerLoading ? (
            <View style={appStyles.aiStatusCard}>
              <Text style={appStyles.aiStatusEyebrow}>AI scouting in progress</Text>
              <Text style={appStyles.aiStatusTitle}>Scanning shelves, moods, and chart energy...</Text>
              <Text style={appStyles.aiStatusBody}>
                Pulling together picks that feel right for the club instead of just matching a keyword.
              </Text>
            </View>
          ) : null}
          {model.aiPickerGenerated ? (
            model.aiPickerRecommendations.length > 0 ? (
              <View style={appStyles.candidateStack}>
                {model.aiPickerRecommendations.slice(0, 3).map((book, index) =>
                  renderSuggestedBookCard({
                    ...book,
                    matchReason: index === 0 ? undefined : book.matchReason,
                  })
                )}
              </View>
            ) : (
              <Text style={appStyles.bodyText}>No recommendations found. Try a broader prompt.</Text>
            )
          ) : null}
        </Card>
      ) : null}
      <BookDetailsModal visible={Boolean(selectedBook)} book={selectedBook} loading={bookDetailsLoading} onClose={() => setSelectedBook(null)} />
    </View>
  );
}
