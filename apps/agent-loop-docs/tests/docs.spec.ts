import { expect, test, type Locator } from "@playwright/test";

const routes = [
  { path: "/", heading: "AI agent가 한 번에 답하지 않고 실행과 수정을 반복하는 이유", minimumSvgCount: 3 },
  { path: "/mdp/", heading: "MDP는 현재 작업 상태에서 다음 행동의 장기 결과를 비교하는 모형입니다", minimumSvgCount: 3 },
  { path: "/pomdp/", heading: "POMDP는 직접 볼 수 없는 결함 원인에 대한 확률을 테스트 결과로 갱신하는 모형입니다", minimumSvgCount: 3 },
  { path: "/ogis/", heading: "OGIS는 질의 형식과 검증 응답으로 patch 후보를 좁히는 귀납적 합성 방식입니다", minimumSvgCount: 3 },
  { path: "/cegis/", heading: "CEGIS는 실패한 입력을 다음 patch가 만족해야 할 제약으로 보존하는 합성 방식입니다", minimumSvgCount: 3 },
];

for (const route of routes) {
  test(`${route.path} 문서와 SVG가 렌더링된다`, async ({ page }) => {
    const errors: string[] = [];
    const consoleErrors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.goto(route.path);
    await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible();

    const visuals = page.locator(".lab-stage svg");
    expect(await visuals.count()).toBeGreaterThanOrEqual(route.minimumSvgCount);
    const visual = visuals.first();
    await expect(visual).toBeVisible();
    const box = await visual.boundingBox();
    expect(box?.width).toBeGreaterThan(600);
    expect(box?.height).toBeGreaterThan(100);

    const visualContract = await visuals.evaluateAll((svgs) =>
      svgs.map((svg) => {
        const referenceIds = [
          ...(svg.getAttribute("aria-labelledby")?.split(/\s+/) ?? []),
          ...(svg.getAttribute("aria-describedby")?.split(/\s+/) ?? []),
        ].filter(Boolean);
        return {
          hasTitle: Boolean(svg.querySelector("title")?.textContent?.trim()),
          hasDescription: Boolean(svg.querySelector("desc")?.textContent?.trim()),
          interactiveRole:
            svg.querySelector("[role='button']") === null
              ? null
              : svg.getAttribute("role"),
          missingReferences: referenceIds.filter((id) => !document.getElementById(id)),
        };
      }),
    );
    expect(visualContract.every((contract) => contract.hasTitle && contract.hasDescription)).toBe(true);
    expect(
      visualContract
        .filter((contract) => contract.interactiveRole !== null)
        .every((contract) => contract.interactiveRole === "group"),
    ).toBe(true);
    expect(visualContract.flatMap((contract) => contract.missingReferences)).toEqual([]);

    const duplicateIds = await page.locator("[id]").evaluateAll((elements) => {
      const seen = new Set<string>();
      const duplicates = new Set<string>();
      for (const element of elements) {
        if (seen.has(element.id)) duplicates.add(element.id);
        seen.add(element.id);
      }
      return [...duplicates];
    });
    expect(duplicateIds).toEqual([]);

    const interactiveSvgNodesWithoutState = await page
      .locator(".lab-stage svg [role='button']")
      .evaluateAll((nodes) =>
        nodes
          .filter((node) => node.getAttribute("aria-pressed") === null)
          .map((node) => node.getAttribute("aria-label") ?? node.tagName),
    );
    expect(interactiveSvgNodesWithoutState).toEqual([]);
    const liveRegionsPerLab = await page
      .locator(".lab")
      .evaluateAll((labs) => labs.map((lab) => lab.querySelectorAll("[aria-live], [role='status']").length));
    expect(liveRegionsPerLab.every((count) => count === 1)).toBe(true);
    expect(errors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test(`${route.path} 제목은 모바일에서 잘리거나 본문과 겹치지 않는다`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route.path);

    const layout = await page.locator(".doc-article").evaluate((article) => {
      const title = article.querySelector(".doc-hero h1") as HTMLElement;
      const lead = article.querySelector(".doc-hero > p") as HTMLElement;
      const textElements = Array.from(
        article.querySelectorAll<HTMLElement>(".doc-hero h1, .doc-section h2, .lab-title strong, .lab-title span"),
      );
      const titleRect = title.getBoundingClientRect();
      const leadRect = lead.getBoundingClientRect();

      return {
        overflowing: textElements
          .filter((element) => element.scrollWidth > element.clientWidth + 1)
          .map((element) => element.textContent),
        heroOverlap: titleRect.bottom > leadRect.top,
        articleWidth: article.scrollWidth,
      };
    });

    expect(layout.overflowing).toEqual([]);
    expect(layout.heroOverlap).toBe(false);
    expect(layout.articleWidth).toBeLessThanOrEqual(390);
  });
}

test("자기수정 deck은 논문에서 실무 loop까지 8개 인터랙티브 Scene을 렌더링한다", async ({ page }) => {
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/self-correction-scaling/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "LLM 자기수정을 위한 확률적 추론 스케일링 이론",
  );
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "A Probabilistic Inference Scaling Theory for LLM Self-Correction",
  );

  const deck = page.locator("[data-research-deck]");
  await expect(deck).toHaveAttribute("data-total-seconds", "1500");
  await expect(deck).toHaveAttribute("data-speech-seconds", "1200");
  await expect(deck).toHaveAttribute("data-visual-seconds", "300");
  await expect(page.locator(".site-header")).toHaveCount(0);
  const paletteContract = await deck.evaluate((root) => {
    const deckStyle = getComputedStyle(root);
    const canvas = root.querySelector(".lab-canvas") as HTMLElement;
    const scroll = root.querySelector(".viz-scroll") as HTMLElement;
    return {
      background: deckStyle.getPropertyValue("--deck-bg").trim(),
      surface: deckStyle.getPropertyValue("--deck-surface").trim(),
      correct: deckStyle.getPropertyValue("--viz-correct").trim(),
      incorrect: deckStyle.getPropertyValue("--viz-incorrect").trim(),
      canvasBackground: getComputedStyle(canvas).backgroundImage,
      svgBackground: getComputedStyle(scroll).backgroundColor,
    };
  });
  expect(paletteContract).toMatchObject({
    background: "#0d0d0d",
    surface: "#111116",
    correct: "#6ba368",
    incorrect: "#f55",
  });
  expect(paletteContract.canvasBackground).toContain("linear-gradient");
  expect(paletteContract.svgBackground).not.toBe("rgba(0, 0, 0, 0)");

  const scenes = deck.locator("[data-scene-id]");
  await expect(scenes).toHaveCount(8);
  await expect(deck.locator(".lab")).toHaveCount(8);
  await expect(deck.locator("[data-visual-fallback]")).toHaveCount(8);
  await expect(deck.locator("[data-presenter-note]")).toHaveCount(150);

  const timingContract = await scenes.evaluateAll((items) => ({
    sentences: items.reduce(
      (sum, item) => sum + Number((item as HTMLElement).dataset.sentenceBudget),
      0,
    ),
    speech: items.reduce(
      (sum, item) => sum + Number((item as HTMLElement).dataset.speechSeconds),
      0,
    ),
    visual: items.reduce(
      (sum, item) => sum + Number((item as HTMLElement).dataset.visualSeconds),
      0,
    ),
    total: items.reduce(
      (sum, item) => sum + Number((item as HTMLElement).dataset.totalSeconds),
      0,
    ),
    sceneNotes: items.map((item) => item.querySelectorAll("[data-presenter-note]").length),
    proseHasVisual: items.map(
      (item) =>
        item.querySelector("[data-scene-prose] > p") !== null &&
        item.querySelector("[data-scene-visual] svg") !== null,
    ),
  }));
  expect(timingContract).toEqual({
    sentences: 150,
    speech: 1200,
    visual: 300,
    total: 1500,
    sceneNotes: [8, 21, 19, 25, 10, 22, 30, 15],
    proseHasVisual: [true, true, true, true, true, true, true, true],
  });

  const visualContract = await deck
    .locator(".lab-stage svg[role='group']")
    .evaluateAll((svgs) =>
    svgs.map((svg) => ({
      hasTitle: Boolean(svg.querySelector("title")?.textContent?.trim()),
      hasDescription: Boolean(svg.querySelector("desc")?.textContent?.trim()),
      missingReferences: [
        ...(svg.getAttribute("aria-labelledby")?.split(/\s+/) ?? []),
        ...(svg.getAttribute("aria-describedby")?.split(/\s+/) ?? []),
      ]
        .filter(Boolean)
        .filter((id) => !document.getElementById(id)),
    })),
  );
  expect(visualContract.length).toBeGreaterThanOrEqual(8);
  expect(
    visualContract.every(
      (contract) =>
        contract.hasTitle &&
        contract.hasDescription &&
        contract.missingReferences.length === 0,
    ),
  ).toBe(true);

  const liveRegionsPerLab = await deck
    .locator(".lab")
    .evaluateAll((labs) =>
      labs.map((lab) => lab.querySelectorAll("[aria-live], [role='status']").length),
    );
  expect(liveRegionsPerLab.every((count) => count === 1)).toBe(true);

  const renderedText = await deck.innerText();
  expect(renderedText).toContain("Acc_t");
  expect(renderedText).toContain("CL_t");
  expect(renderedText).toContain("CS_t");
  expect(renderedText).toContain("Upp");
  expect(renderedText).toContain("α");
  expect(renderedText).not.toMatch(/(^|[\s([{:])A_(?:t|0)(?=$|[\s)\]},.:])/m);
  expect(renderedText).not.toMatch(/(^|[\s([{:])U(?=$|[\s)\]},.:])/m);
  expect(renderedText).not.toMatch(/\balpha\b/i);
  expect(renderedText).not.toMatch(
    /(^|[\s([{:])(R|I_t|C_t|L_t|M_t|O_t|V_t)(?=$|[\s)\]},.:])/m,
  );
  await expect(deck.locator(".scene-formula .katex")).toHaveCount(9);
  const svgText = (await deck.locator("svg").allTextContents()).join(" ");
  expect(svgText).toContain("Accₜ");
  expect(svgText).toContain("CLₜ");
  expect(svgText).toContain("CSₜ");
  expect(svgText).not.toMatch(/Acc_|CL_|CS_/);

  expect(errors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("첫 장면 네온 드럼은 회전으로 iteration을 진행하고 페이더가 조건을 바꾼다", async ({
  page,
}) => {
  await page.goto("/self-correction-scaling/");
  const scene = page.locator("[data-scene-id='scene-01']");
  const drum = scene.locator("[data-iteration-drum]");
  const lab = scene.locator(".lab");
  const svg = lab.locator(".lab-stage svg[role='group']");

  await expect(svg).toBeVisible();
  await expect(svg.locator("filter feGaussianBlur")).toHaveCount(3);
  await expect(
    svg.locator("[data-bar-state='future']").first(),
  ).toBeVisible();
  await expect(svg.locator("[data-bar-state='front']")).toHaveCount(1);

  await lab.scrollIntoViewIfNeeded();
  await expect(drum).toHaveAttribute("data-spinning", "true");
  const startIteration = Number(
    await drum.getAttribute("data-front-iteration"),
  );
  await expect
    .poll(
      async () => Number(await drum.getAttribute("data-front-iteration")),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(startIteration);

  const fader = lab.getByRole("slider", { name: "복구 비율 CSₜ" });
  await fader.press("Home");
  await expect(drum).toHaveAttribute("data-condition", "훼손");
  await expect(lab.locator(".lab-statusbar")).toContainText("훼손");
  await fader.press("End");
  await expect(drum).toHaveAttribute("data-condition", "개선");
  await expect(lab.locator(".lab-statusbar")).toContainText("개선");

  const fallback = lab.locator("[data-visual-fallback]");
  await expect(fallback.locator("[data-drum-table] caption")).toContainText(
    "조건",
  );
  await expect(
    fallback.locator("[data-drum-table] tbody tr").first(),
  ).toBeVisible();
});

test("전이 lab은 100개 점을 네 셀로 회계하고 population을 바꿔도 확률을 유지한다", async ({
  page,
}) => {
  await page.goto("/self-correction-scaling/");
  const lab = page.locator("[data-scene-id='scene-02'] .lab");
  const fallback = lab.locator("[data-visual-fallback]");

  await expect(lab.locator(".lab-stage svg circle")).toHaveCount(100);

  const rows = fallback.locator("tbody tr");
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText("63");
  await expect(rows.nth(2)).toContainText("12");

  await lab.getByRole("button", { name: "1,000" }).click();
  await expect(fallback.locator("caption")).toContainText("1000개");
  await expect(rows.nth(0)).toContainText("630");
  await expect(rows.nth(0)).toContainText("63.00%");

  const accuracy = lab.getByLabel("Accₜ · 현재 정확도");
  await accuracy.press("Home");
  await expect(accuracy).toHaveValue("0");
  await expect(lab.locator(".lab-statusbar")).toContainText("40.00%");
  await expect(fallback.locator("[data-committed-summary]")).toContainText(
    "40.00%",
  );
});

test("손익 lab은 99% preset에서 손익분기 CLₜ를 계산하고 훼손 preset은 HARMFUL로 판정한다", async ({
  page,
}) => {
  await page.goto("/self-correction-scaling/");
  const lab = page.locator("[data-scene-id='scene-03'] .lab");
  const fallback = lab.locator("[data-visual-fallback]");

  await lab.getByRole("button", { name: "99% 정확도" }).click();
  await expect(lab.getByLabel("Accₜ · 현재 정확도")).toHaveValue("0.99");
  await lab.getByRole("button", { name: "손익분기 CLₜ 계산" }).click();
  await expect(fallback.locator("[data-break-even-output]")).toContainText(
    "99.49",
  );
  await expect(fallback).toContainText("0.994949");
  await expect(lab.locator(".lab-statusbar")).toContainText("BREAK-EVEN");

  await lab.getByRole("button", { name: "복구보다 훼손이 큰 사례" }).click();
  await expect(fallback).toContainText("HARMFUL");
  await expect(lab.locator(".lab-statusbar")).toContainText("HARMFUL");
});

test("궤적 explorer는 세 view를 전환하며 6라운드 × 3곡선 표를 제공한다", async ({
  page,
}) => {
  await page.goto("/self-correction-scaling/");
  const lab = page.locator("[data-scene-id='scene-04'] .lab");
  const fallback = lab.locator("[data-visual-fallback]");

  await expect(
    fallback.locator("[data-trajectory-table] tbody tr"),
  ).toHaveCount(6);
  await expect(fallback.locator("[data-trajectory-table] caption")).toContainText(
    "Upp",
  );

  await lab.getByRole("button", { name: "claim-boundary" }).click();
  await expect(lab.locator(".lab-stage svg")).toContainText("아직 미검증");

  await lab.getByRole("button", { name: "experiment" }).click();
  await expect(lab.locator(".lab-stage svg")).toContainText("2~5라운드");
  await expect(fallback.locator("[data-experiment-table]")).toContainText(
    "64개 조합 전체는 아님",
  );
});

test("loop map은 lens 전환과 상태 객체 선택으로 owner·rollback 속성을 보여 준다", async ({
  page,
}) => {
  await page.goto("/self-correction-scaling/");
  const lab = page.locator("[data-scene-id='scene-06'] .lab");
  const fallback = lab.locator("[data-visual-fallback]");

  await expect(
    page.locator("[data-official-example-strip] dl > div"),
  ).toHaveCount(10);
  await expect(fallback.locator("ol li")).toHaveCount(7);

  await lab.getByRole("button", { name: "memory" }).click();
  await expect(
    page.locator("[data-scene-id='scene-06'] [data-loop-map]"),
  ).toHaveAttribute("data-lens", "memory");

  await lab.getByRole("button", { name: "Experiment ledger 속성 보기" }).click();
  await expect(fallback.locator("[data-object-detail]")).toContainText(
    "append-only",
  );
});

test("control workbench는 replay ledger·전이 비교·stop reason을 한 reducer에서 파생한다", async ({
  page,
}) => {
  await page.goto("/self-correction-scaling/");
  const lab = page.locator("[data-scene-id='scene-07'] .lab");
  const fallback = lab.locator("[data-visual-fallback]");

  await lab.getByRole("tab", { name: "replay" }).click();
  const rows = fallback.locator("[data-ledger-table] tbody tr");
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(3)).toContainText("측정 없음");
  await expect(rows.nth(3)).toContainText("b2c3d4e");
  const tableText =
    (await fallback.locator("[data-ledger-table]").textContent()) ?? "";
  expect(tableText).not.toContain("0.000000");
  await expect(fallback.locator("[data-raw-drawer] pre")).toContainText(
    "0.000000",
  );

  await lab.getByRole("tab", { name: "diagnose" }).click();
  await expect(fallback.locator("[data-transition-compare]")).toContainText(
    "incumbent 보호됨",
  );
  await lab.getByRole("button", { name: "연속형 scalar" }).click();
  await expect(fallback.locator("[data-scalar-disabled]")).toContainText(
    "CLₜ/CSₜ 표를 비활성화",
  );

  await lab.getByRole("tab", { name: "stop" }).click();
  await expect(lab.locator(".lab-statusbar")).toContainText("계속 실행");
  const plateau = lab.getByRole("slider", { name: /plateau/ });
  await plateau.press("End");
  await expect(lab.locator(".lab-statusbar")).toContainText("PLATEAU");
  await expect(fallback.locator("[data-stop-summary]")).toContainText(
    "PLATEAU",
  );
  await lab.getByRole("button", { name: "safety violation" }).click();
  await expect(lab.locator(".lab-statusbar")).toContainText(
    "SAFETY_VIOLATION",
  );
});

test("policy card는 blank와 synthetic 탭을 전환하고 YAML 복사 토스트를 띄운다", async ({
  page,
}) => {
  await page.goto("/self-correction-scaling/");
  const lab = page.locator("[data-scene-id='scene-08'] .lab");
  const fallback = lab.locator("[data-visual-fallback]");

  await lab.getByRole("tab", { name: "synthetic 예시" }).click();
  await expect(fallback.locator("[data-policy-yaml]")).toContainText(
    "checkout_success_rate",
  );
  await expect(fallback.locator("[data-final-takeaways] li")).toHaveCount(3);

  await lab.getByRole("tab", { name: "blank" }).click();
  await expect(fallback.locator("[data-policy-yaml]")).toContainText(
    "success_predicate:",
  );

  await lab.getByRole("button", { name: "YAML 복사" }).click();
  await expect(lab.locator("[data-copy-toast]")).toContainText("복사됨");
});

test("자기수정 deck은 390px viewport에서 가로로 새지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/self-correction-scaling/");

  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
  await expect(
    page.locator("[data-scene-id='scene-01'] .lab-stage svg[role='group']"),
  ).toBeVisible();

  const controlHeights = await page
    .locator("[data-research-deck] .lab button:visible")
    .evaluateAll((buttons) =>
      buttons.map((button) => button.getBoundingClientRect().height),
    );
  expect(Math.min(...controlHeights)).toBeGreaterThanOrEqual(44);

  const hotspotSizes = await page
    .locator("[data-research-deck] .lab-stage svg [role='button']")
    .evaluateAll((hotspots) =>
      hotspots.map((hotspot) => {
        const box = hotspot.getBoundingClientRect();
        return { width: box.width, height: box.height };
      }),
    );
  expect(hotspotSizes.length).toBeGreaterThan(0);
  expect(
    hotspotSizes.every((size) => size.width >= 44 && size.height >= 44),
  ).toBe(true);
});

