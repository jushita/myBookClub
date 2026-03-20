import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { PickNextScreen } from "./PickNextScreen";
import {
  makeAnimatedRotation,
  makeBook,
  makeClub,
  makeRecommendation,
  makeWheelEngine,
} from "../testUtils";
import type { PickNextScreenActions, PickNextScreenModel } from "../../types/screenModels";

jest.mock("../../hooks/useActionFeedback", () => ({
  useActionFeedback: () => ({
    labels: {},
    runWithFeedback: (_key: string, _label: string, fn: () => Promise<void>) => fn(),
  }),
}));

jest.mock("../../services/api", () => ({
  fetchBookDetails: jest.fn().mockResolvedValue({}),
  mergeDetailedBook: (book: any, details: any) => ({ ...book, ...details }),
}));

jest.mock("../BookCard", () => ({
  BookCard: ({ book, actionLabel, secondaryActionLabel }: any) => {
    const { Text } = require("react-native");
    return (
      <>
        <Text>{`BookCard:${book.title}`}</Text>
        {actionLabel ? <Text>{actionLabel}</Text> : null}
        {secondaryActionLabel ? <Text>{secondaryActionLabel}</Text> : null}
      </>
    );
  },
}));

jest.mock("../BookDetailsModal", () => ({
  BookDetailsModal: () => null,
}));

function makeModel(overrides: Partial<PickNextScreenModel> = {}): PickNextScreenModel {
  return {
    pickMode: overrides.pickMode ?? "ai",
    selectedClub: overrides.selectedClub ?? makeClub(),
    currentClubBook: overrides.currentClubBook ?? "",
    randomizerPool: overrides.randomizerPool ?? [makeBook({ id: "rand-1", title: "Dune" })],
    randomizerResult: overrides.randomizerResult ?? null,
    randomizerRunCount: overrides.randomizerRunCount ?? 0,
    wheelBooks: overrides.wheelBooks ?? [makeBook({ id: "wheel-1", title: "Rebecca" }), makeBook({ id: "wheel-2", title: "Dune" })],
    wheelBookInput: overrides.wheelBookInput ?? "",
    wheelSearchResults: overrides.wheelSearchResults ?? [makeBook({ id: "search-1", title: "The Maid" })],
    wheelSearchLoading: overrides.wheelSearchLoading ?? false,
    selectedWheelBookId: overrides.selectedWheelBookId ?? null,
    wheelSpinning: overrides.wheelSpinning ?? false,
    wheelResult: overrides.wheelResult ?? null,
    wheelWinnerIndex: overrides.wheelWinnerIndex ?? null,
    wheelRotation: overrides.wheelRotation ?? makeAnimatedRotation(),
    wheelSlices: overrides.wheelSlices ?? [],
    defaultWheelSlices: overrides.defaultWheelSlices ?? makeWheelEngine().buildDefaultSlices(),
    maxWheelBooks: overrides.maxWheelBooks ?? 8,
    aiPickerPrompt: overrides.aiPickerPrompt ?? "",
    aiPickerGenerated: overrides.aiPickerGenerated ?? true,
    aiPickerRecommendations: overrides.aiPickerRecommendations ?? [makeRecommendation({ id: "ai-1", title: "Gone Girl" })],
    aiPickerExplanation: overrides.aiPickerExplanation ?? null,
    aiPickerSource: overrides.aiPickerSource ?? null,
    aiPickerLoading: overrides.aiPickerLoading ?? false,
    wheelEngine: overrides.wheelEngine ?? makeWheelEngine(),
    currentPickedBookId: overrides.currentPickedBookId ?? null,
    currentPickedBookKeys: overrides.currentPickedBookKeys ?? [],
  };
}

function makeActions(): PickNextScreenActions {
  return {
    onPickModeChange: jest.fn(),
    onRunRandomizer: jest.fn(),
    onWheelBookInputChange: jest.fn(),
    onSelectWheelBook: jest.fn(),
    onAddWheelBook: jest.fn(),
    onRemoveWheelBook: jest.fn(),
    onSpinWheel: jest.fn(),
    onAiPromptChange: jest.fn(),
    onGenerateAiPick: jest.fn(),
    onAddSuggestedBookToWantToRead: jest.fn().mockResolvedValue(undefined),
    onPickSuggestedBookForClub: jest.fn().mockResolvedValue(undefined),
  };
}

describe("PickNextScreen", () => {
  it("renders AI mode and fires AI generation", () => {
    const actions = makeActions();
    const { getByText, getByPlaceholderText } = render(<PickNextScreen model={makeModel()} actions={actions} />);

    fireEvent.press(getByText("Wheel"));
    fireEvent.press(getByText("Randomize"));
    fireEvent.changeText(getByPlaceholderText("A warm fantasy, a sharp thriller, a short literary read..."), "dark thriller");
    fireEvent.press(getByText("Generate AI pick"));

    expect(getByText("Gone Girl")).toBeTruthy();
    expect(actions.onPickModeChange).toHaveBeenNthCalledWith(1, "wheel");
    expect(actions.onPickModeChange).toHaveBeenNthCalledWith(2, "randomizer");
    expect(actions.onAiPromptChange).toHaveBeenCalledWith("dark thriller");
    expect(actions.onGenerateAiPick).toHaveBeenCalledTimes(1);
  });

  it("renders wheel mode interactions", () => {
    const actions = makeActions();
    const { getByText, getByPlaceholderText } = render(
      <PickNextScreen
        model={makeModel({
          pickMode: "wheel",
          wheelBookInput: "maid",
          selectedWheelBookId: "search-1",
          wheelResult: makeBook({ id: "winner-1", title: "The Maid" }),
        })}
        actions={actions}
      />
    );

    fireEvent.changeText(getByPlaceholderText("Search by title, author, or genre"), "maid");
    fireEvent.press(getByText("The Maid"));
    fireEvent.press(getByText("Add"));
    fireEvent.press(getByText("Rebecca ×"));
    fireEvent.press(getByText("Spin wheel"));

    expect(getByText("BookCard:The Maid")).toBeTruthy();
    expect(actions.onWheelBookInputChange).toHaveBeenCalledWith("maid");
    expect(actions.onSelectWheelBook).toHaveBeenCalledWith("search-1");
    expect(actions.onAddWheelBook).toHaveBeenCalledTimes(1);
    expect(actions.onRemoveWheelBook).toHaveBeenCalledWith("wheel-1");
    expect(actions.onSpinWheel).toHaveBeenCalledTimes(1);
  });

  it("renders randomizer mode and fires randomizer", () => {
    const actions = makeActions();
    const { getByText } = render(
      <PickNextScreen
        model={makeModel({
          pickMode: "randomizer",
          randomizerResult: makeBook({ id: "rand-win", title: "Dune" }),
          randomizerRunCount: 1,
        })}
        actions={actions}
      />
    );

    fireEvent.press(getByText("Run randomizer"));

    expect(getByText("Picked for your club")).toBeTruthy();
    expect(actions.onRunRandomizer).toHaveBeenCalledTimes(1);
  });
});
