import { Platform, type ViewStyle } from "react-native";
import { colors } from "./colors";

export { colors };

export const gradients = {
  home: "linear-gradient(180deg, #15251B 0%, #294936 48%, #789080 100%)",
  homeImageVeil:
    "linear-gradient(180deg, rgba(4,22,16,0.18) 0%, rgba(4,22,16,0.08) 38%, rgba(4,22,16,0.42) 78%, rgba(4,22,16,0.68) 100%)",
  impact:
    "radial-gradient(circle at 92% 18%, rgba(217,241,166,0.42) 0%, rgba(217,241,166,0) 34%), linear-gradient(135deg, #536B50 0%, #71886A 58%, #A8B991 100%)",
  actionRail:
    "linear-gradient(135deg, rgba(116,139,109,0.82) 0%, rgba(80,104,78,0.9) 50%, rgba(57,77,58,0.94) 100%)",
  actionTile:
    "linear-gradient(180deg, rgba(151,170,145,0.24) 0%, rgba(78,102,77,0.28) 100%)",
  actionIcon:
    "radial-gradient(circle at 50% 18%, rgba(221,232,214,0.26) 0%, rgba(161,181,155,0.18) 48%, rgba(93,120,91,0.12) 100%)",
  contentSheet:
    "radial-gradient(circle at 100% 0%, rgba(201,238,120,0.10) 0%, rgba(201,238,120,0) 28%), linear-gradient(155deg, #FCFDFB 0%, #F4F7F3 58%, #EDF2EE 100%)",
  pageHero:
    "radial-gradient(circle at 88% 4%, rgba(211,232,171,0.2) 0%, rgba(211,232,171,0) 34%), linear-gradient(160deg, #304331 0%, #4B634A 58%, #71876D 100%)",
  navigation:
    "radial-gradient(circle at 88% 10%, rgba(220,247,161,0.18) 0%, rgba(220,247,161,0) 31%), linear-gradient(135deg, #15251B 0%, #294936 58%, #41634D 100%)",
  cameraMedallion: "linear-gradient(145deg, #71886C 0%, #506A51 100%)",
  scanButton: "linear-gradient(145deg, #DDF6AA 0%, #BEE878 100%)",
  materialActive: "linear-gradient(145deg, #405B42 0%, #263C2D 100%)",
  productHero:
    "linear-gradient(180deg, rgba(21,37,27,0) 36%, rgba(21,37,27,0.92) 100%)",
  impactImageFade:
    "radial-gradient(circle at 4% 0%, rgba(220,247,161,0.34) 0%, rgba(184,229,119,0.16) 23%, rgba(184,229,119,0) 48%), linear-gradient(180deg, rgba(5,25,17,0.12) 0%, rgba(5,25,17,0.2) 38%, rgba(5,25,17,0.56) 70%, rgba(5,25,17,0.9) 100%)",
  impactImageGlow:
    "radial-gradient(circle at 4% 0%, rgba(220,247,161,0.34) 0%, rgba(184,229,119,0.16) 23%, rgba(184,229,119,0) 48%)",
  limeWash:
    "radial-gradient(circle at 92% 8%, rgba(220,247,161,0.52) 0%, rgba(220,247,161,0) 43%), linear-gradient(145deg, #EAF2E8 0%, #D8E5D9 100%)",
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

export const screenSheetStyle: ViewStyle = {
  flex: 1,
  backgroundColor: colors.cream50,
  borderTopLeftRadius: radii.sheet,
  borderTopRightRadius: radii.sheet,
  borderCurve: "continuous",
};

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
  card: "0 2px 4px rgba(21, 37, 27, 0.04), 0 12px 30px rgba(21, 37, 27, 0.07)",
  floating: "0 4px 10px rgba(21, 37, 27, 0.08), 0 22px 48px rgba(21, 37, 27, 0.14)",
  navigation: "0 10px 30px rgba(21, 37, 27, 0.20)",
  button: "0 8px 20px rgba(29, 51, 38, 0.22)",
} as const;