test("자기수정 시각화는 viewport 진입 뒤 재생하고 모션 축소에서는 수동 단계만 남긴다", async ({ page }) => {
  await page.goto("/self-correction-scaling/");

  const policyScene = page.locator("[data-scene-id='scene-08']");
  const policy = policyScene.locator(".lab");
  const policyRoot = policyScene.locator("[data-policy-card]");
  await expect(policy).toContainText("BLANK CONTRACT");
  await expect(policy).toContainText("대기 중");
  await page.waitForTimeout(1_500);
  await expect(policy).toContainText("대기 중");
  await policy.scrollIntoViewIfNeeded();
  await expect(policy).not.toContainText("대기 중", { timeout: 5_000 });
  await expect(policyRoot).toHaveAttribute("data-tab", "synthetic", {
    timeout: 32_000,
  });
  await expect(policy).toContainText("SYNTHETIC CHECKOUT POLICY");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  const drumLab = page.locator("[data-scene-id='scene-01'] .lab");
  const drum = page.locator("[data-scene-id='scene-01'] [data-iteration-drum]");
  await drumLab.scrollIntoViewIfNeeded();
  await expect(drum).toHaveAttribute("data-spinning", "false");
  await expect(drumLab).toContainText("모션 감소 설정으로 회전을 정지했습니다");
  const staticFader = drumLab.getByRole("slider", { name: "복구 비율 CSₜ" });
  await staticFader.press("Home");
  await expect(drum).toHaveAttribute("data-condition", "훼손");

  const bridge = page.locator("[data-scene-id='scene-05'] .lab");
  await bridge.scrollIntoViewIfNeeded();
  await expect(
    bridge.getByRole("button", { name: "재생", exact: true }),
  ).toBeDisabled();
  await expect(bridge.getByRole("button", { name: "이전 단계" })).toBeEnabled();
  await expect(
    page.locator("[data-scene-id='scene-05'] [data-theory-bridge]"),
  ).toHaveAttribute("data-stage", "warning");
});

