import React from "react";
import { Animated, Pressable, Text, TextInput, View } from "react-native";
import Svg, { Circle, G, Line, Path, Text as SvgText } from "react-native-svg";
import type { Book, Club, Recommendation } from "../../types";
import { WheelEngine, type DefaultWheelSlice, type WheelSlice } from "../../domain/WheelEngine";
import { appStyles } from "../../styles/appStyles";
import { Card } from "../common/Card";

type PickMode = "randomizer" | "wheel" | "ai";

type PickNextScreenProps = {
  pickMode: PickMode;
  selectedClub?: Club;
  currentClubBook: string;
  randomizerPool: Book[];
  randomizerResult: Book | null;
  randomizerRunCount: number;
  wheelBooks: string[];
  wheelBookInput: string;
  wheelSpinning: boolean;
  wheelResult: string | null;
  wheelWinnerIndex: number | null;
  wheelRotation: Animated.AnimatedInterpolation<string>;
  wheelSlices: WheelSlice[];
  defaultWheelSlices: DefaultWheelSlice[];
  maxWheelBooks: number;
  aiPickerPrompt: string;
  aiPickerGenerated: boolean;
  aiPickerRecommendations: Recommendation[];
  onPickModeChange: (mode: PickMode) => void;
  onRunRandomizer: () => void;
  onWheelBookInputChange: (value: string) => void;
  onAddWheelBook: () => void;
  onRemoveWheelBook: (book: string) => void;
  onSpinWheel: () => void;
  onAiPromptChange: (value: string) => void;
  onGenerateAiPick: () => void;
  wheelEngine: WheelEngine;
};

