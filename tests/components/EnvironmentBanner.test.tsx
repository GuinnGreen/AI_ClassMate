import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const environment = vi.hoisted(() => ({
  runtimeEnvironment: {
    name: 'development' as const,
    useFirebaseEmulators: true,
    allowRemoteFirebase: false,
    isProduction: false,
  },
}));

vi.mock('../../config/runtimeEnvironment', () => environment);

import { EnvironmentBanner } from '../../components/EnvironmentBanner';

describe('EnvironmentBanner', () => {
  beforeEach(() => {
    Object.assign(environment.runtimeEnvironment, {
      name: 'development',
      useFirebaseEmulators: true,
      allowRemoteFirebase: false,
      isProduction: false,
    });
  });

  it('identifies emulator-backed development visibly', () => {
    render(<EnvironmentBanner />);

    expect(screen.getByText('DEVELOPMENT · FIREBASE EMULATOR')).toBeInTheDocument();
  });

  it('does not render an environment marker in production', () => {
    Object.assign(environment.runtimeEnvironment, {
      name: 'production',
      useFirebaseEmulators: false,
      allowRemoteFirebase: true,
      isProduction: true,
    });

    const { container } = render(<EnvironmentBanner />);

    expect(container).toBeEmptyDOMElement();
  });
});
