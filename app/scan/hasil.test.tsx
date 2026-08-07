import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Pressable as MockPressable, StyleSheet, Text as MockText } from 'react-native';
import HasilScreen from './hasil';

const mockGetSkills = jest.fn();
const mockPush = jest.fn();
const mockUseScanStore = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ canGoBack: () => true, back: jest.fn(), push: mockPush, replace: jest.fn() }),
}));

jest.mock('../../src/store/useScanStore', () => ({
  useScanStore: () => mockUseScanStore(),
}));

jest.mock('../../src/services/api', () => ({
  apiClient: { getSkills: (...args: unknown[]) => mockGetSkills(...args) },
}));

jest.mock('../../src/services', () => ({
  recommendation: { getRecommendations: jest.fn().mockResolvedValue([]) },
}));

jest.mock('../../src/services/localState', () => ({
  bookmarks: { toggle: jest.fn() },
}));

jest.mock('../../src/hooks/useServiceCall', () => ({
  useServiceCall: () => ({
    data: null,
    loading: false,
    error: null,
    execute: jest.fn(),
    refetch: jest.fn(),
    reset: jest.fn(),
  }),
}));

jest.mock('../../src/components/ui', () => ({
  Badge: ({ label }: { label?: string }) => <MockText>{label ?? 'Aman'}</MockText>,
  Card: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Header: ({ title }: { title: string }) => <MockText>{title}</MockText>,
  Button: ({ title, onPress }: { title: string; onPress: () => void }) => (
    <MockPressable onPress={onPress}><MockText>{title}</MockText></MockPressable>
  ),
}));

jest.mock('lucide-react-native', () => ({
  Edit3: () => null,
  X: () => null,
  MapPin: () => null,
  BarChart2: () => null,
  TrendingUp: () => null,
  ShieldCheck: () => null,
  ArrowRight: () => null,
  Sparkles: () => null,
  Check: () => null,
  ChevronRight: () => null,
}));

describe('HasilScreen skill section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSkills.mockResolvedValue([
      { id: 'v1', title: 'Pot Gantung PET', difficulty: 'pemula', material: 'plastik_pet' },
    ]);
    mockUseScanStore.mockReturnValue({
      imageUri: null,
      scanResult: {
        materialType: 'plastik_pet',
        materialLabel: 'Botol PET',
        condition: 'Bersih',
        confidence: 0.9,
        riskLevel: 'aman' as const,
        difficulty: 'mudah' as const,
        potentialValue: 'sedang' as const,
        safetyNotes: [],
        potentialUses: [],
      },
      updateScanResultMaterial: jest.fn(),
      setRecommendations: jest.fn(),
    });
  });

  it('navigates to skill creator', async () => {
    const { getByText } = await render(<HasilScreen />);
    fireEvent.press(getByText('Buat skill baru'));
    expect(mockPush).toHaveBeenCalledWith('/scan/skill-creator');
  });

  it('keeps the result sheet vertically scrollable', async () => {
    const { getByTestId } = await render(<HasilScreen />);
    const resultScrollView = getByTestId('analysis-results-scroll');

    expect(StyleSheet.flatten(resultScrollView.props.style).overflow).not.toBe('hidden');
  });

  it('renders verified skills for the material', async () => {
    const { findByText } = await render(<HasilScreen />);
    expect(await findByText('Pot Gantung PET')).toBeTruthy();
    expect(mockGetSkills).toHaveBeenCalledWith({
      status: 'approved',
      material: 'plastik_pet',
    });
  });

  it('shows verification banner and auto-opens modal when needsVerification', async () => {
    mockUseScanStore.mockReturnValue({
      imageUri: null,
      scanResult: {
        materialType: 'plastik_hdpe',
        materialLabel: 'Botol Plastik HDPE',
        condition: 'Warna solid',
        confidence: 0.5,
        riskLevel: 'aman' as const,
        difficulty: 'mudah' as const,
        potentialValue: 'sedang' as const,
        safetyNotes: [],
        potentialUses: [],
        needsVerification: true,
      },
      updateScanResultMaterial: jest.fn(),
      setRecommendations: jest.fn(),
    });

    const { findByText } = await render(<HasilScreen />);
    expect(await findByText(/Keyakinan AI rendah/)).toBeTruthy();
    expect(await findByText('Verifikasi Material')).toBeTruthy();
  });
});