test("자기수정 발표 모드는 발표자 노트를 새 창에 열고 읽기 복귀 시 닫는다", async ({
  page,
}) => {
  await page.goto("/self-correction-scaling/");
  const deck = page.locator("[data-research-deck]");

  const [presenterWindow] = await Promise.all([
    page.waitForEvent("popup"),
    deck.getByRole("button", { name: "발표", exact: true }).click(),
  ]);
  await expect(deck).toHaveAttribute("data-mode", "presentation");
  const consolePanel = presenterWindow.getByRole("complementary", {
    name: "발표자 console",
  });
  await expect(consolePanel).toBeVisible();
  await expect(consolePanel).toContainText("S01.01");
  await expect(
    presenterWindow.locator("[data-popup-presenter-note]"),
  ).toHaveCount(8);
  await deck.getByRole("button", { name: /2번 Scene/ }).click();
  await expect(
    presenterWindow.locator("[data-popup-presenter-note]"),
  ).toHaveCount(21);
  await expect(consolePanel).toContainText("S02.01");

  // 대본이 긴 Scene에서도 하단 액션 버튼은 스크롤 없이 항상 보인다.
  await expect(
    consolePanel.getByRole("button", { name: "문장 완료" }),
  ).toBeInViewport();
  const notesScrollable = await consolePanel
    .locator("section ol")
    .evaluate((list) => list.scrollHeight > list.clientHeight);
  expect(notesScrollable).toBe(true);

  // console의 Scene 이동 버튼으로 이전/다음 Scene을 오간다.
  await expect(
    consolePanel.getByRole("button", { name: "이전 Scene으로 이동" }),
  ).toBeEnabled();
  await consolePanel
    .getByRole("button", { name: "이전 Scene으로 이동" })
    .click();
  await expect(
    presenterWindow.locator("[data-popup-presenter-note]"),
  ).toHaveCount(8);
  await expect(consolePanel).toContainText("S01.01");
  await expect(
    consolePanel.getByRole("button", { name: "이전 Scene으로 이동" }),
  ).toBeDisabled();
  await consolePanel
    .getByRole("button", { name: "다음 Scene으로 이동" })
    .click();
  await expect(
    presenterWindow.locator("[data-popup-presenter-note]"),
  ).toHaveCount(21);
  await expect(consolePanel).toContainText("S02.01");

  await deck.getByRole("button", { name: "발표 타이머 시작" }).click();
  const elapsed = deck
    .getByText("elapsed", { exact: true })
    .locator("..")
    .locator("time");
  await expect(elapsed).not.toHaveText("00:00", { timeout: 3_000 });
  await deck.getByRole("button", { name: "발표 타이머 일시정지" }).click();

  await consolePanel.getByRole("button", { name: "문장 완료" }).click();
  const overallMean = consolePanel
    .getByText("전체 평균", { exact: true })
    .locator("..")
    .locator("dd");
  await expect(overallMean).not.toHaveText("—");

  await deck.getByRole("button", { name: "발표 상태 초기화" }).click();
  await expect(elapsed).toHaveText("00:00");

  await deck.getByRole("button", { name: "읽기", exact: true }).click();
  await expect(deck).toHaveAttribute("data-mode", "reading");
  await expect
    .poll(() => presenterWindow.isClosed(), { timeout: 3_000 })
    .toBe(true);
});

