// Unit tests for the pure logic extracted from the send-push Edge Function.
// Run with: deno test index.test.ts
import { deepStrictEqual as assertEquals } from "node:assert/strict";
import { isAuthorized, shouldRemoveSubscription, buildPayload } from "./index.ts";

Deno.test("isAuthorized - rejects when secret does not match", () => {
  assertEquals(isAuthorized("wrong-secret", "correct-secret"), false);
});

Deno.test("isAuthorized - accepts when secret matches exactly", () => {
  assertEquals(isAuthorized("correct-secret", "correct-secret"), true);
});

Deno.test("isAuthorized - rejects when no secret is provided", () => {
  assertEquals(isAuthorized(undefined, "correct-secret"), false);
});

Deno.test("isAuthorized - rejects when neither side has a secret configured", () => {
  // Regression guard: previously `undefined !== undefined` was falsy, which
  // let unauthenticated requests through whenever ADMIN_SEND_SECRET was unset.
  assertEquals(isAuthorized(undefined, undefined), false);
});

Deno.test("isAuthorized - rejects empty string secret against configured secret", () => {
  assertEquals(isAuthorized("", "correct-secret"), false);
});

Deno.test("shouldRemoveSubscription - true for 404 (not found)", () => {
  assertEquals(shouldRemoveSubscription(404), true);
});

Deno.test("shouldRemoveSubscription - true for 410 (gone)", () => {
  assertEquals(shouldRemoveSubscription(410), true);
});

Deno.test("shouldRemoveSubscription - false for a transient 500", () => {
  assertEquals(shouldRemoveSubscription(500), false);
});

Deno.test("shouldRemoveSubscription - false for network errors with no status code", () => {
  assertEquals(shouldRemoveSubscription(undefined), false);
});

Deno.test("buildPayload - uses provided title, body, and url", () => {
  const payload = JSON.parse(buildPayload("Match tonight", "7pm at the ground", "/matches/42"));
  assertEquals(payload, { title: "Match tonight", body: "7pm at the ground", url: "/matches/42" });
});

Deno.test("buildPayload - falls back to defaults when fields are omitted", () => {
  const payload = JSON.parse(buildPayload());
  assertEquals(payload, { title: "KATL Cricket", body: "", url: "." });
});

Deno.test("buildPayload - falls back to defaults when fields are empty strings", () => {
  const payload = JSON.parse(buildPayload("", "", ""));
  assertEquals(payload, { title: "KATL Cricket", body: "", url: "." });
});
