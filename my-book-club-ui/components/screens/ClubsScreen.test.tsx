import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { ClubsScreen } from "./ClubsScreen";
import { makeAuthUser, makeBook, makeClub, makeClubInsight, makeClubMember } from "../testUtils";
import type { ClubsScreenActions, ClubsScreenModel } from "../../types/screenModels";

function makeModel(overrides: Partial<ClubsScreenModel> = {}): ClubsScreenModel {
  return {
    authUser: Object.prototype.hasOwnProperty.call(overrides, "authUser") ? (overrides.authUser ?? null) : makeAuthUser(),
    clubs: overrides.clubs ?? [makeClub(), makeClub({ id: "club-2", name: "Cozy Readers", vibe: "Warm fiction" })],
    selectedClub: overrides.selectedClub ?? makeClub(),
    selectedClubMembers: overrides.selectedClubMembers ?? [makeClubMember()],
    currentClubBook: overrides.currentClubBook ?? "",
    currentClubBookDetails: Object.prototype.hasOwnProperty.call(overrides, "currentClubBookDetails")
      ? (overrides.currentClubBookDetails ?? null)
      : makeBook({ id: "current-1", title: "Rebecca" }),
    clubManagementMode: overrides.clubManagementMode ?? "overview",
    clubSelectorOpen: overrides.clubSelectorOpen ?? false,
    clubSearchTerm: overrides.clubSearchTerm ?? "",
    joinableClubs: overrides.joinableClubs ?? [makeClub({ id: "join-1", name: "Mystery Club" })],
    selectedJoinClub: overrides.selectedJoinClub,
    selectedJoinClubMembers: overrides.selectedJoinClubMembers ?? [makeClubMember({ id: "member-2", name: "Miles" })],
    createClubName: overrides.createClubName ?? "",
    createClubDescription: overrides.createClubDescription ?? "",
    createClubVibe: overrides.createClubVibe ?? "",
    clubActionLoading: overrides.clubActionLoading ?? false,
    clubActionError: overrides.clubActionError ?? null,
    favoriteBooksCount: overrides.favoriteBooksCount ?? 7,
    finishedBooksCount: overrides.finishedBooksCount ?? 2,
    finishedBooks: overrides.finishedBooks ?? [makeBook({ id: "finished-1", title: "Dune" })],
    booksLoading: overrides.booksLoading ?? false,
    booksError: overrides.booksError ?? null,
    showSwitchClub: overrides.showSwitchClub ?? true,
    discussionQuestions: overrides.discussionQuestions ?? ["What felt most unsettling?"],
    discussionQuestionsLoading: overrides.discussionQuestionsLoading ?? false,
    clubInsight: overrides.clubInsight ?? makeClubInsight(),
    clubInsightLoading: overrides.clubInsightLoading ?? false,
  };
}

function makeActions(): ClubsScreenActions {
  return {
    onOpenCreateClub: jest.fn(),
    onOpenJoinClub: jest.fn(),
    onOpenSwitchClub: jest.fn(),
    onCloseClubManagement: jest.fn(),
    onToggleClubSelector: jest.fn(),
    onSelectClub: jest.fn(),
    onMarkCurrentBookFinished: jest.fn(),
    onGenerateQuestions: jest.fn(),
    onOpenPickNext: jest.fn(),
    onAddSampleBook: jest.fn(),
    onClubSearchTermChange: jest.fn(),
    onSelectJoinClub: jest.fn(),
    onCreateClubNameChange: jest.fn(),
    onCreateClubDescriptionChange: jest.fn(),
    onCreateClubVibeChange: jest.fn(),
    onCreateClub: jest.fn(),
    onJoinSelectedClub: jest.fn(),
    onSignIn: jest.fn(),
    onSignUp: jest.fn(),
  };
}

describe("ClubsScreen", () => {
  it("renders guest CTA when not authenticated", () => {
    const { getByText } = render(<ClubsScreen model={makeModel({ authUser: null })} actions={makeActions()} />);

    expect(getByText("Sign in to join a club or create a club")).toBeTruthy();
  });

  it("renders overview mode and dispatches key actions", () => {
    const actions = makeActions();
    const { getByText } = render(<ClubsScreen model={makeModel()} actions={actions} />);

    expect(getByText("Active club")).toBeTruthy();
    expect(getByText("Currently reading")).toBeTruthy();
    expect(getByText("Club insights")).toBeTruthy();
    expect(getByText("Saved books")).toBeTruthy();

    fireEvent.press(getByText("Mark as finished"));
    fireEvent.press(getByText("Generate Questions"));
    fireEvent.press(getByText("Pick your next book"));
    fireEvent.press(getByText("Create a club"));
    fireEvent.press(getByText("Join a club"));
    fireEvent.press(getByText("Switch club"));

    expect(actions.onMarkCurrentBookFinished).toHaveBeenCalledTimes(1);
    expect(actions.onGenerateQuestions).toHaveBeenCalledTimes(1);
    expect(actions.onOpenPickNext).toHaveBeenCalledTimes(1);
    expect(actions.onOpenCreateClub).toHaveBeenCalledTimes(1);
    expect(actions.onOpenJoinClub).toHaveBeenCalledTimes(1);
    expect(actions.onOpenSwitchClub).toHaveBeenCalledTimes(1);
  });

  it("renders create and join club forms", () => {
    const createActions = makeActions();
    const { getByText, getByPlaceholderText, rerender } = render(
      <ClubsScreen model={makeModel({ clubManagementMode: "create" })} actions={createActions} />
    );

    fireEvent.changeText(getByPlaceholderText("Club name"), "Weekend Readers");
    fireEvent.changeText(getByPlaceholderText("What is this club about?"), "Cozy mysteries");
    fireEvent.changeText(getByPlaceholderText("Club vibe"), "Cozy");
    fireEvent.press(getByText("Create club"));
    fireEvent.press(getByText("Back"));

    expect(createActions.onCreateClubNameChange).toHaveBeenCalledWith("Weekend Readers");
    expect(createActions.onCreateClubDescriptionChange).toHaveBeenCalledWith("Cozy mysteries");
    expect(createActions.onCreateClubVibeChange).toHaveBeenCalledWith("Cozy");
    expect(createActions.onCreateClub).toHaveBeenCalledTimes(1);
    expect(createActions.onCloseClubManagement).toHaveBeenCalledTimes(1);

    const joinActions = makeActions();
    rerender(
      <ClubsScreen
        model={makeModel({ clubManagementMode: "join", selectedJoinClub: makeClub({ id: "join-1", name: "Mystery Club" }) })}
        actions={joinActions}
      />
    );

    fireEvent.changeText(getByPlaceholderText("Search club name"), "Mystery");
    fireEvent.press(getByText("Mystery Club"));
    fireEvent.press(getByText("Join selected club"));

    expect(joinActions.onClubSearchTermChange).toHaveBeenCalledWith("Mystery");
    expect(joinActions.onSelectJoinClub).toHaveBeenCalledWith("join-1");
    expect(joinActions.onJoinSelectedClub).toHaveBeenCalledTimes(1);
  });
});
