import "./src/i18n";

import WelcomeScreen from "./src/screens/WelcomeScreen";

export default function App() {
  // TODO: Add dynamic language switching and persist the user's choice, e.g., using AsyncStorage or a context provider. For now, it defaults to English.
  return <WelcomeScreen />;
}
