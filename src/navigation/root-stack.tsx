import type { PropsWithChildren } from "react";
import { Stack } from "expo-router";
import { useReducedMotion } from "../hooks/useReducedMotion";

export function RootStack({ children }: PropsWithChildren) {
  const reducedMotion = useReducedMotion();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#E9EEE7" },
        animation: reducedMotion ? "none" : "default",
      }}
    >
      {children}
    </Stack>
  );
}

export const RootStackScreen = Stack.Screen;