test("발표 모드 제목은 sticky 상단바 아래의 안전 영역에 놓인다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/self-correction-scaling/");
  const deck = page.locator("[data-research-deck]");
  const [presenterWindow] = await Promise.all([
    page.waitForEvent("popup"),
    deck.getByRole("button", { name: "발표", exact: true }).click(),
  ]);

  await deck
    .getByRole("button", { name: /2번 Scene/ })
    .click();
  const topBar = deck.locator(":scope > header");
  const title = deck.locator("[data-scene-id='scene-02'] h2");
  await expect(title).toBeInViewport();
  const safeOffset = await Promise.all([
    topBar.boundingBox(),
    title.boundingBox(),
  ]);
  expect(safeOffset[0]).not.toBeNull();
  expect(safeOffset[1]).not.toBeNull();
  expect(safeOffset[1]!.y).toBeGreaterThanOrEqual(
    safeOffset[0]!.y + safeOffset[0]!.height + 8,
  );

  await deck.getByRole("button", { name: "읽기", exact: true }).click();
  await expect.poll(() => presenterWindow.isClosed()).toBe(true);
});

test("MDP는 Bellman backup으로 value와 iteration을 갱신한다", async ({ page }) => {
  await page.goto("/mdp/");

  const iteration = page.locator(".lab-statusbar > div").filter({ hasText: "Iteration" }).locator("strong");
  const startNode = page.getByRole("button", { name: /실패 재현 상태, 가치/ });
  await expect(iteration).toHaveText("0");
  await expect(startNode).toHaveAttribute("aria-label", /가치 0\.00/);
  await expect(page.locator(".lab").filter({ hasText: "계약 확인과 즉시 수정의 장기 가치 비교" }).locator(".lab-stage svg")).toContainText("remain p=.2/.6");

  await page.getByRole("button", { name: "Bellman 1회" }).click();
  await expect(iteration).toHaveText("1");
  await expect(startNode).toHaveAttribute("aria-label", /가치 -0\.45/);
});

