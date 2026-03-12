import type { AuthUser } from "../types";
import { apiBaseUrl, requestJson } from "./http";

export type AuthPayload = {
  token: string;
  user: AuthUser;
};

export async function signUpWithEmail(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthPayload> {
  return requestJson<AuthPayload>(`${apiBaseUrl}/api/auth/signup`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function loginWithEmail(input: {
  email: string;
  password: string;
}): Promise<AuthPayload> {
  return requestJson<AuthPayload>(`${apiBaseUrl}/api/auth/login`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function loginWithSocial(input: {
  provider: "google";
  email: string;
  name: string;
  providerUserId?: string;
}): Promise<AuthPayload> {
  return requestJson<AuthPayload>(`${apiBaseUrl}/api/auth/social`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
