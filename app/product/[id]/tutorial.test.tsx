import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Pressable as MockPressable, Text as MockText } from 'react-native';
import TutorialScreen from './tutorial';

// NOTE: Adapted from brief for RNTL v14 — `render` returns a Promise and
// `fireEvent.press` is async, so both are awaited. Assertion preserved verbatim.
// Unused MockImage/MockView imports from the brief were dropped.

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ canGoBack: () => true, back: jest.fn(), push: mockPush }),
  useLocalSearchParams: () => ({ id: 's1' }),
}));

jest.mock('../../../src/hooks/useProductData', () => ({
  useProductData: () => ({
    product: { name: 'Pot' },
    tutData: { steps: [{ order: 1, title: 'Cuci', description: 'd', imageUri: 'u' }], additionalMaterials: [] },
    loading: false, error: null, refetch: jest.fn(),
  }),
}));

jest.mock('../../../src/components/ui', () => ({
  Header: ({ title }: any) => <MockText>{title}</MockText>,
  Button: ({ title, onPress }: any) => <MockPressable onPress={onPress}><MockText>{title}</MockText></MockPressable>,
  Card: ({ children, onPress }: any) => <MockPressable onPress={onPress}>{children}</MockPressable>,
  LoadingSpinner: () => <MockText>loading</MockText>,
}));

jest.mock('lucide-react-native', () => ({ ShieldAlert: () => null }));

describe('TutorialScreen', () => {
  it('shows Saya Sudah Selesai button and navigates to complete', async () => {
    const { getByText } = await render(<TutorialScreen />);
    await fireEvent.press(getByText('Saya Sudah Selesai'));
    expect(mockPush).toHaveBeenCalledWith('/product/s1/complete');
  });
});
