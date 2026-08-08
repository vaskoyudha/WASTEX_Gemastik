import React from "react";
import { render } from "@testing-library/react-native";

import { AnalysisLoadingView } from "./analysis-loading-view";

jest.mock("react-native-reanimated", () => {
  return {
    __esModule: true,
    default: { View: "View" },
    cancelAnimation: jest.fn(),
    Easing: {
      cubic: jest.fn(),
      quad: jest.fn(),
      inOut: jest.fn((easing) => easing),
    },
    FadeIn: { duration: jest.fn(() => undefined) },
    FadeOut: { duration: jest.fn(() => undefined) },
    interpolate: jest.fn((_value, _input, output) => output[0]),
    useAnimatedStyle: jest.fn((updater) => updater()),
    useSharedValue: jest.fn((value) => ({ value })),
    withRepeat: jest.fn((value) => value),
    withTiming: jest.fn((value) => value),
  };
});

jest.mock("../../hooks/useReducedMotion", () => ({
  useReducedMotion: () => true,
}));

jest.mock("lucide-react-native", () => ({
  Check: () => null,
  ScanLine: () => null,
  ShieldCheck: () => null,
  Sparkles: () => null,
}));

describe("AnalysisLoadingView", () => {
  it("explains the active AI analysis phase accessibly", async () => {
    const { getByLabelText, getByTestId, getByText } = await render(
      <AnalysisLoadingView photoUri="file:///photo.jpg" />,
    );

    const loader = getByTestId("analysis-loading-view");

    expect(loader.props.accessibilityRole).toBe("progressbar");
    expect(loader.props.accessibilityValue).toEqual({ text: "Mengenali material" });
    expect(getByLabelText("Sedang Memahami Materialmu")).toBeTruthy();
    expect(getByText("Mengenali material")).toBeTruthy();
  });
});
