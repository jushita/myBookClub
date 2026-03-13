import React from "react";
import { Animated, Pressable, Text, TextInput, View } from "react-native";
import Svg, { Circle, G, Line, Path, Text as SvgText } from "react-native-svg";
import { WheelEngine } from "../../domain/WheelEngine";
import { appStyles } from "../../styles/appStyles";
import type { PickNextScreenActions, PickNextScreenModel } from "../../types/screenModels";
import { Card } from "../common/Card";

type PickNextScreenProps = {
  model: PickNextScreenModel;
  actions: PickNextScreenActions;
};

export function PickNextScreen({ model, actions }: PickNextScreenProps) {
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
              style={[appStyles.pickModeButton, model.pickMode === option.mode ? appStyles.pickModeButtonActive : null]}
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
          <Pressable style={[appStyles.neuButton, appStyles.primaryButton]} onPress={actions.onRunRandomizer}>
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
              placeholder="Add a book to the wheel"
              placeholderTextColor="rgba(255, 232, 244, 0.52)"
              style={[appStyles.field, appStyles.wheelField]}
              editable={!model.wheelSpinning}
            />
            <Pressable
              style={[appStyles.neuButton, appStyles.wheelAddButton, model.wheelSpinning ? appStyles.buttonDisabled : null]}
              onPress={actions.onAddWheelBook}
              disabled={model.wheelSpinning}
            >
              <Text style={appStyles.primaryButtonText}>Add</Text>
            </Pressable>
          </View>
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
              <Pressable key={book} style={appStyles.memberChip} onPress={() => actions.onRemoveWheelBook(book)} disabled={model.wheelSpinning}>
                <Text style={appStyles.memberName}>{book} ×</Text>
              </Pressable>
            ))}
          </View>
          {model.wheelBooks.length >= 2 ? (
            <Pressable
              style={[appStyles.neuButton, appStyles.primaryButton, model.wheelSpinning ? appStyles.buttonDisabled : null]}
              onPress={actions.onSpinWheel}
              disabled={model.wheelSpinning}
            >
              <Text style={appStyles.primaryButtonText}>{model.wheelSpinning ? "Spinning..." : "Spin wheel"}</Text>
            </Pressable>
          ) : null}
          {model.wheelResult ? (
            <View style={appStyles.candidateRow}>
              <Text style={appStyles.candidateTitle}>{model.wheelResult}</Text>
              <Text style={appStyles.candidateMeta}>The wheel picked this as the next club read.</Text>
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
          <Pressable style={[appStyles.neuButton, appStyles.primaryButton]} onPress={actions.onGenerateAiPick}>
            <Text style={appStyles.primaryButtonText}>Generate AI pick</Text>
          </Pressable>
          {model.aiPickerGenerated ? (
            <View style={appStyles.candidateStack}>
              <View style={appStyles.candidateRow}>
                <Text style={appStyles.candidateTitle}>{model.aiPickerRecommendations[0]?.title || model.currentClubBook}</Text>
                <Text style={appStyles.candidateMeta}>
                  {model.aiPickerPrompt.trim()
                    ? `Picked for: ${model.aiPickerPrompt.trim()}`
                    : `Picked from ${model.selectedClub?.name || "your club"} preferences.`}
                </Text>
              </View>
              {model.aiPickerRecommendations.slice(0, 2).map((book) => (
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
