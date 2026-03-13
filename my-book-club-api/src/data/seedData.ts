type SeedUser = {
  id: string;
  name: string;
  email: string;
  provider: "email" | "google";
  password?: string;
  providerUserId?: string | null;
};

type SeedClub = {
  id: string;
  name: string;
  description: string;
  vibe: string;
  createdByUserId: string;
};

type SeedClubMember = {
  id: string;
  clubId: string;
  userId: string;
  role: "owner" | "admin" | "member";
};

type SeedBook = {
  id: string;
  title: string;
  author: string;
  genre: string;
  description: string;
  synopsis: string;
  isbn13: string;
  embedding: number[];
};

type SeedClubBook = {
  id: string;
  clubId: string;
  userId: string;
  bookId: string;
  status: "saved" | "shortlisted" | "current" | "finished" | "removed";
  notes?: string;
  rating?: number | null;
  isCurrentRead?: boolean;
};

export const seedUsers: SeedUser[] = [
  {
    id: "u_seed_jushita",
    name: "Jushita Rahman",
    email: "jushita@example.com",
    provider: "email",
    password: "password123",
  },
  {
    id: "u_seed_maya",
    name: "Maya Chen",
    email: "maya@example.com",
    provider: "email",
    password: "password123",
  },
  {
    id: "u_seed_leo",
    name: "Leo Martinez",
    email: "leo@example.com",
    provider: "google",
    providerUserId: "google-seed-leo",
  },
  {
    id: "u_seed_sofia",
    name: "Sofia Patel",
    email: "sofia@example.com",
    provider: "email",
    password: "password123",
  },
];

export const seedClubs: SeedClub[] = [
  {
    id: "c_seed_wednesday",
    name: "Wednesday Night Readers",
    description: "A sharp fiction club for suspense, literary mystery, and discussion-heavy reads.",
    vibe: "Moody mystery",
    createdByUserId: "u_seed_jushita",
  },
  {
    id: "c_seed_horror",
    name: "Horror Readers",
    description: "Late-night horror picks, uncanny classics, and tense psychological scares.",
    vibe: "Dark and eerie",
    createdByUserId: "u_seed_maya",
  },
  {
    id: "c_seed_escape",
    name: "Weekend Escape Shelf",
    description: "Comforting, imaginative, and transportive books for a weekend reset.",
    vibe: "Warm escape",
    createdByUserId: "u_seed_jushita",
  },
];

export const seedClubMembers: SeedClubMember[] = [
  { id: "cm_seed_1", clubId: "c_seed_wednesday", userId: "u_seed_jushita", role: "owner" },
  { id: "cm_seed_2", clubId: "c_seed_wednesday", userId: "u_seed_maya", role: "member" },
  { id: "cm_seed_3", clubId: "c_seed_wednesday", userId: "u_seed_leo", role: "member" },
  { id: "cm_seed_4", clubId: "c_seed_horror", userId: "u_seed_maya", role: "owner" },
  { id: "cm_seed_5", clubId: "c_seed_horror", userId: "u_seed_jushita", role: "member" },
  { id: "cm_seed_6", clubId: "c_seed_horror", userId: "u_seed_sofia", role: "member" },
  { id: "cm_seed_7", clubId: "c_seed_escape", userId: "u_seed_jushita", role: "owner" },
  { id: "cm_seed_8", clubId: "c_seed_escape", userId: "u_seed_leo", role: "member" },
  { id: "cm_seed_9", clubId: "c_seed_escape", userId: "u_seed_sofia", role: "member" },
];

