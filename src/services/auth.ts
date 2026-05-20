import { supabase } from "../../utils/supabase";

function makeGuestEmail() {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `guest-${id}@my-smoothie.local`;
}

function makeGuestPassword() {
  return `G${Math.random().toString(36).slice(2, 10)}!`;
}

export async function signUpGuest() {
  const email = makeGuestEmail();
  const password = makeGuestPassword();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { guest: true },
    },
  });

  if (error) {
    throw error;
  }

  if (data.session) {
    return { user: data.user, session: data.session };
  }

  const signInResult = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInResult.error) {
    throw signInResult.error;
  }

  if (!signInResult.data.session) {
    throw new Error("Guest sign in did not return a session.");
  }

  return {
    user: signInResult.data.user,
    session: signInResult.data.session,
  };
}
