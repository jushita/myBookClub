import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { BookCard } from "./BookCard";
import type { Book } from "../types";

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: overrides.id ?? "book-1",
    title: overrides.title ?? "Gone Girl",
    author: overrides.author ?? "Gillian Flynn",
    genre: overrides.genre ?? "Psychological thriller",
    note: overrides.note ?? "Dark and twisty.",
    description: overrides.description ?? "A sharp psychological thriller about marriage and media.",
    coverImageUrl: overrides.coverImageUrl ?? "https://example.com/gone-girl.jpg",
    synopsis: overrides.synopsis,
    averageRating: overrides.averageRating ?? null,
    ratingsCount: overrides.ratingsCount ?? null,
  };
}

describe("BookCard", () => {
  it("renders core book details and opens details when pressed", () => {
    const onPress = jest.fn();
    const { getByText } = render(<BookCard book={makeBook()} onPress={onPress} />);

    expect(getByText("Gone Girl")).toBeTruthy();
    expect(getByText("Gillian Flynn")).toBeTruthy();
    expect(getByText("Psychological thriller")).toBeTruthy();
    expect(getByText("A sharp psychological thriller about marriage and media.")).toBeTruthy();

    fireEvent.press(getByText("Gone Girl"));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("prefers synopsis over description on the card", () => {
    const { getByText, queryByText } = render(
      <BookCard
        book={makeBook({
          description: "Generic fallback copy.",
          synopsis: "A sharper synopsis that should be shown first.",
        })}
      />
    );

    expect(getByText("A sharper synopsis that should be shown first.")).toBeTruthy();
    expect(queryByText("Generic fallback copy.")).toBeNull();
  });

  it("fires each action button callback independently", () => {
    const onActionPress = jest.fn();
    const onSecondaryActionPress = jest.fn();
    const onTertiaryActionPress = jest.fn();
    const onDismiss = jest.fn();
    const { getByText } = render(
      <BookCard
        book={makeBook()}
        actionLabel="Pick For Club"
        onActionPress={onActionPress}
        secondaryActionLabel="Want to Read"
        onSecondaryActionPress={onSecondaryActionPress}
        tertiaryActionLabel="Skip"
        onTertiaryActionPress={onTertiaryActionPress}
        onDismiss={onDismiss}
      />
    );

    fireEvent.press(getByText("Pick For Club"));
    fireEvent.press(getByText("Want to Read"));
    fireEvent.press(getByText("Skip"));
    fireEvent.press(getByText("×"));

    expect(onActionPress).toHaveBeenCalledTimes(1);
    expect(onSecondaryActionPress).toHaveBeenCalledTimes(1);
    expect(onTertiaryActionPress).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
