import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { SearchScreen } from "./SearchScreen";
import { makeBook } from "../testUtils";
import type { SearchScreenActions, SearchScreenModel } from "../../types/screenModels";

jest.mock("../../hooks/useActionFeedback", () => ({
  useActionFeedback: () => ({
    labels: {},
    runWithFeedback: (_key: string, _label: string, fn: () => Promise<void>) => fn(),
  }),
}));

jest.mock("../BookCard", () => ({
  BookCard: ({ book, actionLabel, secondaryActionLabel, tertiaryActionLabel, onActionPress, onSecondaryActionPress, onTertiaryActionPress }: any) => {
    const { Text } = require("react-native");
    return (
      <>
        <Text>{`BookCard:${book.title}`}</Text>
        {actionLabel ? <Text>{actionLabel}</Text> : null}
        {secondaryActionLabel ? <Text>{secondaryActionLabel}</Text> : null}
        {tertiaryActionLabel ? <Text>{tertiaryActionLabel}</Text> : null}
        {onActionPress ? <Text>{String(Boolean(onActionPress))}</Text> : null}
        {onSecondaryActionPress ? <Text>{String(Boolean(onSecondaryActionPress))}</Text> : null}
        {onTertiaryActionPress ? <Text>{String(Boolean(onTertiaryActionPress))}</Text> : null}
      </>
    );
  },
}));

function makeModel(overrides: Partial<SearchScreenModel> = {}): SearchScreenModel {
  return {
    searchTerm: overrides.searchTerm ?? "gone",
    searchLoading: overrides.searchLoading ?? false,
    filteredSearchBooks: overrides.filteredSearchBooks ?? [makeBook()],
    selectedSearchBook: overrides.selectedSearchBook ?? null,
    savedSearchBookIds: overrides.savedSearchBookIds ?? [],
    savedSearchBookKeys: overrides.savedSearchBookKeys ?? [],
    currentPickedBookId: overrides.currentPickedBookId ?? null,
    currentPickedBookKeys: overrides.currentPickedBookKeys ?? [],
  };
}

function makeActions(): SearchScreenActions {
  return {
    onSearchTermChange: jest.fn(),
    onSelectBook: jest.fn(),
    onCloseBookDetails: jest.fn(),
    onToggleSaveBook: jest.fn(),
    onAddSearchBookToWantToRead: jest.fn().mockResolvedValue(undefined),
    onMarkSearchBookFinished: jest.fn().mockResolvedValue(undefined),
    onPickSearchBookForClub: jest.fn().mockResolvedValue(undefined),
  };
}

describe("SearchScreen", () => {
  it("renders search results and lets the user select a book", () => {
    const actions = makeActions();
    const { getByPlaceholderText, getByText } = render(<SearchScreen model={makeModel()} actions={actions} />);

    fireEvent.changeText(getByPlaceholderText("Search by title, author, or genre"), "thriller");
    fireEvent.press(getByText("Gone Girl"));

    expect(actions.onSearchTermChange).toHaveBeenCalledWith("thriller");
    expect(actions.onSelectBook).toHaveBeenCalledWith("book-1");
  });

  it("shows book details modal actions for a selected book", () => {
    const actions = makeActions();
    const selectedSearchBook = makeBook();
    const { getByText } = render(
      <SearchScreen
        model={makeModel({
          selectedSearchBook,
          savedSearchBookIds: [selectedSearchBook.id],
          currentPickedBookId: selectedSearchBook.id,
        })}
        actions={actions}
      />
    );

    expect(getByText("Book details")).toBeTruthy();
    expect(getByText("BookCard:Gone Girl")).toBeTruthy();
    expect(getByText("Want to Read")).toBeTruthy();
    expect(getByText("Finished")).toBeTruthy();
    expect(getByText("Picked")).toBeTruthy();

    fireEvent.press(getByText("Close"));

    expect(actions.onCloseBookDetails).toHaveBeenCalledTimes(1);
  });
});
