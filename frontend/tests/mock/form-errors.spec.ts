// The API's field errors on the card form (ADR 0038). The fake backend only
// rejects what the form already prevents, so the 400s are injected.

import { expect, test, type Page } from "@playwright/test";

import { cardAt } from "../support/overview";
import {
  REJECTION_REQUEST_ID,
  rejectSaves,
  setRejection,
  type FieldError,
} from "../support/save-rejections";

const TITLE_REQUIRED = "Title is required";
const DESCRIPTION_TOO_LONG = "Description must be at most 2000 characters";
const SAVE_FAILED = /Something went wrong while trying to/;

const BOTH: FieldError[] = [
  { field: "title", code: "required" },
  { field: "description", code: "max_length" },
];

// Opens a form with values its own checks accept, ready for the API to
// reject them.
async function openForm(page: Page, mode: "create" | "update") {
  await rejectSaves(page);
  if (mode === "create") {
    await page.goto("/library/cards/new");
    await page.getByLabel("Title").fill("Photosynthesis");
    await page.getByLabel("Description").fill("Plants make sugar from light.");
    return page.getByRole("button", { name: "Create Card" });
  }
  await page.goto("/library/cards");
  await cardAt(page, 1).getByRole("link", { name: "Update" }).click();
  await expect(page.getByLabel("Title")).toHaveValue("Mitochondria");
  await page.getByLabel("Title").fill("Mitochondrion");
  return page.getByRole("button", { name: "Update Card" });
}

for (const mode of ["create", "update"] as const) {
  test.describe(mode, () => {
    test("the API's errors show on their fields", async ({ page }) => {
      const submit = await openForm(page, mode);
      await setRejection(page, BOTH);

      await submit.click();

      await expect(page.getByText(TITLE_REQUIRED, { exact: true })).toBeVisible();
      await expect(page.getByText(DESCRIPTION_TOO_LONG, { exact: true })).toBeVisible();
      await expect(page.getByLabel("Title")).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByLabel("Description")).toHaveAttribute("aria-invalid", "true");
      // The same look as a client error: the status bars' alerts, and no
      // line next to the buttons.
      await expect(page.getByRole("alert")).toHaveCount(2);
      await expect(page.getByText(SAVE_FAILED)).toHaveCount(0);
      await expect(submit).toBeDisabled();
    });

    test("changing the title clears its error, not the description's", async ({ page }) => {
      const submit = await openForm(page, mode);
      await setRejection(page, BOTH);
      await submit.click();
      await expect(page.getByText(TITLE_REQUIRED, { exact: true })).toBeVisible();

      // Leaving a field doesn't change it: its error stays.
      await page.getByLabel("Description").focus();
      await page.getByLabel("Title").focus();
      await page.getByLabel("Description").focus();
      await expect(page.getByText(TITLE_REQUIRED, { exact: true })).toBeVisible();

      await page.getByLabel("Title").fill("Photosynthesis 2");

      await expect(page.getByText(TITLE_REQUIRED, { exact: true })).toHaveCount(0);
      await expect(page.getByLabel("Title")).toHaveAttribute("aria-invalid", "false");
      await expect(page.getByText(DESCRIPTION_TOO_LONG, { exact: true })).toBeVisible();
      await expect(page.getByLabel("Description")).toHaveAttribute("aria-invalid", "true");
      // The description's error still blocks the submit; the field's own
      // checks still run on change.
      await expect(submit).toBeDisabled();
      await page.getByLabel("Title").fill("");
      await expect(page.getByText(TITLE_REQUIRED, { exact: true })).toBeVisible();

      await page.getByLabel("Title").fill("Photosynthesis 3");
      await page.getByLabel("Description").fill("Changed.");
      await expect(page.getByRole("alert")).toHaveCount(0);
      await expect(submit).toBeEnabled();
    });

    test("what the form can't place shows below the fields and in the console", async ({
      page,
    }) => {
      const submit = await openForm(page, mode);
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await setRejection(page, [
        { field: "tags", code: "required" },
        { field: "title", code: "untrimmed" },
        { field: "description", code: "max_length" },
      ]);

      await submit.click();

      await expect(page.getByText(SAVE_FAILED)).toBeVisible();
      // The error the form could place still lands on its field.
      await expect(page.getByText(DESCRIPTION_TOO_LONG, { exact: true })).toBeVisible();
      await expect(page.getByLabel("Description")).toHaveAttribute("aria-invalid", "true");
      // The two it couldn't leave the title alone.
      await expect(page.getByLabel("Title")).toHaveAttribute("aria-invalid", "false");
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain(REJECTION_REQUEST_ID);
      // It names what the form couldn't place, not what it could.
      expect(errors[0]).toContain('"tags"');
      expect(errors[0]).toContain('"untrimmed"');
      expect(errors[0]).not.toContain('"description"');
    });
  });
}

test("a validation error without field errors shows below the fields and in the console", async ({
  page,
}) => {
  const submit = await openForm(page, "create");
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await setRejection(page, []);

  await submit.click();

  await expect(page.getByText(SAVE_FAILED)).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveAttribute("aria-invalid", "false");
  await expect(page.getByLabel("Description")).toHaveAttribute("aria-invalid", "false");
  expect(errors).toHaveLength(1);
  expect(errors[0]).toContain(REJECTION_REQUEST_ID);
});

test.describe("focus after a failed submit", () => {
  test("an empty form focuses the title", async ({ page }) => {
    await page.goto("/library/cards/new");

    await page.getByRole("button", { name: "Create Card" }).click();

    // Both fields are invalid; the first in the form's order gets the focus.
    await expect(page.getByText(TITLE_REQUIRED, { exact: true })).toBeVisible();
    await expect(page.getByText("Description is required", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Title")).toBeFocused();
  });

  test("an empty description alone focuses the description", async ({ page }) => {
    await page.goto("/library/cards/new");
    await page.getByLabel("Title").fill("Photosynthesis");

    await page.getByRole("button", { name: "Create Card" }).click();

    await expect(page.getByLabel("Description")).toBeFocused();
  });

  test("an API error on the description alone focuses the description", async ({ page }) => {
    const submit = await openForm(page, "create");
    await setRejection(page, [{ field: "description", code: "max_length" }]);

    await submit.click();

    await expect(page.getByText(DESCRIPTION_TOO_LONG, { exact: true })).toBeVisible();
    await expect(page.getByLabel("Description")).toBeFocused();
  });

  test("API errors on both fields focus the title", async ({ page }) => {
    const submit = await openForm(page, "update");
    await setRejection(page, BOTH);

    await submit.click();

    await expect(page.getByText(TITLE_REQUIRED, { exact: true })).toBeVisible();
    await expect(page.getByLabel("Title")).toBeFocused();
  });
});
