import { expect, test } from '@playwright/test';

test('real emulator login, scoring and AI failure preserve teacher data', async ({ page, request }, testInfo) => {
  test.skip(!process.env.FIRESTORE_EMULATOR_HOST, 'Requires isolated Auth and Firestore emulators');
  expect(process.env.GCLOUD_PROJECT).toBe('demo-classmate-ai');
  const email = `integrity-${testInfo.project.name}-${Date.now()}@example.test`;
  const password = 'Emulator-only-123';
  const signup = await request.post('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key', {
    data: { email, password, returnSecureToken: true },
  });
  expect(signup.ok()).toBeTruthy();
  const { localId: uid } = await signup.json();
  const studentUrl = `http://127.0.0.1:8080/v1/projects/demo-classmate-ai/databases/(default)/documents/users/${uid}/students/student-1`;
  const date = new Date().toLocaleDateString('sv-SE');
  const seed = await request.patch(studentUrl, {
    headers: { Authorization: 'Bearer owner' },
    data: { fields: {
      name: { stringValue: '驗證學生' }, totalScore: { integerValue: '0' },
      seatNumber: { integerValue: '1' }, tags: { arrayValue: { values: [] } },
      comment: { stringValue: '原有評語必須保留' },
      dailyRecords: { mapValue: { fields: { [date]: { mapValue: { fields: {
        note: { stringValue: '原有備註必須保留' },
      } } } } } },
    } },
  });
  expect(seed.ok()).toBeTruthy();
  await page.route('**/getAiQuotaUsage', route => route.fulfill({ json: { result: {
    used: 0, limit: 30, dayKey: date, startMs: Date.now() - 1000,
    endMs: Date.now() + 3600000, serverNowMs: Date.now(),
  } } }));
  await page.route('**/generateText', route => route.fulfill({ status: 200,
    json: { error: { status: 'RESOURCE_EXHAUSTED', message: 'Test quota exceeded' } },
  }));
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: '進入系統' }).click();
  await expect(page.getByRole('heading', { name: '主畫面' })).toBeAttached();
  if (testInfo.project.name === 'mobile-chromium') {
    await page.locator('button.fixed').first().click();
  }
  await page.getByRole('button', { name: /1 驗證學生/ }).click();
  await page.getByRole('button', { name: '+1 回答正確', exact: true }).click();
  await expect.poll(async () => {
    const response = await request.get(studentUrl, { headers: { Authorization: 'Bearer owner' } });
    return (await response.json()).fields.totalScore.integerValue;
  }).toBe('1');
  const stored = await (await request.get(studentUrl, { headers: { Authorization: 'Bearer owner' } })).json();
  expect(stored.fields.dailyRecords.mapValue.fields[date].mapValue.fields.note.stringValue).toBe('原有備註必須保留');
  await page.getByRole('button', { name: 'AI 評語', exact: true }).click();
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: '解鎖評語' }).click();
  await expect(page.getByPlaceholder('評語將顯示於此...')).toHaveValue('原有評語必須保留');
  await page.getByRole('button', { name: '立即生成期末評語' }).click();
  await expect(page.getByText(/生成 AI 評語失敗/)).toBeVisible();
  await expect(page.getByPlaceholder('評語將顯示於此...')).toHaveValue('原有評語必須保留');
  const after = await (await request.get(studentUrl, { headers: { Authorization: 'Bearer owner' } })).json();
  expect(after.fields.comment.stringValue).toBe('原有評語必須保留');
  expect(errors).toEqual([]);
  await page.screenshot({ path: `/tmp/classmate-integrity-${testInfo.project.name}.png` });
});
