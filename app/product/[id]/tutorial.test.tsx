import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Pressable as MockPressable, Text as MockText } from 'react-native';
import TutorialScreen from './tutorial';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    canGoBack: () => true,
    back: jest.fn(),
    push: mockPush,
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => ({ id: 's1' }),
}));

jest.mock('../../../src/hooks/useProductData', () => ({
  useProductData: () => ({
    product: { name: 'Pot Kaleng' },
    tutData: {
      productId: "s1",
      steps: [
        {
          order: 1,
          title: 'Langkah 1',
          description: 'Cuci kaleng',
          imageUri: '',
        },
      ],
      beforeImageUri: '',
      afterImageUri: '',
      mockupImageUri: '',
      toolsAndMaterials: ['Palu kecil', 'Cat akrilik'],
      tools: [
        {
          name: 'Palu kecil',
          optional: false,
          description: 'membantu membuat lubang drainase',
        },
        { name: 'Spons', optional: true },
      ],
      additionalMaterials: [
        {
          name: 'Cat akrilik',
          category: 'cat',
          est_cost_idr: 10000,
          purpose: 'mengecat dan menghias permukaan kaleng',
        },
      ],
    },
    loading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

jest.mock('../../../src/components/ui', () => ({
  Header: ({ title }: { title: string }) => <MockText>{title}</MockText>,
  Button: ({ title, onPress }: { title: string; onPress: () => void }) => (
    <MockPressable onPress={onPress}>
      <MockText>{title}</MockText>
    </MockPressable>
  ),
  Card: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => (
    <MockPressable onPress={onPress}>{children}</MockPressable>
  ),
  LoadingSpinner: ({ message }: { message: string }) => <MockText>{message}</MockText>,
  FitImage: () => <MockText>image</MockText>,
}));

jest.mock('lucide-react-native', () => ({ ShieldAlert: () => null }));

describe('TutorialScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows Saya Sudah Selesai button and navigates to complete', async () => {
    const { getByText } = await render(<TutorialScreen />);
    await fireEvent.press(getByText('Saya Sudah Selesai'));
    expect(mockPush).toHaveBeenCalledWith('/product/s1/complete');
  });

  it('shows tool descriptions and material purposes even without a generated image', async () => {
    const { findByText } = await render(<TutorialScreen />);

    expect(await findByText('LANGKAH 0')).toBeTruthy();
    expect(await findByText('membantu membuat lubang drainase')).toBeTruthy();
    expect(await findByText('mengecat dan menghias permukaan kaleng')).toBeTruthy();
    expect(await findByText('Opsional')).toBeTruthy();
    expect(await findByText('Alat pendukung untuk proses pembuatan.')).toBeTruthy();
  });
});
