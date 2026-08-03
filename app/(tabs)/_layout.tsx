import React from "react";
import { Tabs, useRouter } from "expo-router";
import { View, TouchableOpacity } from "react-native";
import { Camera, History, Home, Leaf, User } from "lucide-react-native";

function ScanTabButton(props: { accessibilityState?: { selected?: boolean } }) {
  const router = useRouter();
  const selected = props.accessibilityState?.selected;

  return (
    <TouchableOpacity
      {...props}
      onPress={() => router.push("/scan/upload")}
      activeOpacity={0.8}
      className="items-center justify-center -mt-7"
    >
      <View
        className={`w-[66px] h-[66px] rounded-full items-center justify-center border-4 border-white shadow-lg ${
          selected ? "bg-brand-dark" : "bg-brand"
        }`}
        style={{
          shadowColor: "#16a34a",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 10,
          elevation: 10,
        }}
      >
        <Camera size={28} color="#ffffff" strokeWidth={2.5} />
      </View>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#16a34a",
        tabBarInactiveTintColor: "#94a3b8",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#f1f5f9",
          borderTopWidth: 1,
          height: 82,
          paddingBottom: 16,
          paddingTop: 9,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Beranda",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="riwayat"
        options={{
          title: "Riwayat",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => <History size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          tabBarButton: (props: Record<string, unknown>) => <ScanTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="impact"
        options={{
          title: "Dampak",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => <Leaf size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => <User size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="login"
        options={{ href: null } as any}
      />
      <Tabs.Screen
        name="register"
        options={{ href: null } as any}
      />
    </Tabs>
  );
}
