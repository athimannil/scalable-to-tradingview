import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';

import Page from '@/app/page';

test('Page renders the title', () => {
  render(<Page />);
  expect(
    screen.getByRole('heading', {
      level: 1,
    })
  ).toHaveTextContent('Scalable Portfolio Converter');
});

test('Page renders the CsvConverter component', () => {
  render(<Page />);
  expect(screen.getByText('Upload CSV File')).toBeInTheDocument();
});

test('Page renders usage instructions', () => {
  render(<Page />);
  expect(screen.getByText('How to use')).toBeInTheDocument();
});

test('Page shows TradingView format info', () => {
  render(<Page />);
  expect(screen.getByText('TradingView')).toBeInTheDocument();
});

test('Page shows Wealthfolio format info', () => {
  render(<Page />);
  expect(screen.getByText('Wealthfolio')).toBeInTheDocument();
});
