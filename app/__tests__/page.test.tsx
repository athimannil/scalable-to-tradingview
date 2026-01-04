import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';

import Page from '@/app/page';

test('Page renders the title', () => {
  render(<Page />);
  expect(
    screen.getByRole('heading', {
      level: 1,
    })
  ).toHaveTextContent('Scalable Capital to TradingView Converter');
});

test('Page renders the CsvConverter component', () => {
  render(<Page />);
  expect(screen.getByText('Upload CSV File')).toBeInTheDocument();
});

test('Page renders usage instructions', () => {
  render(<Page />);
  expect(screen.getByText('How to use')).toBeInTheDocument();
});
