import { render, screen } from '@testing-library/react';
import CraftPage from '../page'

describe('CraftPage', () => {
  it('renders the page heading', () => {
    render(<CraftPage/>);
      const heading = screen.getByRole('heading', { name: /craft/i });
  expect(heading).toBeInTheDocument();
    expect(true).toBe(true);
  })
})
