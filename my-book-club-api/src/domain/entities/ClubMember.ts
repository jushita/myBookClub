const CLUB_MEMBER_ROLES = ["owner", "admin", "member"] as const;

export type ClubMemberRole = (typeof CLUB_MEMBER_ROLES)[number];

type ClubMemberInput = {
  id: string;
  clubId: string;
  userId: string;
  role?: ClubMemberRole;
  joinedAt?: Date | string;
};

type ClubMemberRow = {
  id: string;
  club_id?: string;
  clubId?: string;
  user_id?: string;
  userId?: string;
  role?: ClubMemberRole;
  joined_at?: Date | string;
  joinedAt?: Date | string;
};

export class ClubMember {
  id: string;
  clubId: string;
  userId: string;
  role: ClubMemberRole;
  joinedAt: Date;

  constructor({
    id,
    clubId,
    userId,
    role = "member",
    joinedAt = new Date(),
  }: ClubMemberInput) {
    if (!id) {
      throw new Error("Club member id is required.");
    }

    if (!clubId) {
      throw new Error("Club member clubId is required.");
    }

    if (!userId) {
      throw new Error("Club member userId is required.");
    }

    if (!CLUB_MEMBER_ROLES.includes(role)) {
      throw new Error(`Unsupported club member role: ${role}`);
    }

    this.id = String(id);
    this.clubId = String(clubId);
    this.userId = String(userId);
    this.role = role;
    this.joinedAt = joinedAt instanceof Date ? joinedAt : new Date(joinedAt);
  }

  static fromDatabase(row: ClubMemberRow): ClubMember {
    return new ClubMember({
      id: row.id,
      clubId: row.club_id ?? row.clubId ?? "",
      userId: row.user_id ?? row.userId ?? "",
      role: row.role ?? "member",
      joinedAt: row.joined_at ?? row.joinedAt ?? new Date(),
    });
  }

  toDatabase() {
    return {
      id: this.id,
      club_id: this.clubId,
      user_id: this.userId,
      role: this.role,
      joined_at: this.joinedAt,
    };
  }

  toJSON() {
    return {
      id: this.id,
      clubId: this.clubId,
      userId: this.userId,
      role: this.role,
      joinedAt: this.joinedAt,
    };
  }
}

export { CLUB_MEMBER_ROLES };
