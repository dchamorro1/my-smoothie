import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "../../utils/supabase";

const DEFAULT_API_URL = Platform.OS === "android"
  ? "http://10.0.2.2:8000"
  : "http://192.168.1.70:8000";

// For local dev, update 192.168.1.70 with what you get when running ipconfig getifaddr en0

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

export async function fetchUserActivePlantsCount(accessToken: string) {
  console.log("fetchUserActivePlantsCount called with token:", accessToken ? `${accessToken.substring(0, 20)}...` : "UNDEFINED/NULL");
  console.log("API_URL:", API_URL);

  if (!accessToken) {
    throw new Error("No access token provided to fetchUserActivePlantsCount");
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

  if (typeof data.count !== "number") {
    throw new Error("Unexpected response format from backend.");
  }

  return data.count;
}
