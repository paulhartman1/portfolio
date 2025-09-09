// __tests__/page.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { act } from 'react';
import Home from '../app/page';

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, ...props }: any) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}));

describe('Home Page', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders the main heading', () => {
    render(<Home />);
    
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent(/Hi! I'm/);
  });

  it('renders navigation menu', () => {
    render(<Home />);
    
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByText('Skills')).toBeInTheDocument();
    expect(screen.getByText('Contact')).toBeInTheDocument();
  });

  it('displays the animated title with initial role', () => {
    render(<Home />);
    
    // Should start with "Ally"
    expect(screen.getByText('Ally')).toBeInTheDocument();
  });

  it('cycles through different roles in animated title', async () => {
    render(<Home />);
    
    // Start with first role
    expect(screen.getByText('Ally')).toBeInTheDocument();
    
    // Fast-forward time to trigger animation
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Developer')).toBeInTheDocument();
    });
  });

  it('renders all skill cards', () => {
    render(<Home />);
    
    const expectedSkills = [
      'Inclusive Design',
      'Accessibility (WCAG)',
      'Community Building',
      'Mentorship',
      'React/Next.js',
      'TypeScript',
      'Node.js',
      'Open Source',
    ];
    
    expectedSkills.forEach(skill => {
      expect(screen.getByText(skill)).toBeInTheDocument();
    });
  });

  it('renders call-to-action buttons', () => {
    render(<Home />);
    
    expect(screen.getByText("Let's Collaborate")).toBeInTheDocument();
    expect(screen.getByText('Join the Community')).toBeInTheDocument();
    expect(screen.getByText('Start Collaborating')).toBeInTheDocument();
    expect(screen.getByText('Join Our Community')).toBeInTheDocument();
  });

  it('has proper semantic structure', () => {
    render(<Home />);
    
    // Check for semantic HTML structure
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('includes accessibility features', () => {
    render(<Home />);
    
    // Check for alt text on images
    const images = screen.getAllByRole('img');
    images.forEach(img => {
      expect(img).toHaveAttribute('alt');
    });
  });

  it('renders footer with correct information', () => {
    render(<Home />);
    
    expect(screen.getByText(/© 2025 LoveOnDev/)).toBeInTheDocument();
    expect(screen.getByText('LinkedIn')).toBeInTheDocument();
    expect(screen.getByText('Twitter')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });
});