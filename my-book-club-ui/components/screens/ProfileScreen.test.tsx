import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { ProfileScreen } from "./ProfileScreen";
import { makeAuthUser } from "../testUtils";
import type { ProfileScreenActions, ProfileScreenModel } from "../../types/screenModels";

function makeModel(overrides: Partial<ProfileScreenModel> = {}): ProfileScreenModel {
  return {
    authUser: overrides.authUser ?? null,
    selectedClubName: overrides.selectedClubName ?? "Midnight Readers",
    clubsCount: overrides.clubsCount ?? 2,
    favoriteBooksCount: overrides.favoriteBooksCount ?? 8,
    emailAuthMode: overrides.emailAuthMode ?? "signup",
    authLoading: overrides.authLoading ?? false,
    hasGoogleRequest: overrides.hasGoogleRequest ?? true,
    name: overrides.name ?? "Jushita",
    email: overrides.email ?? "jushita@example.com",
    password: overrides.password ?? "secret123",
  };
}

function makeActions(): ProfileScreenActions {
  return {
    onSignOut: jest.fn(),
    onStartGoogleSignIn: jest.fn(),
    onEmailModeChange: jest.fn(),
    onNameChange: jest.fn(),
    onEmailChange: jest.fn(),
    onPasswordChange: jest.fn(),
    onFinishEmailAuth: jest.fn(),
  };
}

describe("ProfileScreen", () => {
  it("renders signed-in profile state and sign out action", () => {
    const actions = makeActions();
    const { getByText } = render(
      <ProfileScreen model={makeModel({ authUser: makeAuthUser({ provider: "google" }) })} actions={actions} />
    );

    expect(getByText("Profile")).toBeTruthy();
    expect(getByText("jushita@example.com")).toBeTruthy();
    expect(getByText("Active club: Midnight Readers")).toBeTruthy();

    fireEvent.press(getByText("Sign out"));

    expect(actions.onSignOut).toHaveBeenCalledTimes(1);
  });

  it("renders guest auth form and dispatches auth actions", () => {
    const actions = makeActions();
    const { getByText, getByPlaceholderText } = render(<ProfileScreen model={makeModel()} actions={actions} />);

    fireEvent.press(getByText("Continue with Google"));
    fireEvent.press(getByText("Log in"));
    fireEvent.changeText(getByPlaceholderText("Email"), "reader@example.com");
    fireEvent.changeText(getByPlaceholderText("Password"), "hunter2");
    fireEvent.press(getByText("Create account"));

    expect(actions.onStartGoogleSignIn).toHaveBeenCalledTimes(1);
    expect(actions.onEmailModeChange).toHaveBeenCalledWith("login");
    expect(actions.onEmailChange).toHaveBeenCalledWith("reader@example.com");
    expect(actions.onPasswordChange).toHaveBeenCalledWith("hunter2");
    expect(actions.onFinishEmailAuth).toHaveBeenCalledTimes(1);
  });
});