test("POMDP는 observation에 따라 posterior를 달리 계산한다", async ({ page }) => {
  await page.goto("/pomdp/");

  const beliefLab = page.locator(".lab").filter({ hasText: "테스트 결과에 따른 결함 가설 갱신" });
  const posterior = beliefLab.locator(".lab-statusbar > div").filter({ hasText: "Posterior · validation" }).locator("strong");
  const failurePosterior = await posterior.textContent();

  await beliefLab.getByRole("button", { name: "Pass" }).click();
  await expect(posterior).not.toHaveText(failurePosterior ?? "");
  const passPosterior = await posterior.textContent();

  expect(Number.parseFloat(passPosterior ?? "0")).toBeLessThan(Number.parseFloat(failurePosterior ?? "0"));
  await beliefLab.getByRole("button", { name: "Posterior 보존" }).click();
  await expect(beliefLab.locator(".lab-explanation")).toContainText("현재 step 1");
});

test("OGIS equivalence query는 반례를 누적해 target에 수렴한다", async ({ page }) => {
  await page.goto("/ogis/");

  const oracleLab = page.locator(".lab").filter({ hasText: "할인 validation 후보를 줄이는 oracle 질의" });
  const query = oracleLab.getByRole("button", { name: "Oracle 질의" });
  for (let count = 0; count < 5; count += 1) {
    await query.click();
  }

  await expect(oracleLab.locator(".lab-explanation")).toContainText("equivalent: h6 accepted");
  await expect(oracleLab.locator(".lab-statusbar > div").filter({ hasText: "Version space" }).locator("strong")).toHaveText("1 / 8");
  await expect(query).toBeDisabled();

  await oracleLab.getByRole("button", { name: "Membership", exact: true }).click();
  await expect(query).toBeEnabled();
  await expect(oracleLab.locator(".lab-explanation")).toContainText("input을 선택한 뒤");
});

test("CEGIS 자동 실행은 반례 두 개 뒤 validation 후보를 검증한다", async ({ page }) => {
  await page.goto("/cegis/");
  const loopLab = page.locator(".lab").first();
  await loopLab.getByRole("button", { name: "자동 실행" }).click();

  await expect(loopLab.locator(".lab-explanation")).toContainText("finite domain -2..5에서 p3 검증", { timeout: 8_000 });
  await expect(loopLab.locator(".lab-statusbar > div").filter({ hasText: "Counterexamples" }).locator("strong")).toHaveText("2");
  await expect(loopLab.locator(".lab-statusbar > div").filter({ hasText: "Iterations" }).locator("strong")).toHaveText("3");
});

