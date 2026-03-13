type ClubInput = {
  id: string;
  name: string;
  description?: string;
  vibe?: string;
  createdByUserId: string;
  createdAt?: Date | string;
};

type ClubRow = {
  id: string;
  name: string;
  description?: string | null;
  vibe?: string | null;
  created_by_user_id?: string;
  createdByUserId?: string;
  created_at?: Date | string;
  createdAt?: Date | string;
};

export class Club {
  id: string;
  name: string;
  description: string;
  vibe: string;
  createdByUserId: string;
  createdAt: Date;

  constructor({
    id,
    name,
    description = "",
    vibe = "",
    createdByUserId,
    createdAt = new Date(),
  }: ClubInput) {
    if (!id) {
      throw new Error("Club id is required.");
    }

    if (!name || !String(name).trim()) {
      throw new Error("Club name is required.");
    }

    if (!createdByUserId) {
      throw new Error("Club creator is required.");
    }

    this.id = String(id);
    this.name = String(name).trim();
    this.description = String(description || "").trim();
    this.vibe = String(vibe || "").trim();
    this.createdByUserId = String(createdByUserId);
    this.createdAt = createdAt instanceof Date ? createdAt : new Date(createdAt);
  }

  static fromDatabase(row: ClubRow): Club {
    return new Club({
      id: row.id,
      name: row.name,
      description: row.description ?? "",
      vibe: row.vibe ?? "",
      createdByUserId: row.created_by_user_id ?? row.createdByUserId ?? "",
      createdAt: row.created_at ?? row.createdAt ?? new Date(),
    });
  }

  toDatabase() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      vibe: this.vibe,
      created_by_user_id: this.createdByUserId,
      created_at: this.createdAt,
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      vibe: this.vibe,
      createdByUserId: this.createdByUserId,
      createdAt: this.createdAt,
    };
  }
}
