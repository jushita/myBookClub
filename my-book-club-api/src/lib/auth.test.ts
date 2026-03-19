import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { comparePassword, hashPassword, serializeUser, signToken } from "./auth.js";

test("hashPassword and comparePassword round-trip", async () => {
  const password = "super-secret-password";
  const hash = await hashPassword(password);

  assert.notEqual(hash, password);
  assert.equal(await comparePassword(password, hash), true);
  assert.equal(await comparePassword("wrong-password", hash), false);
});

test("signToken signs the expected public claims", () => {
  const token = signToken({
    id: "u1",
    name: "Jushita",
    email: "jushita@example.com",
    provider: "google",
  });

  const payload = jwt.verify(token, "dev-secret-change-me") as jwt.JwtPayload;

  assert.equal(payload.sub, "u1");
  assert.equal(payload.email, "jushita@example.com");
  assert.equal(payload.provider, "google");
});

test("serializeUser returns only public user fields", () => {
  const user = serializeUser({
    id: "u2",
    name: "Reader",
    email: "reader@example.com",
    provider: "email",
  });

  assert.deepEqual(user, {
    id: "u2",
    name: "Reader",
    email: "reader@example.com",
    provider: "email",
  });
});
