import { expect, test } from '@playwright/test';

test('proxies API requests through the web origin', async ({ request }) => {
  const response = await request.get('/api/health');

  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toEqual({ status: 'ok' });
});
