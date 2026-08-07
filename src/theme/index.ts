import { Platform, type ViewStyle } from "react-native";

export { colors } from "./colors";

export const gradients = {
  home: "linear-gradient(180deg, #304331 0%, #465E45 48%, #7E947A 100%)",
  impact:
    "radial-gradient(circle at 92% 18%, rgba(217,241,166,0.42) 0%, rgba(217,241,166,0) 34%), linear-gradient(135deg, #536B50 0%, #71886A 58%, #A8B991 100%)",
  actionRail:
    "linear-gradient(135deg, rgba(116,139,109,0.82) 0%, rgba(80,104,78,0.9) 50%, rgba(57,77,58,0.94) 100%)",
  actionTile:
    "linear-gradient(180deg, rgba(151,170,145,0.24) 0%, rgba(78,102,77,0.28) 100%)",
  actionIcon:
    "radial-gradient(circle at 50% 18%, rgba(221,232,214,0.26) 0%, rgba(161,181,155,0.18) 48%, rgba(93,120,91,0.12) 100%)",
  contentSheet: "linear-gradient(155deg, #FCFCF9 0%, #F4F7F2 58%, #EDF2EB 100%)",
  pageHero:
    "radial-gradient(circle at 88% 4%, rgba(211,232,171,0.2) 0%, rgba(211,232,171,0) 34%), linear-gradient(160deg, #304331 0%, #4B634A 58%, #71876D 100%)",
  navigation: "linear-gradient(180deg, #435A43 0%, #344936 100%)",
  cameraMedallion: "linear-gradient(145deg, #71886C 0%, #506A51 100%)",
  scanButton: "linear-gradient(145deg, #DDF6AA 0%, #BEE878 100%)",
  materialActive: "linear-gradient(145deg, #405B42 0%, #263C2D 100%)",
} as const;

export function gradientStyle(value: string): ViewStyle {
  return Platform.select({
    web: { backgroundImage: value } as ViewStyle,
    default: { experimental_backgroundImage: value },
  })!;
}

export const radii = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 24,
  sheet: 28,
  capsule: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const shadows = {
  card: "0 3px 12px rgba(37, 52, 39, 0.08)",
  floating: "0 12px 28px rgba(37, 52, 39, 0.13)",
  navigation: "0 -7px 24px rgba(25, 39, 28, 0.18)",
} as const;