test("MDP 설명 SVG는 transition과 정보 손실 state를 전환한다", async ({ page }) => {
  await page.goto("/mdp/");
  const explorer = page.locator(".lab").first();

  await explorer.getByRole("button", { name: "한 단계 전이" }).click();
  await explorer.locator(".segment-button").filter({ hasText: /^바로 clamp$/ }).click();
  await expect(explorer.locator(".lab-stage svg")).toContainText("계약 위반");

  await explorer.getByRole("button", { name: "Markov 조건" }).click();
  await explorer.getByRole("button", { name: "boolean만 보존" }).click();
  await expect(explorer.locator(".lab-stage svg")).toContainText("실패 입력 정보가 사라짐");
  await expect(explorer.locator(".lab-statusbar")).toContainText("state 보강이 필요함");
});

test("POMDP 설명 SVG는 belief update와 planning을 구분한다", async ({ page }) => {
  await page.goto("/pomdp/");
  const explorer = page.locator(".lab").first();

  await explorer.getByRole("button", { name: "Planning 경계" }).click();
  await explorer.getByRole("button", { name: "후속 행동 rollout" }).click();
  await expect(explorer.locator(".lab-stage svg")).toContainText("BACKUP");
  await expect(explorer.locator(".lab-statusbar")).toContainText("분기와 value backup 포함");
});

test("OGIS 설명 SVG는 query schema에 따라 response 정보를 바꾼다", async ({ page }) => {
  await page.goto("/ogis/");
  const explorer = page.locator(".lab").first();

  await explorer.getByRole("button", { name: "Correctness" }).click();
  await explorer.getByRole("button", { name: "Evidence 갱신" }).click();
  await expect(explorer.locator(".viz-svg")).toContainText("correct: false");
  await expect(explorer.locator(".lab-statusbar")).toContainText("판정만 제공, 수정 방향은 적음");
});

test("CEGIS 설명 SVG는 반례를 버릴 때 이전 실패가 돌아옴을 보인다", async ({ page }) => {
  await page.goto("/cegis/");
  const explorer = page.locator(".lab").filter({ hasText: "반례 보존 여부에 따른 candidate set 변화" });

  await expect(explorer.locator(".lab-statusbar")).toContainText("Cₜ₊₁ ⊆ Cₜ 유지");
  await explorer.getByRole("button", { name: "최신 반례만" }).click();
  await explorer.locator(".segment-button").filter({ hasText: /^4$/ }).click();
  await expect(explorer.locator(".viz-svg")).toContainText("p₂ · d ≤ subtotal");
  await expect(explorer.locator(".lab-statusbar")).toContainText("이전 실패가 다시 가능");
});

test("OGIS와 CEGIS의 비교 정보는 실제 table 구조로 렌더링된다", async ({ page }) => {
  await page.goto("/ogis/");
  const ogisTable = page.getByRole("table");
  await expect(ogisTable.getByRole("columnheader")).toHaveCount(3);
  await expect(ogisTable.getByRole("row")).toHaveCount(5);

  await page.goto("/cegis/");
  const cegisTable = page.getByRole("table").nth(1);
  await expect(cegisTable.getByRole("columnheader")).toHaveCount(2);
  await expect(cegisTable.getByRole("row")).toHaveCount(6);
});

test("코드 블록은 언어별 token과 현재 theme에 맞춰 강조된다", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("agent-loop-theme", "light");
  });
  await page.goto("/mdp/");

  const codeBlock = page.locator(".doc-section pre.shiki").first();
  await expect(codeBlock).toBeVisible();
  await expect(codeBlock.locator("code")).toHaveClass(/language-ts/);
  expect(await codeBlock.locator("span[style*='--shiki-light']").count()).toBeGreaterThan(5);

  const token = codeBlock.locator("span[style*='--shiki-light']").first();
  const lightColor = await token.evaluate((element) => getComputedStyle(element).color);
  const inlineCode = page.locator(".doc-section p code").first();
  await expect(inlineCode).not.toHaveClass(/shiki/);

  await page.getByRole("button", { name: "색상 테마 전환" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const darkColor = await token.evaluate((element) => getComputedStyle(element).color);

  expect(darkColor).not.toBe(lightColor);
});

test("전체 지도는 두 독립 track을 발전 단계가 아닌 framework lens로 묶는다", async ({ page }) => {
  await page.goto("/");

  const compass = page.locator(".lab").filter({ hasText: "구현 신호로 고르는 agent-loop framework compass" });
  await expect(compass.locator(".stage-label")).toContainText("Two independent tracks · not a progression");
  await expect(compass.locator(".viz-svg")).toContainText("DECISION TRACK");
  await expect(compass.locator(".viz-svg")).toContainText("SYNTHESIS TRACK");
  await expect(compass.locator(".lab-statusbar")).toContainText("독립 track · 단계 아님");
});

test("홈 incident replay와 framework compass는 evidence에 따라 결론을 바꾼다", async ({ page }) => {
  await page.goto("/");

  const replay = page.locator(".lab").filter({ hasText: "실행 evidence가 다음 patch를 바꾸는 incident replay" });
  await replay.getByRole("button", { name: "02", exact: true }).click();
  await expect(replay.locator(".lab-statusbar")).toContainText("4개 · context에 누적");
  await expect(replay.locator(".lab-explanation")).toContainText("다음 patch가 바뀝니다");

  const compass = page.locator(".lab").filter({ hasText: "구현 신호로 고르는 agent-loop framework compass" });
  await compass.getByRole("button", { name: "충분히 관측", exact: true }).click();
  await compass.getByRole("button", { name: "판정만", exact: true }).click();
  await expect(compass.locator(".lab-statusbar")).toContainText("MDP");
  await expect(compass.locator(".lab-statusbar")).toContainText("OGIS");
  await expect(compass.locator(".lab-statusbar")).toContainText("독립 track · 단계 아님");
});

