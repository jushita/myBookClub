import React from "react";
import { Text } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import { Card } from "./Card";
import { GuestAccessCard } from "./GuestAccessCard";
import { NavButton } from "./NavButton";
import { Stat } from "./Stat";
import { AppHeader } from "../layout/AppHeader";

describe("common UI components", () => {
  it("renders a card and its children", () => {
    const { getByText } = render(
      <Card>
        <Text>Inside card</Text>
      </Card>
    );

    expect(getByText("Inside card")).toBeTruthy();
  });

  it("renders guest access CTA actions", () => {
    const onSignIn = jest.fn();
    const onSignUp = jest.fn();
    const { getByText } = render(
      <GuestAccessCard
        title="Join the club"
        description="Save books and join clubs."
        onSignIn={onSignIn}
        onSignUp={onSignUp}
      />
    );

    fireEvent.press(getByText("Sign in"));
    fireEvent.press(getByText("Sign up"));

    expect(getByText("Join the club")).toBeTruthy();
    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(onSignUp).toHaveBeenCalledTimes(1);
  });

  it("renders nav button and fires on press", () => {
    const onPress = jest.fn();
    const { getByText } = render(<NavButton icon="⌂" label="Home" active onPress={onPress} />);

    fireEvent.press(getByText("Home"));

    expect(getByText("⌂")).toBeTruthy();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("renders a stat label and value", () => {
    const { getByText } = render(<Stat label="Shelf" value="12" />);

    expect(getByText("Shelf")).toBeTruthy();
    expect(getByText("12")).toBeTruthy();
  });

  it("renders header title/subtitle only when provided", () => {
    const { getByText, queryByText, rerender } = render(
      <AppHeader kicker="Today" title="My Book Club" subtitle="Mood-driven picks" />
    );

    expect(getByText("Today")).toBeTruthy();
    expect(getByText("My Book Club")).toBeTruthy();
    expect(getByText("Mood-driven picks")).toBeTruthy();

    rerender(<AppHeader kicker="Today" title={null} subtitle={null} />);

    expect(queryByText("My Book Club")).toBeNull();
    expect(queryByText("Mood-driven picks")).toBeNull();
  });
});
