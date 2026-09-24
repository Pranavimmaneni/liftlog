import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/router';
import { db, TABLES } from '@/db/schema';

/** Renders the real route tree at `path` inside a memory router. */
export function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(<RouterProvider router={router} />);
  return { ...utils, router };
}

export async function resetDb() {
  for (const t of TABLES) await db.table(t).clear();
}
