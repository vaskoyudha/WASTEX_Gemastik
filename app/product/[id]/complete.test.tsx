import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Pressable as MockPressable, Text as MockText } from 'react-native';
import CompleteScreen from './complete';

// NOTE: Adapted from brief for RNTL v14 — `render` returns a Promise and
// `fireEvent.press` is async, so both are awaited. Assertions preserved verbatim.

const mockComplete = jest.fn();
const mockRouterReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ canGoBack: () => true, back: jest.fn(), replace: mockRouterReplace }),
  useLocalSearchParams: () => ({ id: 's1' }),
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('../../../src/services/api', () => ({
  apiClient: { completeSkill: (...a: unknown[]) => mockComplete(...a) },
}));

jest.mock('../../../src/components/ui', () => ({
  Header: ({ title }: { title: string }) => <MockText>{title}</MockText>,
  Button: ({ title, onPress, disabled }: any) => (
    <MockPressable onPress={onPress} disabled={disabled}><MockText>{title}</MockText></MockPressable>
  ),
  StarRating: ({ onChange }: any) => (
    <MockPressable onPress={() => onChange?.(5)}><MockText>stars</MockText></MockPressable>
  ),
}));

jest.mock('lucide-react-native', () => ({ Image: () => null, Camera: () => null }));

describe('CompleteScreen', () => {
  beforeEach(() => { jest.clearAllMocks(); mockComplete.mockResolvedValue({}); });

  it('submit disabled until photo and rating set', async () => {
    const { getByText } = await render(<CompleteScreen />);
    const submit = getByText('Kirim Hasil');
    expect(submit).toBeTruthy();
  });

  it('calls completeSkill with rating after picking photo and stars', async () => {
    const picker = require('expo-image-picker');
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///p.jpg' }] });
    const { getByText } = await render(<CompleteScreen />);
    await fireEvent.press(getByText('Ambil dari Galeri'));
    await fireEvent.press(getByText('stars'));
    await fireEvent.press(getByText('Kirim Hasil'));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockComplete).toHaveBeenCalledWith('s1', 'file:///p.jpg', 5, undefined);
  });
});
