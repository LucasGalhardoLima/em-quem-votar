import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock Prisma client
vi.mock('~/utils/db.server', () => ({
  db: {
    politician: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      groupBy: vi.fn()
    },
    voteLog: {
      groupBy: vi.fn()
    }
  }
}));
