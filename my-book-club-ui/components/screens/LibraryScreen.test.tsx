import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { LibraryScreen } from "./LibraryScreen";
import { makeAuthUser, makeBook, makeLibraryEntry } from "../testUtils";
import type { LibraryScreenActions, LibraryScreenModel } from "../../types/screenModels";

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
  BookCard: ({ book, actionLabel, secondaryActionLabel, onActionPress, onSecondaryActionPress, onDismiss }: any) => {
    const { Text } = require("react-native");
    return (
      <>
        <Text>{`BookCard:${book.title}`}</Text>
        {actionLabel ? <Text>{actionLabel}</Text> : null}
        {secondaryActionLabel ? <Text>{secondaryActionLabel}</Text> : null}
        {onActionPress ? <Text>{String(Boolean(onActionPress))}</Text> : null}
        {onSecondaryActionPress ? <Text>{String(Boolean(onSecondaryActionPress))}</Text> : null}
        {onDismiss ? <Text>{String(Boolean(onDismiss))}</Text> : null}
      </>
    );
  },
}));

jest.mock("../BookDetailsModal", () => ({
  BookDetailsModal: () => null,
}));

function makeModel(overrides: Partial<LibraryScreenModel> = {}): LibraryScreenModel {
  const savedBook = makeBook();
  return {
    authUser: Object.prototype.hasOwnProperty.call(overrides, "authUser") ? (overrides.authUser ?? null) : makeAuthUser(),
    booksLoading: overrides.booksLoading ?? false,
    booksError: overrides.booksError ?? null,
    currentReadingEntry: Object.prototype.hasOwnProperty.call(overrides, "currentReadingEntry")
      ? (overrides.currentReadingEntry ?? null)
      : makeLibraryEntry({ book: makeBook({ id: "current-1", title: "Rebecca" }), status: "current", isCurrentRead: true }),
    favoriteEntries: overrides.favoriteEntries ?? [makeLibraryEntry({ book: savedBook, userId: "user-1" })],
    finishedEntries: overrides.finishedEntries ?? [makeLibraryEntry({ id: "finished-1", book: makeBook({ id: "finished-book", title: "The Great Gatsby" }), status: "finished" })],
    clubFinishedEntries: overrides.clubFinishedEntries ?? [makeLibraryEntry({ id: "club-finished-1", book: makeBook({ id: "club-finished-book", title: "Dune" }), status: "finished" })],
    favoriteBooks: overrides.favoriteBooks ?? [],
    finishedBooks: overrides.finishedBooks ?? [],
    clubFinishedBooks: overrides.clubFinishedBooks ?? [],
    guestLibraryBooks: overrides.guestLibraryBooks ?? [makeBook({ id: "guest-1", title: "The Hobbit" })],
    currentPickedBookId: overrides.currentPickedBookId ?? null,
  };
}

function makeActions(): LibraryScreenActions {
  return {
    onSignIn: jest.fn(),
    onSignUp: jest.fn(),
    onRemoveBook: jest.fn().mockResolvedValue(undefined),
    onMarkAsRead: jest.fn().mockResolvedValue(undefined),
    onMarkAsSaved: jest.fn().mockResolvedValue(undefined),
    onPickForClub: jest.fn().mockResolvedValue(undefined),
  };
}

describe("LibraryScreen", () => {
  it("renders authenticated library tabs and current reading section", () => {
    const actions = makeActions();
    const { getByText } = render(<LibraryScreen model={makeModel()} actions={actions} />);

    expect(getByText("Your club library")).toBeTruthy();
    expect(getByText("Currently reading")).toBeTruthy();
    expect(getByText("BookCard:Rebecca")).toBeTruthy();
    expect(getByText("BookCard:Gone Girl")).toBeTruthy();

    fireEvent.press(getByText("Finished"));
    expect(getByText("BookCard:The Great Gatsby")).toBeTruthy();

    fireEvent.press(getByText("Finished in Club"));
    expect(getByText("BookCard:Dune")).toBeTruthy();
  });

  it("renders guest library state", () => {
    const actions = makeActions();
    const { getByText } = render(
      <LibraryScreen model={makeModel({ authUser: null, currentReadingEntry: null, favoriteEntries: [], finishedEntries: [], clubFinishedEntries: [] })} actions={actions} />
    );

    expect(getByText("Browse top picks")).toBeTruthy();
    expect(getByText("Top charted reads")).toBeTruthy();
    expect(getByText("BookCard:The Hobbit")).toBeTruthy();
  });
});
