import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "../../utils/supabase";

const DEFAULT_API_URL = Platform.OS === "android"
  ? "http://10.0.2.2:8000"
  : "http://localhost:8000";

const extraApiUrl = (Constants.expoConfig?.extra?.apiUrl ?? Constants.manifest?.extra?.apiUrl) as string | undefined;
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? extraApiUrl ?? DEFAULT_API_URL;

export async function signUpGuest() {
  const { data, error } = await supabase.auth.signInAnonymously();

  if (error) {
    console.error("Anonymous sign in error:", error);
    throw error;
  }

  if (!data.session) {
    throw new Error("Anonymous sign in did not return a session.");
  }

  console.log("Guest sign up successful. Session token:", data.session.access_token ? `${data.session.access_token.substring(0, 20)}...` : "UNDEFINED");

  return {
    user: data.user,
    session: data.session,
  };
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    throw error;
  }

  if (!data.session) {
    throw new Error("Sign in did not return a session.");
  }

  return {
    user: data.user,
    session: data.session,
  };
}

export async function deleteAccount(accessToken: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/user/`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to delete account: ${response.status} ${text}`);
  }
}

export interface UserProfile {
  id: string;
  difficulty_level: string;
  is_guest_user: boolean;
}

export async function getProfile(accessToken: string): Promise<UserProfile | null> {
  const response = await fetch(`${API_URL}/api/profile/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to fetch profile: ${response.status}`);
  return response.json();
}

export async function completeOnboarding(
  accessToken: string,
  difficultyLevel: string,
  allergies: string[],
  isGuestUser: boolean
): Promise<void> {
  const response = await fetch(`${API_URL}/api/onboarding/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      difficulty_level: difficultyLevel,
      allergies,
      is_guest_user: isGuestUser,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Onboarding failed: ${response.status} ${text}`);
  }
}

export async function updateDifficulty(accessToken: string, difficultyLevel: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/profile/`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ difficulty_level: difficultyLevel }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to update difficulty: ${response.status} ${text}`);
  }
}

export interface CalendarStats {
  target: number;
  goal: number;
  events: string[]; // UTC ISO timestamps of consumed plants
}

export async function fetchCalendarStats(
  accessToken: string,
  startISO: string,
  endISO: string
): Promise<CalendarStats> {
  const params = `start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`;
  const response = await fetch(`${API_URL}/api/stats/calendar?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Failed to fetch stats: ${response.status}`);
  return response.json();
}

export interface StatsSummary {
  unique_this_month: number;
  streak: number;
  target: number;
}

export async function fetchStatsSummary(
  accessToken: string,
  monthStartISO: string,
  monthEndISO: string,
  tzOffsetMinutes: number
): Promise<StatsSummary> {
  const params =
    `month_start=${encodeURIComponent(monthStartISO)}` +
    `&month_end=${encodeURIComponent(monthEndISO)}` +
    `&tz_offset=${tzOffsetMinutes}`;
  const response = await fetch(`${API_URL}/api/stats/summary?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Failed to fetch summary: ${response.status}`);
  return response.json();
}

export interface DayPlants {
  plants: { common_name: string; fiber_quantity: number }[];
  total_plants: number;
  total_fiber: number;
}

export async function fetchDayPlants(
  accessToken: string,
  startISO: string,
  endISO: string
): Promise<DayPlants> {
  const params = `start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`;
  const response = await fetch(`${API_URL}/api/stats/day?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Failed to fetch day: ${response.status}`);
  return response.json();
}

export interface ActivePlant {
  id: number;
  status: "bought" | "pending";
  position_index: number;
  common_name: string;
  fiber_quantity: number;
}

export interface PlantSearchResult {
  id: number;
  common_name: string;
  fiber_quantity: number;
}

export async function searchPlants(accessToken: string, query: string): Promise<PlantSearchResult[]> {
  const response = await fetch(`${API_URL}/api/plants/search?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Search failed: ${response.status}`);
  const data = await response.json();
  return data.results;
}

export async function addCustomPlant(accessToken: string, plantId: number): Promise<ActivePlant> {
  const response = await fetch(`${API_URL}/api/user-active-plants/custom`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ north_american_plant_foods_id: plantId }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to add plant: ${response.status} ${text}`);
  }
  const data = await response.json();
  return data.plant;
}

export async function removePlant(
  accessToken: string,
  plantId: number,
  reason: "consumed" | "discarded"
): Promise<ActivePlant | null> {
  const response = await fetch(
    `${API_URL}/api/user-active-plants/${plantId}?reason=${reason}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to remove plant: ${response.status} ${text}`);
  }
  const data = await response.json();
  return data.new_plant ?? null;
}

export async function fetchAllergies(accessToken: string): Promise<string[]> {
  const response = await fetch(`${API_URL}/api/allergies/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Failed to fetch allergies: ${response.status}`);
  const data = await response.json();
  return data.allergies;
}

export async function updateAllergies(accessToken: string, allergies: string[]): Promise<void> {
  const response = await fetch(`${API_URL}/api/allergies/`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ allergies }),
  });
  if (!response.ok) throw new Error(`Failed to update allergies: ${response.status}`);
}

export interface WeeklyProgress {
  consumed: number;
  goal: number;
}

export function getLocalWeekStart(): string {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sun
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

export async function fetchWeeklyProgress(accessToken: string): Promise<WeeklyProgress> {
  const weekStart = encodeURIComponent(getLocalWeekStart());
  const response = await fetch(`${API_URL}/api/progress/?week_start=${weekStart}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Failed to fetch progress: ${response.status}`);
  return response.json();
}

export async function skipPlant(accessToken: string, plantId: number): Promise<ActivePlant | null> {
  const response = await fetch(`${API_URL}/api/user-active-plants/${plantId}/skip`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to skip plant: ${response.status} ${text}`);
  }
  const data = await response.json();
  return data.new_plant ?? null;
}

export async function buyPlant(accessToken: string, plantId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/user-active-plants/${plantId}/buy`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to update plant: ${response.status} ${text}`);
  }
}

export async function fetchUserActivePlants(accessToken: string): Promise<ActivePlant[]> {
  if (!accessToken) {
    throw new Error("No access token provided to fetchUserActivePlants");
  }

  const response = await fetch(`${API_URL}/api/user-active-plants/`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Backend request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  if (!Array.isArray(data.plants)) {
    throw new Error("Unexpected response format from backend.");
  }

  return data.plants;
}
