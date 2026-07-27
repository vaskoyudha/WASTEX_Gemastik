declare module "expo-router" {
  import type { ComponentType, ReactNode, PropsWithChildren } from "react";

  export interface ScreenOptions {
    title?: string;
    headerShown?: boolean;
    tabBarIcon?: (props: { color: string; size: number; focused: boolean }) => ReactNode;
    tabBarButton?: (props: Record<string, unknown>) => ReactNode;
    tabBarActiveTintColor?: string;
    tabBarInactiveTintColor?: string;
    tabBarStyle?: Record<string, unknown>;
    tabBarLabelStyle?: Record<string, unknown>;
    contentStyle?: Record<string, unknown>;
  }

  export const Stack: ComponentType<PropsWithChildren<{ screenOptions?: ScreenOptions }>> & {
    Screen: ComponentType<PropsWithChildren<{ name: string; options?: ScreenOptions }>>;
  };

  export const Tabs: ComponentType<PropsWithChildren<{ screenOptions?: ScreenOptions }>> & {
    Screen: ComponentType<PropsWithChildren<{ name: string; options?: ScreenOptions }>>;
  };

  export function useRouter(): Router;
  export function useFocusEffect(callback: () => void | (() => void)): void;
  export function useLocalSearchParams<T = Record<string, string>>(): T;
  export const Redirect: ComponentType<{ href: string }>;

  export interface Router {
    push: (href: string) => void;
    replace: (href: string) => void;
    back: () => void;
    canGoBack: () => boolean;
  }

  export const router: Router;
}
