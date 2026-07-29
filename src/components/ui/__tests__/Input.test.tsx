import React from "react";
import { render } from "@testing-library/react-native";
import { Input } from "../Input";

describe("Input Component", () => {
  it("renders without crashing", () => {
    const result = render(<Input placeholder="Test input" />);
    expect(result).toBeTruthy();
  });

  it("accepts callbacks", () => {
    const onChange = jest.fn();
    const result = render(<Input onChangeText={onChange} />);
    expect(result).toBeTruthy();
  });
});
