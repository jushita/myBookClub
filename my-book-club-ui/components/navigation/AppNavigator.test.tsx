import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { AppNavigator } from "./AppNavigator";
import type { AppScreenViews } from "../../types/screenModels";

jest.mock("../screens/HomeScreen", () => {
  const { Text } = require("react-native");
  return { HomeScreen: () => <Text>Home Screen</Text> };
});
jest.mock("../screens/ClubsScreen", () => {
  const { Text } = require("react-native");
  return { ClubsScreen: () => <Text>Clubs Screen</Text> };
});
jest.mock("../screens/SearchScreen", () => {
  const { Text } = require("react-native");
  return { SearchScreen: () => <Text>Search Screen</Text> };
});
jest.mock("../screens/PickNextScreen", () => {
  const { Text } = require("react-native");
  return { PickNextScreen: () => <Text>Pick Next Screen</Text> };
});
jest.mock("../screens/LibraryScreen", () => {
  const { Text } = require("react-native");
  return { LibraryScreen: () => <Text>Library Screen</Text> };
});
jest.mock("../screens/ProfileScreen", () => {
  const { Text } = require("react-native");
  return { ProfileScreen: () => <Text>Profile Screen</Text> };
});

const views = {} as AppScreenViews;

describe("AppNavigator", () => {
  it("renders the active screen and switches tabs", () => {
    const onScreenChange = jest.fn();
    const { getByText, queryByText } = render(<AppNavigator screen="search" onScreenChange={onScreenChange} views={views} />);

    expect(getByText("Search Screen")).toBeTruthy();
    expect(queryByText("Home Screen")).toBeNull();

    fireEvent.press(getByText("Home"));
    fireEvent.press(getByText("Clubs"));
    fireEvent.press(getByText("Picker"));
    fireEvent.press(getByText("Library"));

    expect(onScreenChange).toHaveBeenNthCalledWith(1, "home");
    expect(onScreenChange).toHaveBeenNthCalledWith(2, "clubs");
    expect(onScreenChange).toHaveBeenNthCalledWith(3, "pick-next");
    expect(onScreenChange).toHaveBeenNthCalledWith(4, "library");
  });
});
