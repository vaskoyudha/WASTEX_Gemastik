import type { PropsWithChildren } from "react";
import { Stack } from "expo-router/js-stack";
import { useReducedMotion } from "../hooks/useReducedMotion";

export function RootStack({ children }: PropsWithChildren) {
  const reducedMotion = useReducedMotion();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: "#E9EEE7" },
        animation: reducedMotion ? "none" : "slide_from_right",
        gestureEnabled: false,
      }}
    >
      {children}
    </Stack>
  );
}

export const RootStackScreen = Stack.Screen;
