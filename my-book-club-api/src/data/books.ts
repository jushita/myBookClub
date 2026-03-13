import { Book } from "../domain/entities/index.js";

export const books: Book[] = [
  new Book({
    id: "b1",
    title: "Gone Girl",
    author: "Gillian Flynn",
    genre: "Thriller",
    description: "A sharp psychological thriller with unreliable narration.",
  }),
  new Book({
    id: "b2",
    title: "Rebecca",
    author: "Daphne du Maurier",
    genre: "Classic",
    description: "A gothic suspense novel with atmosphere and obsession.",
  }),
  new Book({
    id: "b3",
    title: "The Maid",
    author: "Nita Prose",
    genre: "Mystery",
    description: "A contemporary mystery with a cozy tone and brisk pacing.",
  }),
];
