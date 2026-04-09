import AsyncStorage from "@react-native-async-storage/async-storage";

import { AuthSession } from "../types";

const SESSION_KEY = "flocktrax.session";

export async function loadStoredSession(): Promise<AuthSession | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  return JSON.parse(raw) as AuthSession;
}

export async function persistSession(session: AuthSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearStoredSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}
