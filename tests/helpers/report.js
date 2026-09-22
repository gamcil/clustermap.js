export async function waitForPaint(page) {
  // A zero-duration D3 transition still completes on a future animation frame.
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      )
  );
}

export async function captureCheckpoint(page, testInfo, name, readState) {
  await waitForPaint(page);
  const state = await readState();

  await testInfo.attach(`${name}.json`, {
    body: Buffer.from(JSON.stringify(state, null, 2)),
    contentType: "application/json",
  });
  await testInfo.attach(`${name}.png`, {
    body: await page.screenshot(),
    contentType: "image/png",
  });

  return state;
}
