import { Router } from "express";
import { comparePassword, hashPassword, serializeUser, signToken } from "../lib/auth.js";
import { createUser, findUserByEmail } from "../repositories/users.js";

export const authRouter = Router();

authRouter.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body ?? {};
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!name || !normalizedEmail || !password) {
      res.status(400).json({ error: "name, email, and password are required" });
      return;
    }

    if (String(password).length < 8) {
      res.status(400).json({ error: "password must be at least 8 characters" });
      return;
    }

    const existingUser = await findUserByEmail(normalizedEmail);

    if (existingUser) {
      res.status(409).json({ error: "user already exists" });
      return;
    }

    const user = await createUser({
      id: `u${Date.now()}`,
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash: await hashPassword(String(password)),
      provider: "email",
      providerUserId: null,
    });

    res.status(201).json({
      token: signToken(user),
      user: serializeUser(user),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "signup failed" });
  }
});

authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const user = await findUserByEmail(normalizedEmail);

    if (!user || user.provider !== "email" || !user.passwordHash) {
      res.status(401).json({ error: "invalid email or password" });
      return;
    }

    const isValid = await comparePassword(String(password || ""), user.passwordHash);

    if (!isValid) {
      res.status(401).json({ error: "invalid email or password" });
      return;
    }

    res.json({
      token: signToken(user),
      user: serializeUser(user),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "login failed" });
  }
});

authRouter.post("/social", async (req, res) => {
  try {
    const { provider, email, name, providerUserId } = req.body ?? {};
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (String(provider) !== "google" || !normalizedEmail || !name) {
      res.status(400).json({ error: "provider, email, and name are required" });
      return;
    }

    let user = await findUserByEmail(normalizedEmail);

    if (!user) {
      user = await createUser({
        id: `u${Date.now()}`,
        name: String(name).trim(),
        email: normalizedEmail,
        provider: "google",
        providerUserId: providerUserId ? String(providerUserId) : null,
        passwordHash: null,
      });
    }

    res.json({
      token: signToken(user),
      user: serializeUser(user),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "social login failed" });
  }
});
