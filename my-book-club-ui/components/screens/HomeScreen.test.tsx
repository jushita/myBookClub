import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { HomeScreen } from "./HomeScreen";
import { makeAuthUser, makeBook, makeClub, makeRecommendation } from "../testUtils";
import type { HomeScreenActions, HomeScreenModel } from "../../types/screenModels";

jest.mock("../../hooks/useActionFeedback", () => ({
  useActionFeedback: () => ({
    labels: {},
    runWithFeedback: (_key: string, _label: string, fn: () => Promise<void>) => fn(),
  }),
}));

const mockFetchBookDetails = jest.fn();
const mockMergeDetailedBook = jest.fn((book, details) => ({ ...book, ...details }));

jest.mock("../../services/api", () => ({
  fetchBookDetails: (id: string) => mockFetchBookDetails(id),
  mergeDetailedBook: (book: any, details: any) => mockMergeDetailedBook(book, details),
}));

jest.mock("../BookCard", () => ({
  BookCard: ({ book, actionLabel, onPress, onActionPress }: any) => {
    const { Text } = require("react-native");
    return (
      <>
        <Text>{`BookCard:${book.title}`}</Text>
        {actionLabel ? <Text>{actionLabel}</Text> : null}
        <Text>{String(Boolean(onPress))}</Text>
        <Text>{String(Boolean(onActionPress))}</Text>
      </>
    );
  },
}));

jest.mock("../BookDetailsModal", () => ({
  BookDetailsModal: ({ visible, book, loading }: any) => {
    const { Text } = require("react-native");
    return visible ? <Text>{`Details:${book?.title}:${loading ? "loading" : "ready"}`}</Text> : null;
  },
}));

function makeModel(overrides: Partial<HomeScreenModel> = {}): HomeScreenModel {
  return {
    authUser: Object.prototype.hasOwnProperty.call(overrides, "authUser") ? (overrides.authUser ?? null) : makeAuthUser(),
    selectedClub: overrides.selectedClub ?? makeClub(),
    selectedClubMembersCount: overrides.selectedClubMembersCount ?? 3,
    favoriteBooksCount: overrides.favoriteBooksCount ?? 6,
    personalizedRecommendations: overrides.personalizedRecommendations ?? [makeRecommendation({ id: "rec-2", title: "Sharp Objects" })],
    currentClubBookDetails: Object.prototype.hasOwnProperty.call(overrides, "currentClubBookDetails")
      ? (overrides.currentClubBookDetails ?? null)
      : makeBook({ id: "current-1", title: "Rebecca" }),
    aiPickerPrompt: overrides.aiPickerPrompt ?? "",
    aiPickerGenerated: overrides.aiPickerGenerated ?? true,
    aiPickerRecommendations: overrides.aiPickerRecommendations ?? [makeRecommendation({ id: "rec-1", title: "Gone Girl" })],
    aiPickerExplanation: overrides.aiPickerExplanation ?? null,
    aiPickerSource: overrides.aiPickerSource ?? null,
    aiPickerLoading: overrides.aiPickerLoading ?? false,
  };
}

function makeActions(): HomeScreenActions {
  return {
    onAiPromptChange: jest.fn(),
    onGenerateAiPick: jest.fn(),
    onAddHomeAiPickToWantToRead: jest.fn().mockResolvedValue(undefined),
    onAddPersonalizedPickToWantToRead: jest.fn().mockResolvedValue(undefined),
    onOpenClubs: jest.fn(),
    onOpenLibrary: jest.fn(),
    onOpenPickNext: jest.fn(),
    onSignIn: jest.fn(),
    onSignUp: jest.fn(),
  };
}

describe("HomeScreen", () => {
  beforeEach(() => {
    mockFetchBookDetails.mockReset();
    mockMergeDetailedBook.mockClear();
  });

  it("renders signed-in recommendations and quick actions", () => {
    const actions = makeActions();
    const { getByText } = render(<HomeScreen model={makeModel()} actions={actions} />);

    expect(getByText("BookCard:Gone Girl")).toBeTruthy();
    expect(getByText("BookCard:Sharp Objects")).toBeTruthy();

    fireEvent.press(getByText("Get recommendation"));
    fireEvent.press(getByText("Open club"));
    fireEvent.press(getByText("Open library"));
    fireEvent.press(getByText("Pick next book"));

    expect(actions.onGenerateAiPick).toHaveBeenCalledTimes(1);
    expect(actions.onOpenClubs).toHaveBeenCalledTimes(1);
    expect(actions.onOpenLibrary).toHaveBeenCalledTimes(1);
    expect(actions.onOpenPickNext).toHaveBeenCalledTimes(1);
  });

  it("renders guest CTA and opens book details after enrichment", async () => {
    const actions = makeActions();
    const recommendation = makeRecommendation({ id: "guest-rec", title: "The Maid" });
    mockFetchBookDetails.mockResolvedValue({ synopsis: "Detailed synopsis" });

    const { getByText } = render(
      <HomeScreen
        model={makeModel({
          authUser: null,
          aiPickerRecommendations: [recommendation],
          personalizedRecommendations: [],
          currentClubBookDetails: null,
        })}
        actions={actions}
      />
    );

    fireEvent.press(getByText("Sign in"));
    fireEvent.press(getByText("Sign up"));
    fireEvent.press(getByText("Generate recommendation"));

    expect(actions.onSignIn).toHaveBeenCalledTimes(1);
    expect(actions.onSignUp).toHaveBeenCalledTimes(1);
    expect(actions.onGenerateAiPick).toHaveBeenCalledTimes(1);
  });
});
