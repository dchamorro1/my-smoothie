import { supabase } from "../../utils/supabase";

export async function signUpGuest() {
  const { data, error } = await supabase.auth.signInAnonymously();

  if (error) {
    console.error("Anonymous sign in error:", error);
    throw error;
  }

  if (!data.session) {
    throw new Error("Anonymous sign in did not return a session.");
  }

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