export const seedBooks: SeedBook[] = [
  {
    id: "b_seed_maid",
    title: "The Maid",
    author: "Nita Prose",
    genre: "Mystery",
    description: "A contemporary mystery with a cozy tone and brisk pacing.",
    synopsis: "Molly Gray becomes entangled in a murder investigation inside the luxury hotel where she works.",
    isbn13: "9780593356159",
    embedding: [0.12, 0.83, 0.31, 0.55],
  },
  {
    id: "b_seed_gone_girl",
    title: "Gone Girl",
    author: "Gillian Flynn",
    genre: "Thriller",
    description: "A sharp psychological thriller with unreliable narration.",
    synopsis: "A missing-wife case unravels a poisonous marriage and a media circus built on lies.",
    isbn13: "9780307588371",
    embedding: [0.91, 0.14, 0.63, 0.4],
  },
  {
    id: "b_seed_exorcist",
    title: "The Exorcist",
    author: "William Peter Blatty",
    genre: "Horror",
    description: "A classic possession novel with psychological and supernatural dread.",
    synopsis: "A child’s violent transformation drives two priests into a brutal confrontation with evil.",
    isbn13: "9780061007224",
    embedding: [0.77, 0.22, 0.88, 0.18],
  },
  {
    id: "b_seed_seed",
    title: "Seed",
    author: "Ania Ahlborn",
    genre: "Horror",
    description: "A bleak family horror novel with cultish dread.",
    synopsis: "A man’s buried family history resurfaces with terrifying consequences for his wife and children.",
    isbn13: "9781476783734",
    embedding: [0.69, 0.35, 0.84, 0.27],
  },
  {
    id: "b_seed_cerulean",
    title: "The House in the Cerulean Sea",
    author: "TJ Klune",
    genre: "Fantasy",
    description: "A warm, character-driven fantasy with found-family energy.",
    synopsis: "A caseworker visits an extraordinary orphanage and finds his life transformed by the children there.",
    isbn13: "9781250217288",
    embedding: [0.18, 0.91, 0.22, 0.79],
  },
  {
    id: "b_seed_rebecca",
    title: "Rebecca",
    author: "Daphne du Maurier",
    genre: "Classic",
    description: "A gothic suspense novel with atmosphere and obsession.",
    synopsis: "A young bride enters Manderley and finds herself haunted by the lingering power of Rebecca.",
    isbn13: "9780380730407",
    embedding: [0.58, 0.41, 0.72, 0.46],
  },
];

export const seedClubBooks: SeedClubBook[] = [
  {
    id: "cb_seed_1",
    clubId: "c_seed_wednesday",
    userId: "u_seed_jushita",
    bookId: "b_seed_maid",
    status: "current",
    notes: "Current club read for discussion night.",
    rating: 4.5,
    isCurrentRead: true,
  },
  {
    id: "cb_seed_2",
    clubId: "c_seed_wednesday",
    userId: "u_seed_jushita",
    bookId: "b_seed_gone_girl",
    status: "saved",
    notes: "Backup suspense pick.",
    rating: 4,
  },
  {
    id: "cb_seed_3",
    clubId: "c_seed_wednesday",
    userId: "u_seed_maya",
    bookId: "b_seed_rebecca",
    status: "shortlisted",
    notes: "Strong classic mood fit.",
    rating: 4,
  },
  {
    id: "cb_seed_4",
    clubId: "c_seed_horror",
    userId: "u_seed_jushita",
    bookId: "b_seed_exorcist",
    status: "saved",
    notes: "Classic horror anchor.",
    rating: 5,
  },
  {
    id: "cb_seed_5",
    clubId: "c_seed_horror",
    userId: "u_seed_jushita",
    bookId: "b_seed_seed",
    status: "saved",
    notes: "Modern horror option.",
    rating: 4,
  },
  {
    id: "cb_seed_6",
    clubId: "c_seed_horror",
    userId: "u_seed_sofia",
    bookId: "b_seed_rebecca",
    status: "shortlisted",
    notes: "Gothic crossover pick.",
    rating: 3.5,
  },
  {
    id: "cb_seed_7",
    clubId: "c_seed_escape",
    userId: "u_seed_leo",
    bookId: "b_seed_cerulean",
    status: "current",
    notes: "Weekend comfort read.",
    rating: 5,
    isCurrentRead: true,
  },
  {
    id: "cb_seed_8",
    clubId: "c_seed_escape",
    userId: "u_seed_jushita",
    bookId: "b_seed_maid",
    status: "saved",
    notes: "A crossover mystery option.",
    rating: 4,
  },
];
