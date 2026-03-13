const USER_PROVIDERS = ["email", "google"] as const;

export type UserProvider = (typeof USER_PROVIDERS)[number];

type UserInput = {
  id: string;
  name: string;
  email: string;
  passwordHash?: string | null;
  provider?: UserProvider;
  providerUserId?: string | null;
  createdAt?: Date | string;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash?: string | null;
  passwordHash?: string | null;
  provider: UserProvider;
  provider_user_id?: string | null;
  providerUserId?: string | null;
  created_at?: Date | string;
  createdAt?: Date | string;
};

export class User {
  id: string;
  name: string;
  email: string;
  passwordHash: string | null;
  provider: UserProvider;
  providerUserId: string | null;
  createdAt: Date;

  constructor({
    id,
    name,
    email,
    passwordHash = null,
    provider = "email",
    providerUserId = null,
    createdAt = new Date(),
  }: UserInput) {
    if (!id) {
      throw new Error("User id is required.");
    }

    if (!name || !String(name).trim()) {
      throw new Error("User name is required.");
    }

    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail.includes("@")) {
      throw new Error("A valid user email is required.");
    }

    if (!USER_PROVIDERS.includes(provider)) {
      throw new Error(`Unsupported user provider: ${provider}`);
    }

    this.id = String(id);
    this.name = String(name).trim();
    this.email = normalizedEmail;
    this.passwordHash = passwordHash ? String(passwordHash) : null;
    this.provider = provider;
    this.providerUserId = providerUserId ? String(providerUserId) : null;
    this.createdAt = createdAt instanceof Date ? createdAt : new Date(createdAt);
  }

  static fromDatabase(row: UserRow): User {
    return new User({
      id: row.id,
      name: row.name,
      email: row.email,
      passwordHash: row.password_hash ?? row.passwordHash ?? null,
      provider: row.provider,
      providerUserId: row.provider_user_id ?? row.providerUserId ?? null,
      createdAt: row.created_at ?? row.createdAt ?? new Date(),
    });
  }

  toDatabase() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      password_hash: this.passwordHash,
      provider: this.provider,
      provider_user_id: this.providerUserId,
      created_at: this.createdAt,
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      provider: this.provider,
      providerUserId: this.providerUserId,
      createdAt: this.createdAt,
    };
  }
}

export { USER_PROVIDERS };
