import { beforeEach, describe, expect, it, vi } from 'vitest';

const app = vi.hoisted(() => ({
  render: vi.fn(),
  createRoot: vi.fn(),
  runtimeEnvironment: {
    name: 'development' as const,
    useFirebaseEmulators: true,
    allowRemoteFirebase: false,
    isProduction: false,
  },
}));

app.createRoot.mockReturnValue({ render: app.render });

vi.mock('react-dom/client', () => ({
  default: { createRoot: app.createRoot },
  createRoot: app.createRoot,
}));
vi.mock('../config/runtimeEnvironment', () => ({ runtimeEnvironment: app.runtimeEnvironment }));
vi.mock('../App', () => ({ default: () => null }));

describe('application entrypoint', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="root"></div>';
    delete document.documentElement.dataset.appEnvironment;
    delete document.documentElement.dataset.firebaseEmulators;
    Object.assign(app.runtimeEnvironment, {
      name: 'development',
      useFirebaseEmulators: true,
      allowRemoteFirebase: false,
      isProduction: false,
    });
  });

  it('publishes non-sensitive environment markers before rendering', async () => {
    await import('../index');

    expect(document.documentElement.dataset.appEnvironment).toBe('development');
    expect(document.documentElement.dataset.firebaseEmulators).toBe('true');
    expect(app.createRoot).toHaveBeenCalledWith(document.getElementById('root'));
    expect(app.render).toHaveBeenCalledTimes(1);
  });
});
