import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { BookDetailsModal } from "./BookDetailsModal";
import type { Book } from "../types";

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: overrides.id ?? "book-1",
    title: overrides.title ?? "The Hunger Games",
    author: overrides.author ?? "Suzanne Collins",
    genre: overrides.genre ?? "Dystopian",
    note: overrides.note ?? "",
    description: overrides.description ?? "A televised survival story in a brutal future.",
    coverImageUrl: overrides.coverImageUrl ?? "https://example.com/hunger-games.jpg",
    synopsis: overrides.synopsis ?? "Katniss volunteers to save her sister and enters a lethal televised arena.",
    averageRating: overrides.averageRating ?? 4.34,
    ratingsCount: overrides.ratingsCount ?? 8250000,
  };
}

describe("BookDetailsModal", () => {
  it("renders synopsis and ratings for a visible book", () => {
    const { getByText } = render(<BookDetailsModal visible book={makeBook()} onClose={jest.fn()} />);

    expect(getByText("Book details")).toBeTruthy();
    expect(getByText("The Hunger Games")).toBeTruthy();
    expect(getByText("Suzanne Collins")).toBeTruthy();
    expect(getByText("Dystopian")).toBeTruthy();
    expect(getByText("Synopsis")).toBeTruthy();
    expect(getByText("Katniss volunteers to save her sister and enters a lethal televised arena.")).toBeTruthy();
    expect(getByText("Rating 4.34 · 8,250,000 ratings")).toBeTruthy();
  });

  it("shows a loading state and closes when requested", () => {
    const onClose = jest.fn();
    const { getByText } = render(<BookDetailsModal visible book={null} loading onClose={onClose} />);

    expect(getByText("Loading book details")).toBeTruthy();
    expect(getByText("Fetching synopsis, cover metadata, and ratings.")).toBeTruthy();

    fireEvent.press(getByText("Close"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
