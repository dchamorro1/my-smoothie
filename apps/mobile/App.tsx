import "./src/i18n";

import React, { useEffect, useState } from "react";
import { ActivityIndicator, View, Text } from "react-native";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import WelcomeScreen from "./src/screens/WelcomeScreen";
import MyActiveIngredients from "./src/screens/MyActiveIngredients";
import SignInScreen from "./src/screens/SignInScreen";
import { supabase } from "./utils/supabase";

type AuthScreen = "welcome" | "signIn";

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const [initializing, setInitializing] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [authScreen, setAuthScreen] = useState<AuthScreen>("welcome");

  useEffect(() => {
    const restoreSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error("Session restore failed:", error.message);
      }
      setHasSession(!!data.session);
      setInitializing(false);
    };

    restoreSession();
  }, []);

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
        <Text>Checking session...</Text>
      </View>
    );
  }

  if (hasSession) {
    return (
      <MyActiveIngredients
        onSignOut={() => {
          setHasSession(false);
          setAuthScreen("welcome");
        }}
      />
    );
  }

  if (authScreen === "signIn") {
    return (
      <SignInScreen
        onBack={() => setAuthScreen("welcome")}
        onSignedIn={() => setHasSession(true)}
      />
    );
  }

  return (
    <WelcomeScreen
      onGuestCreated={() => setHasSession(true)}
      onSignIn={() => setAuthScreen("signIn")}
    />
  );
}


// type Todo = {
//   id: number;
//   name: string;
// };

// export default function App() {
//  const [todos, setTodos] = useState<Todo[]>([]);

//  useEffect(() => {
//    const getTodos = async () => {
//       try {
//         const { data: todos, error } = await supabase.from('todos').select();

//         if (error) {
//           console.error('Error fetching todos:', error.message);
//           return;
//         }

//         if (todos && todos.length > 0) {
//           setTodos(todos);
//         }
//       } catch (error) {
//         if (error instanceof Error) {
//           console.error('Error fetching todos:', error.message);
//         } else {
//           console.error('Error fetching todos:', error);
//         }
//       }
//     };

//     getTodos();
//   }, []);

//   return (
//     <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
//       <Text>Todo List</Text>
//       <FlatList
//         data={todos}
//         keyExtractor={(item) => item.id.toString()}
//         renderItem={({ item }) => <Text key={item.id}>{item.name}</Text>}
//       />
//     </View>
//   );
// };
