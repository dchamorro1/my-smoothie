import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      brand: {
        my: "My",
        smoothie: "Smoothie",
      },
      welcome: {
        title: "Welcome!",
        getStarted: "Let's Get Started",
        signInPrompt: "Already have an account?",
        signIn: "Sign in",
      },
    },
  },
  es: {
    translation: {
      brand: {
        my: "Mi",
        smoothie: "Batido",
      },
      welcome: {
        title: "Bienvenido!",
        getStarted: "Comenzar",
        signInPrompt: "Ya tienes una cuenta?",
        signIn: "Iniciar sesion",
      },
    },
  },
};

i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  fallbackLng: "en",
  lng: "en",
  resources,
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;