export function PickNextScreen({
  pickMode,
  selectedClub,
  currentClubBook,
  randomizerPool,
  randomizerResult,
  randomizerRunCount,
  wheelBooks,
  wheelBookInput,
  wheelSpinning,
  wheelResult,
  wheelWinnerIndex,
  wheelRotation,
  wheelSlices,
  defaultWheelSlices,
  maxWheelBooks,
  aiPickerPrompt,
  aiPickerGenerated,
  aiPickerRecommendations,
  onPickModeChange,
  onRunRandomizer,
  onWheelBookInputChange,
  onAddWheelBook,
  onRemoveWheelBook,
  onSpinWheel,
  onAiPromptChange,
  onGenerateAiPick,
  wheelEngine,
}: PickNextScreenProps) {
  return (
    <View style={appStyles.stack}>
      <Card>
        <Text style={appStyles.sectionTitle}>Choose your method</Text>
        <View style={appStyles.pickModeRow}>
          {[
            { mode: "randomizer" as const, title: "Randomize", meta: "Group shelf" },
            { mode: "wheel" as const, title: "Wheel", meta: "Spin to pick" },
            { mode: "ai" as const, title: "AI Pick", meta: "Taste-led" },
          ].map((option) => (
            <Pressable
              key={option.mode}
              style={[appStyles.pickModeButton, pickMode === option.mode ? appStyles.pickModeButtonActive : null]}
              onPress={() => onPickModeChange(option.mode)}
            >
              <Text style={[appStyles.pickModeTitle, pickMode === option.mode ? appStyles.pickModeTitleActive : null]}>
                {option.title}
              </Text>
              <Text style={[appStyles.pickModeMeta, pickMode === option.mode ? appStyles.pickModeMetaActive : null]}>
                {option.meta}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {pickMode === "randomizer" ? (
        <Card accent>
          <Text style={appStyles.sectionTitle}>Randomizer</Text>
          <Text style={appStyles.bodyText}>
            Shuffle from the books saved by {selectedClub?.name || "your club"} and let luck pick the next read.
          </Text>
          <View style={appStyles.candidateStack}>
            {randomizerPool.slice(0, 3).map((book) => (
              <View key={book.id} style={appStyles.candidateRow}>
                <Text style={appStyles.candidateTitle}>{book.title}</Text>
                <Text style={appStyles.candidateMeta}>{book.author}</Text>
              </View>
            ))}
          </View>
          <Pressable style={[appStyles.neuButton, appStyles.primaryButton]} onPress={onRunRandomizer}>
            <Text style={appStyles.primaryButtonText}>Run randomizer</Text>
          </Pressable>
          {randomizerResult ? (
            <View key={`${randomizerResult.id}-${randomizerRunCount}`} style={appStyles.randomizerWinnerCard}>
              <Text style={appStyles.randomizerWinnerLabel}>Picked for your club</Text>
              <Text style={appStyles.randomizerWinnerTitle}>{randomizerResult.title}</Text>
              <Text style={appStyles.randomizerWinnerMeta}>{randomizerResult.author}</Text>
              <Text style={appStyles.randomizerWinnerBody}>
                The randomizer landed here from the current club shelf.
              </Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      {pickMode === "wheel" ? (
        <Card accent>
          <Text style={appStyles.sectionTitle}>Wheel of fortune</Text>
          <Text style={appStyles.bodyText}>
            Add up to {maxWheelBooks} books, then spin the wheel to pick the club's next read.
          </Text>
          <View style={appStyles.wheelInputRow}>
            <TextInput
              value={wheelBookInput}
              onChangeText={onWheelBookInputChange}
              placeholder="Add a book to the wheel"
              placeholderTextColor="rgba(255, 232, 244, 0.52)"
              style={[appStyles.field, appStyles.wheelField]}
              editable={!wheelSpinning}
            />
            <Pressable
              style={[appStyles.neuButton, appStyles.wheelAddButton, wheelSpinning ? appStyles.buttonDisabled : null]}
              onPress={onAddWheelBook}
              disabled={wheelSpinning}
            >
              <Text style={appStyles.primaryButtonText}>Add</Text>
            </Pressable>
          </View>
          <Text style={appStyles.helperText}>{wheelBooks.length} of {maxWheelBooks} books added</Text>
          <View style={appStyles.wheelShell}>
            <View style={appStyles.wheelPointer} />
            <Animated.View style={[appStyles.wheelPlaceholder, { transform: [{ rotate: wheelRotation }] }]}>
              <Svg width={WheelEngine.SIZE} height={WheelEngine.SIZE} viewBox={`0 0 ${WheelEngine.SIZE} ${WheelEngine.SIZE}`}>
                {wheelSlices.length > 0 ? (
                  <>
                    {wheelSlices.map((slice) => (
                      <Path
                        key={slice.book}
                        d={slice.path}
                        fill={wheelWinnerIndex === slice.index ? "rgba(255, 244, 181, 0.96)" : slice.fill}
                        stroke="rgba(255,255,255,0.55)"
                        strokeWidth={1.5}
                      />
                    ))}
                    {wheelSlices.map((slice, index) => {
                      const boundaryPoint = wheelEngine.getBoundaryPoint(index, wheelSlices.length);

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
                    {wheelSlices.map((slice) => (
                      <G key={`${slice.book}-label`}>
                        {slice.labelLines.map((line, lineIndex) => (
                          <SvgText
                            key={`${slice.book}-${lineIndex}`}
                            x={slice.label.x}
                            y={slice.label.y + lineIndex * 12 - (slice.labelLines.length - 1) * 6}
                            fill={wheelWinnerIndex === slice.index ? "#6D4199" : "#FFF8FD"}
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
                    {defaultWheelSlices.map((slice, index) => (
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
              {wheelBooks.length > 0 ? <View style={appStyles.wheelHubOverlay} pointerEvents="none" /> : null}
            </Animated.View>
          </View>
          <View style={appStyles.memberRow}>
            {wheelBooks.map((book) => (
              <Pressable key={book} style={appStyles.memberChip} onPress={() => onRemoveWheelBook(book)} disabled={wheelSpinning}>
                <Text style={appStyles.memberName}>{book} ×</Text>
              </Pressable>
            ))}
          </View>
          {wheelBooks.length >= 3 ? (
            <Pressable
              style={[appStyles.neuButton, appStyles.primaryButton, wheelSpinning ? appStyles.buttonDisabled : null]}
              onPress={onSpinWheel}
              disabled={wheelSpinning}
            >
              <Text style={appStyles.primaryButtonText}>{wheelSpinning ? "Spinning..." : "Spin wheel"}</Text>
            </Pressable>
          ) : null}
          {wheelResult ? (
            <View style={appStyles.candidateRow}>
              <Text style={appStyles.candidateTitle}>{wheelResult}</Text>
              <Text style={appStyles.candidateMeta}>The wheel picked this as the next club read.</Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      {pickMode === "ai" ? (
        <Card accent>
          <Text style={appStyles.sectionTitle}>AI recommendation</Text>
          <Text style={appStyles.bodyText}>
            Tell the AI what kind of book you want, or leave it blank and it will choose from the club's taste.
          </Text>
          <TextInput
            multiline
            value={aiPickerPrompt}
            onChangeText={onAiPromptChange}
            placeholder="A warm fantasy, a sharp thriller, a short literary read..."
            placeholderTextColor="rgba(255, 232, 244, 0.52)"
            style={appStyles.input}
          />
          <Pressable style={[appStyles.neuButton, appStyles.primaryButton]} onPress={onGenerateAiPick}>
            <Text style={appStyles.primaryButtonText}>Generate AI pick</Text>
          </Pressable>
          {aiPickerGenerated ? (
            <View style={appStyles.candidateStack}>
              <View style={appStyles.candidateRow}>
                <Text style={appStyles.candidateTitle}>{aiPickerRecommendations[0]?.title || currentClubBook}</Text>
                <Text style={appStyles.candidateMeta}>
                  {aiPickerPrompt.trim()
                    ? `Picked for: ${aiPickerPrompt.trim()}`
                    : `Picked from ${selectedClub?.name || "your club"} preferences.`}
                </Text>
              </View>
              {aiPickerRecommendations.slice(0, 2).map((book) => (
                <View key={book.id} style={appStyles.candidateRow}>
                  <Text style={appStyles.candidateTitle}>{book.title}</Text>
                  <Text style={appStyles.candidateMeta}>{book.matchReason}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}
    </View>
  );
}
