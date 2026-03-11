import type { Book, ClubMember, Recommendation } from "../types";

export const MOCK_USERS: ClubMember[] = [
  { id: "1", name: "Maya" },
  { id: "2", name: "Jordan" },
  { id: "3", name: "Priya" },
  { id: "4", name: "Eli" },
];

export const MOCK_BOOKS: Book[] = [
  {
    id: "b1",
    title: "Gone Girl",
    author: "Gillian Flynn",
    genre: "Thriller",
    note: "Sharp pacing and conversation-starting twists.",
  },
  {
    id: "b2",
    title: "The Very Secret Society of Irregular Witches",
    author: "Sangu Mandanna",
    genre: "Fantasy",
    note: "Heart-forward comfort read with found-family energy.",
  },
  {
    id: "b3",
    title: "Remarkably Bright Creatures",
    author: "Shelby Van Pelt",
    genre: "Literary",
    note: "Warm, accessible, and easy to discuss as a group.",
  },
];

export const MOCK_RECOMMENDATIONS: Recommendation[] = [
  {
    id: "r1",
    title: "The Maid",
    author: "Nita Prose",
    genre: "Mystery",
    note: "",
    matchReason:
      "Balances a cozy setting with enough intrigue to keep a mixed-taste group engaged.",
  },
  {
    id: "r2",
    title: "Everyone in My Family Has Killed Someone",
    author: "Benjamin Stevenson",
    genre: "Mystery",
    note: "",
    matchReason:
      "A playful voice and clever structure give the club plenty to unpack without getting too dark.",
  },
  {
    id: "r3",
    title: "Rebecca",
    author: "Daphne du Maurier",
    genre: "Classic",
    note: "",
    matchReason:
      "Moody suspense and relationship tension fit readers who want atmosphere more than gore.",
  },
];
