// Mock AsyncStorage for Jest tests - keep this as last fallback
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
