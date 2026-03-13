import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { User } from "../domain/entities/index.js";

const JWT_SECRET = process.env.AUTH_JWT_SECRET || "dev-secret-change-me";

type PublicUser = Pick<User, "id" | "name" | "email" | "provider">;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function signToken(user: PublicUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      provider: user.provider,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function serializeUser(user: PublicUser): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    provider: user.provider,
  };
}