test("MDP 관측성 aperture는 hidden-state 경계를 바꾼다", async ({ page }) => {
  await page.goto("/mdp/");
  const lab = page.locator(".lab").filter({ hasText: "Code agent의 MDP 관측 가능성 경계" });

  await expect(lab.locator(".lab-statusbar")).toContainText("POMDP · belief over hidden state");
  await lab.getByRole("button", { name: "전체 state · 가정" }).click();
  await expect(lab.locator(".lab-statusbar")).toContainText("Fully observable MDP");
});

test("POMDP 정보 가치는 진단 분리도가 0이면 action flip과 EVSI가 사라진다", async ({ page }) => {
  await page.goto("/pomdp/");
  const lab = page.locator(".lab").filter({ hasText: "테스트가 최적 patch를 바꾸는 정보 가치" });

  await lab.getByLabel("진단 분리도 d").fill("0");
  await expect(lab.locator(".lab-statusbar")).toContainText("0 / 2 observation branches");
  await expect(lab.locator(".lab-statusbar")).toContainText("EVSI / Net VOI");
  await expect(lab.locator(".lab-statusbar")).toContainText("+0.00 / -1.00");
  await expect(lab.locator(".lab-statusbar")).not.toContainText("V_info");
});

test("POMDP branch flow는 고정 화살촉의 좌변 중앙에서 끝나고 카드 경계에 닿는다", async ({ page }) => {
  await page.goto("/pomdp/");
  const lab = page.locator(".lab").filter({ hasText: "테스트가 최적 patch를 바꾸는 정보 가치" });

  const geometry = await lab.locator(".lab-stage svg").evaluate((svg) => {
    const markers = [...svg.querySelectorAll<SVGMarkerElement>("marker[data-branch-arrowhead]")];
    const flows = [...svg.querySelectorAll<SVGPathElement>("path[data-branch-flow]")];

    return {
      markers: markers.map((marker) => ({
        refX: marker.getAttribute("refX"),
        refY: marker.getAttribute("refY"),
        width: marker.getAttribute("markerWidth"),
        units: marker.getAttribute("markerUnits"),
      })),
      flowEnds: flows.map((flow) => {
        const point = flow.getPointAtLength(flow.getTotalLength());
        return { x: point.x, y: point.y, strokeWidth: getComputedStyle(flow).strokeWidth };
      }),
    };
  });

  expect(geometry.markers).toEqual([
    { refX: "0", refY: "5", width: "10", units: "userSpaceOnUse" },
    { refX: "0", refY: "5", width: "10", units: "userSpaceOnUse" },
  ]);
  expect(geometry.flowEnds).toEqual([
    { x: 570, y: 141, strokeWidth: "1.5px" },
    { x: 570, y: 324, strokeWidth: "1.5px" },
  ]);
});

test("OGIS domain point는 현재 query를 몰래 membership으로 바꾸지 않는다", async ({ page }) => {
  await page.goto("/ogis/");
  const lab = page.locator(".lab").filter({ hasText: "할인 validation 후보를 줄이는 oracle 질의" });
  const queryCount = lab.locator(".lab-statusbar > div").filter({ hasText: "Queries" }).locator("strong");

  await expect(lab.getByRole("button", { name: "Equivalence" })).toHaveAttribute("aria-pressed", "true");
  await lab.getByRole("button", { name: /x=2.*Membership input으로 선택/ }).press("Enter");
  await expect(queryCount).toHaveText("0");
  await expect(lab.locator(".lab-explanation")).toContainText("oracle response가 아직 없습니다");

  await lab.getByRole("button", { name: "Membership", exact: true }).click();
  await lab.getByRole("button", { name: "Oracle 질의" }).click();
  await expect(queryCount).toHaveText("1");
  await expect(lab.locator(".lab-explanation")).toContainText("membership(2) = true");
});

test("초기화는 복합 control state 전체를 기본값으로 복구한다", async ({ page }) => {
  await page.goto("/ogis/");
  const protocol = page.locator(".lab").filter({ hasText: "Query와 response type으로 구성한 OGIS protocol" });
  await protocol.getByRole("button", { name: "Membership" }).click();
  await protocol.getByRole("button", { name: "다음 protocol 단계" }).click();
  await protocol.getByRole("button", { name: "초기화" }).click();
  await expect(protocol.getByRole("button", { name: "Equivalence" })).toHaveAttribute("aria-pressed", "true");
  await expect(protocol.getByRole("button", { name: "후보 선택" })).toHaveAttribute("aria-pressed", "true");

  await page.goto("/cegis/");
  const retention = page.locator(".lab").filter({ hasText: "반례 보존 여부에 따른 candidate set 변화" });
  await retention.getByRole("button", { name: "최신 반례만" }).click();
  await retention.locator(".segment-button").filter({ hasText: /^4$/ }).click();
  await retention.getByRole("button", { name: "초기화" }).click();
  await expect(retention.getByRole("button", { name: "모두 보존" })).toHaveAttribute("aria-pressed", "true");
  await expect(retention.locator(".segment-button").filter({ hasText: /^0$/ })).toHaveAttribute("aria-pressed", "true");
});

test("15개 lab의 초기화는 초기 UI state를 완전히 복구한다", async ({ page }) => {
  const readState = async (lab: Locator) =>
    lab.evaluate((element) =>
      JSON.stringify({
        status: element.querySelector(".lab-statusbar")?.textContent?.replace(/\s+/g, " ").trim(),
        explanation: element.querySelector(".lab-explanation")?.textContent?.replace(/\s+/g, " ").trim(),
        pressed: [...element.querySelectorAll("[aria-pressed]")].map((control) => ({
          name: control.getAttribute("aria-label") ?? control.textContent?.replace(/\s+/g, " ").trim(),
          value: control.getAttribute("aria-pressed"),
        })),
        ranges: [...element.querySelectorAll<HTMLInputElement>("input[type='range']")].map((input) => input.value),
      }),
    );

  for (const route of routes) {
    await page.goto(route.path);
    const labs = page.locator(".lab");

    for (let index = 0; index < (await labs.count()); index += 1) {
      const lab = labs.nth(index);
      const initial = await readState(lab);
      const alternate = lab.locator("button[aria-pressed='false']:enabled").first();

      if (await alternate.count()) {
        await alternate.click();
      } else {
        await lab.locator("button.lab-button:enabled").first().click();
      }

      await expect.poll(() => readState(lab)).not.toBe(initial);
      await lab.getByRole("button", { name: "초기화" }).click();
      await expect.poll(() => readState(lab)).toBe(initial);
    }
  }
});

