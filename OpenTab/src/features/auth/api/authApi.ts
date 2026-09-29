// Autori: Milica Tadić ([student ID omitted], SSU11), Boško Trifunović ([student ID omitted], SSU16-19)
import { apiGet, apiPost } from "../../../shared/api/client";
import type { AuthRole, AuthSession, AuthUser } from "../session/authStorage";

export type LoginPayload = {
  identifier: string;
  password: string;
  role: AuthRole;
};

export type CurrentUserResponse = {
  user: AuthUser;
};

export function loginUser(payload: LoginPayload) {
  return apiPost<AuthSession>("/auth/login/", payload);
}

export function getCurrentUser() {
  return apiGet<CurrentUserResponse>("/auth/me/");
}

export function logoutUser() {
  return apiPost<{ ok: boolean }>("/auth/logout/", {});
}
