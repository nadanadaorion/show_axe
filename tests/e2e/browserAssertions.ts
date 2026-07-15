import { expect, type Locator, type Page } from '@playwright/test'

export async function tapUnobstructedCenter(page: Page, locator: Locator) {
  const diagnostic = await locator.evaluate((target) => {
    const targetRect = target.getBoundingClientRect()
    const x = targetRect.x + targetRect.width / 2
    const y = targetRect.y + targetRect.height / 2
    const hit = document.elementFromPoint(x, y)
    const hitRect = hit?.getBoundingClientRect()
    return {
      receivesPointer: hit === target || Boolean(hit && target.contains(hit)),
      target: { x: targetRect.x, y: targetRect.y, width: targetRect.width, height: targetRect.height },
      hit: hit ? { tag: hit.tagName, text: hit.textContent?.trim().slice(0, 80), className: hit.getAttribute('class'), x: hitRect?.x, y: hitRect?.y, width: hitRect?.width, height: hitRect?.height } : null,
      viewport: { innerWidth, innerHeight, scrollX, scrollY, visualWidth: visualViewport?.width, visualHeight: visualViewport?.height, visualOffsetTop: visualViewport?.offsetTop },
    }
  })

  expect(diagnostic.receivesPointer, `The action center is obstructed: ${JSON.stringify(diagnostic)}`).toBe(true)
  await page.touchscreen.tap(
    diagnostic.target.x + diagnostic.target.width / 2,
    diagnostic.target.y + diagnostic.target.height / 2,
  )
}