test("OGIS 적용 lens는 typed protocol 누락을 black-box refinement로 분류한다", async ({ page }) => {
  await page.goto("/ogis/");
  const lab = page.locator(".lab").filter({ hasText: "OGIS 적용 여부를 가르는 세 가지 interface 조건" });
  const typedControl = lab.locator(".control-group").filter({ hasText: "Typed query-response" });

  await typedControl.getByRole("button", { name: "없음" }).click();
  await expect(lab.locator(".lab-statusbar")).toContainText("Black-box refinement");
  await expect(lab.locator(".lab-statusbar")).toContainText("2 / 3 충족");

  const candidateControl = lab.locator(".control-group").filter({ hasText: "Candidate 식별" });
  await candidateControl.getByRole("button", { name: "없음" }).click();
  await expect(lab.locator(".lab-statusbar")).toContainText("OGIS 조건 미충족 · 분류 보류");
  await expect(lab.locator(".lab-explanation")).toContainText("POMDP는 hidden state와 action-dependent observation이라는 별도 신호");
});

test("CEGIS workbench는 verifier와 memory 전제를 보장별로 분리한다", async ({ page }) => {
  await page.goto("/cegis/");
  const lab = page.locator(".lab").filter({ hasText: "CEGIS 보장을 성립시키는 전제 분해" });
  const completeControl = lab.locator(".control-group").filter({ hasText: "Verifier complete" });
  const memoryControl = lab.locator(".control-group").filter({ hasText: "Counterexample memory" });

  await completeControl.getByRole("button", { name: "예" }).click();
  await expect(lab.locator(".lab-statusbar")).toContainText("ACCEPT + verifier 가정에 한함");
  await memoryControl.getByRole("button", { name: "덮어쓰기" }).click();
  await expect(lab.locator(".lab-statusbar")).toContainText("단조성 깨짐");
  await expect(lab.locator(".lab-explanation")).toContainText("Finite test suite의 accept는 universal proof가 아닙니다");
});

test("lab controls와 SVG hotspot은 44px 터치 높이와 모바일 scroll guide를 제공한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of routes) {
    await page.goto(route.path);

    if (route.path === "/mdp/") {
      await page.locator(".lab").first().getByRole("button", { name: "Markov 조건" }).click();
    }

    const buttonHeights = await page
      .locator(".lab button:visible")
      .evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height));
    expect(buttonHeights.length).toBeGreaterThan(0);
    expect(Math.min(...buttonHeights)).toBeGreaterThanOrEqual(44);

    const rangeHeights = await page
      .locator(".lab input[type='range']:visible")
      .evaluateAll((ranges) => ranges.map((range) => range.getBoundingClientRect().height));
    expect(rangeHeights.every((height) => height >= 44)).toBe(true);

    const hotspotSizes = await page
      .locator(".lab-stage svg [role='button']")
      .evaluateAll((hotspots) =>
        hotspots.map((hotspot) => {
          const box = hotspot.getBoundingClientRect();
          return { width: box.width, height: box.height };
        }),
      );
    expect(hotspotSizes.every((size) => size.width >= 44 && size.height >= 44)).toBe(true);
    await expect(page.locator(".lab-scroll-guide").first()).toBeVisible();
  }
});

test("모션 축소 환경에서는 CEGIS 자동 재생 대신 수동 step을 사용한다", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/cegis/");

  const lab = page.locator(".lab").filter({ hasText: "실패한 할인값을 보존하는 CEGIS loop" });
  await expect(lab.getByRole("button", { name: "자동 실행" })).toBeDisabled();
  await expect(lab.getByRole("button", { name: "합성" })).toBeEnabled();

  await page.goto("/");
  const haloDuration = await page
    .locator(".viz-selection-halo")
    .first()
    .evaluate((halo) => getComputedStyle(halo).animationDuration);
  const haloDurationMs = haloDuration.endsWith("ms")
    ? Number.parseFloat(haloDuration)
    : Number.parseFloat(haloDuration) * 1_000;
  expect(haloDurationMs).toBeLessThanOrEqual(0.01);
});

test("lab은 단일 1px 경계와 내부 안전 여백을 사용한다", async ({ page }) => {
  await page.goto("/mdp/");

  const metrics = await page.locator(".lab").first().evaluate((lab) => {
    const labStyle = getComputedStyle(lab);
    const canvasStyle = getComputedStyle(lab.querySelector(".lab-canvas") as HTMLElement);
    return {
      borderWidth: labStyle.borderTopWidth,
      radius: labStyle.borderTopLeftRadius,
      canvasPadding: canvasStyle.paddingTop,
    };
  });

  expect(metrics.borderWidth).toBe("1px");
  expect(metrics.radius).toBe("8px");
  expect(Number.parseFloat(metrics.canvasPadding)).toBeGreaterThanOrEqual(16);
});

test("모바일 내비게이션과 문서 레이아웃은 viewport 밖으로 새지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByRole("button", { name: "메뉴 열기" }).click();
  await expect(page.locator("#mobile-navigation")).toHaveClass(/is-open/);
  await page.locator("#mobile-navigation").getByRole("link", { name: /^MDP / }).click();
  await expect(page).toHaveURL(/\/mdp\/$/);

  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
});
