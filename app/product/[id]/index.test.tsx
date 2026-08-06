import React from 'react';
import { render } from '@testing-library/react-native';
import { Text as MockText } from 'react-native';
import ProductDetailScreen from './index';

// NOTE: Adapted from brief for RNTL v14 — `render` returns a Promise, so it is
// awaited (`findByText` is already promise-based and kept as-is). Unused
// MockImage import from the brief was dropped (consistent with task 9).

const mockGetCompletions = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ canGoBack: () => true, back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: 's1' }),
}));

jest.mock('../../../src/hooks/useProductData', () => ({
  useProductData: () => ({
    product: { name: 'Pot', difficulty: 'mudah', estimatedTimeMinutes: 30, shortDescription: 'd', estimatedCost: 5000, thumbnailUri: 'u' },
    tutData: { toolsAndMaterials: [], additionalMaterials: [] },
    priceData: { suggestedSellPrice: 25000, estimatedProfit: 10000 },
    loading: false, error: null, refetch: jest.fn(),
  }),
}));

jest.mock('../../../src/services/api', () => ({
  apiClient: { getSkillCompletions: (...a: unknown[]) => mockGetCompletions(...a) },
}));

jest.mock('../../../src/services/localState', () => ({ favorites: { toggle: jest.fn() } }));

jest.mock('../../../src/components/ui', () => ({
  Header: ({ title }: any) => <MockText>{title}</MockText>,
  Button: ({ title }: any) => <MockText>{title}</MockText>,
  Card: ({ children }: any) => children,
  Badge: () => <MockText>badge</MockText>,
  LoadingSpinner: () => <MockText>loading</MockText>,
  StarRating: ({ value }: any) => <MockText>{`stars:${value}`}</MockText>,
}));

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));

describe('ProductDetailScreen rating', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('shows avg rating and count when completions exist', async () => {
    mockGetCompletions.mockResolvedValue({
      skill_id: 's1', avg_rating: 4.5, count: 3,
      gallery: [{ photo_url: 'u', rating: 5, comment: 'ok', created_at: 'c', user_display_name: 'Budi' }],
    });
    const { findByText } = await render(<ProductDetailScreen />);
    expect(await findByText('4.5')).toBeTruthy();
    expect(await findByText('(3 review)')).toBeTruthy();
    expect(await findByText('Hasil Komunitas')).toBeTruthy();
  });

  it('shows no-review text when count is 0', async () => {
    mockGetCompletions.mockResolvedValue({ skill_id: 's1', avg_rating: 0, count: 0, gallery: [] });
    const { findByText } = await render(<ProductDetailScreen />);
    expect(await findByText('Belum ada review')).toBeTruthy();
  });
});
