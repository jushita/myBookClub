import React, { useEffect, useState } from "react";
import { ActivityIndicator, Animated, Image, Pressable, Text, TextInput, View } from "react-native";
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

const AI_PICKER_STATUS_ROTATION = [
  {
    eyebrow: "AI scout in progress",
    title: "Scanning shelves, moods, and chart energy...",
    body: "Pulling together picks that feel right for the club instead of just matching a keyword.",
  },
  {
    eyebrow: "AI scout in progress",
    title: "Checking what your club saves versus what it actually finishes...",
    body: "Trying to find the overlap between ambition, taste, and books people will genuinely want to discuss.",
  },
  {
    eyebrow: "AI scout in progress",
    title: "Letting the catalog speak before the model gets too dramatic...",
    body: "Fast retrieval is narrowing the field while the AI looks for something more curated than the obvious answer.",
  },
  {
    eyebrow: "AI scout in progress",
    title: "Pressure-testing a few strong candidates for club chemistry...",
    body: "Balancing tone, momentum, and whether this pick sounds like a conversation waiting to happen.",
  },
  {
    eyebrow: "AI scout in progress",
    title: "Checking whether the club wants messy, smart, or both...",
    body: "Trying to match the real appetite of the group instead of just parroting the prompt back.",
  },
  {
    eyebrow: "AI scout in progress",
    title: "Comparing bold picks with books people will actually finish...",
    body: "A great club choice should start debates, not just gather dust on the shelf.",
  },
  {
    eyebrow: "AI scout in progress",
    title: "Auditioning a shortlist with main-character energy...",
    body: "The obvious candidates made the room. Now the better ones are fighting for the final spot.",
  },
  {
    eyebrow: "AI scout in progress",
    title: "Separating true matches from books that are merely adjacent...",
    body: "Genre overlap is easy. Finding the right tone and discussion potential is the harder part.",
  },
  {
    eyebrow: "AI scout in progress",
    title: "Checking if this pick feels like a meeting or a conversation...",
    body: "The AI is steering away from books that sound respectable but dead on arrival.",
  },
  {
    eyebrow: "AI scout in progress",
    title: "Weighing shelf taste against actual club stamina...",
    body: "Ambitious picks are great until nobody finishes them, so this is getting screened for follow-through too.",
  },
  {
    eyebrow: "AI scout in progress",
    title: "Trying not to recommend the same five books the internet always does...",
    body: "If a less predictable match fits better, it gets extra credit here.",
  },
  {
    eyebrow: "AI scout in progress",
    title: "Checking whether this book has enough spark for a full discussion...",
    body: "The right club pick should give people something to argue about besides scheduling.",
  },
  {
    eyebrow: "AI scout in progress",
    title: "Letting the fast search narrow the field before taste takes over...",
    body: "First the catalog speaks, then the AI decides which candidates actually deserve your attention.",
  },
  {
    eyebrow: "AI scout in progress",
    title: "Looking for the kind of pick that makes everyone say 'fine, I’m in'...",
    body: "The shortlist is being trimmed for momentum, mood, and whether the club can rally behind it.",
  },
  {
    eyebrow: "AI scout in progress",
    title: "Cross-checking taste with how dramatic your next meeting should be...",
    body: "A little friction is healthy. Total indifference is not. This is aiming for the good kind of tension.",
  },
];
export function PickNextScreen({ model, actions }: PickNextScreenProps) {
  const { labels, runWithFeedback } = useActionFeedback();
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [bookDetailsLoading, setBookDetailsLoading] = useState(false);
  const [aiStatusIndex, setAiStatusIndex] = useState(0);
  const getBookLookupKey = (book: Pick<Book, "title" | "author">) =>
    `${book.title.trim().toLowerCase()}::${book.author.trim().toLowerCase()}`;
  const wheelWinnerIsPicked = model.wheelResult
    ? model.currentPickedBookId === model.wheelResult.id ||
      model.currentPickedBookKeys.includes(getBookLookupKey(model.wheelResult))
    : false;

  useEffect(() => {
    if (!model.aiPickerLoading) {
      setAiStatusIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setAiStatusIndex((current) => (current + 1) % AI_PICKER_STATUS_ROTATION.length);
    }, 1700);

    return () => clearInterval(interval);
  }, [model.aiPickerLoading]);

  const aiStatus = AI_PICKER_STATUS_ROTATION[aiStatusIndex] ?? AI_PICKER_STATUS_ROTATION[0];

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
            Shuffle the club's Want to Read shelf and let luck pick the next read.
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
                Picked from the shared Want to Read shelf for this club.
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
                model.wheelSpinning || model.wheelSearchLoading || !model.selectedWheelBookId ? appStyles.buttonDisabled : null,
                pressed ? appStyles.primaryButtonPressed : null,
              ]}
              onPress={actions.onAddWheelBook}
              disabled={model.wheelSpinning || model.wheelSearchLoading || !model.selectedWheelBookId}
            >
              <Text style={appStyles.primaryButtonText}>{model.wheelSearchLoading ? "..." : "Add"}</Text>
            </Pressable>
          </View>
          {model.wheelBookInput.trim() ? (
            <View style={appStyles.candidateStack}>
              {model.wheelSearchLoading ? (
                <View style={appStyles.discussionLoadingCard}>
                  <View style={appStyles.discussionLoadingHeader}>
                    <ActivityIndicator size="small" color="#FFD7AE" />
                    <Text style={appStyles.discussionLoadingTitle}>Searching books</Text>
                  </View>
                  <Text style={appStyles.discussionLoadingBody}>
                    Looking through your catalog first, then widening the search if needed.
                  </Text>
                </View>
              ) : null}
              {model.wheelSearchResults.slice(0, 6).map((book) => (
                <Pressable
                  key={book.id}
                  style={({ pressed }) => [
                    appStyles.searchResultRow,
                    model.selectedWheelBookId === book.id ? appStyles.searchResultRowActive : null,
                    pressed ? appStyles.chipPressed : null,
                  ]}
                  onPress={() => actions.onSelectWheelBook(book.id)}
                  disabled={model.wheelSearchLoading}
                >
                  <View style={appStyles.searchResultCopy}>
                    <Text style={appStyles.candidateTitle}>{book.title}</Text>
                    <Text style={appStyles.candidateMeta}>{book.author}</Text>
                  </View>
                  <Text style={appStyles.searchResultChevron}>›</Text>
                </Pressable>
              ))}
              {!model.wheelSearchLoading && model.wheelSearchResults.length === 0 ? (
                <Text style={appStyles.bodyText}>No books matched that search.</Text>
              ) : !model.wheelSearchLoading ? (
                <Text style={appStyles.helperText}>Tap a result, then add it to the wheel.</Text>
              ) : null}
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
              <Text style={appStyles.aiStatusEyebrow}>{aiStatus.eyebrow}</Text>
              <Text style={appStyles.aiStatusTitle}>{aiStatus.title}</Text>
              <Text style={appStyles.aiStatusBody}>{aiStatus.body}</Text>
            </View>
          ) : null}
          {(!model.aiPickerLoading && model.aiPickerGenerated) || model.aiPickerRecommendations.length > 0 ? (
            model.aiPickerRecommendations.length > 0 ? (
              <View style={appStyles.candidateStack}>
                {model.aiPickerRecommendations.slice(0, 5).map((book, index) =>
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
