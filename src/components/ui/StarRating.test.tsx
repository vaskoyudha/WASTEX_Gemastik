import React from 'react';
import { fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { StarRating } from './StarRating';

jest.mock('lucide-react-native', () => ({ Star: () => null }));

// Adaptation note: @testing-library/react-native v14 removed UNSAFE_getAllByType
// and made render/fireEvent async. The touchable host views are located via the
// pressability responder prop (the same check RNTL's internal isTouchResponder
// uses), preserving the brief's assertions: 5 stars render, tapping the 4th
// star calls onChange(4).
const getTouchables = ({ container }: RenderResult) =>
  container.queryAll((el) => typeof el.props.onStartShouldSetResponder === 'function');

describe('StarRating', () => {
  it('renders 5 stars', async () => {
    const view = await render(<StarRating value={3} />);
    expect(getTouchables(view).length).toBe(5);
  });

  it('calls onChange with tapped star value', async () => {
    const onChange = jest.fn();
    const view = await render(<StarRating value={0} onChange={onChange} />);
    await fireEvent.press(getTouchables(view)[3]);
    expect(onChange).toHaveBeenCalledWith(4);
  });
});
