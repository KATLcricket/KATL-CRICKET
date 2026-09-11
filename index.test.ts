// Unit tests for pure logic extracted from the send-push Edge Function.
// Run with: deno test index.test.ts
import { deepStrictEqual as assertEquals } from "node:assert/strict";
import { isAdminRole, extractBearerToken, shouldRemoveSubscription, buildPayload } from "./index.ts";

test("isAdminRole - accepts admin", () => {
  assertEquals(isAdminRole("admin"), true);
});

test("isAdminRole - accepts super_admin", () => {
  assertEquals(isAdminRole("super_admin"), true);
});

test("isAdminRole - rejects member", () => {
  assertEquals(isAdminRole("member"), false);
});

test("isAdminRole - rejects missing role", () => {
  assertEquals(isAdminRole(undefined), false);
});

test("extractBearerToken - extracts a bearer token", () => {
  assertEquals(extractBearerToken("Bearer abc123"), "abc123");
});

test("extractBearerToken - is case insensitive", () => {
  assertEquals(extractBearerToken("bearer abc123"), "abc123");
});

test("extractBearerToken - rejects missing header", () => {
  assertEquals(extractBearerToken(null), null);
});

test("extractBearerToken - rejects malformed header", () => {
  assertEquals(extractBearerToken("Basic abc123"), null);
});

test("shouldRemoveSubscription - true for 404 (not found)", () => {
  assertEquals(shouldRemoveSubscription(404), true);
});

test("shouldRemoveSubscription - true for 410 (gone)", () => {
  assertEquals(shouldRemoveSubscription(410), true);
});

test("shouldRemoveSubscription - false for a transient 500", () => {
  assertEquals(shouldRemoveSubscription(500), false);
});

test("shouldRemoveSubscription - false for network errors with no status code", () => {
  assertEquals(shouldRemoveSubscription(undefined), false);
});

test("buildPayload - uses provided title, body, and url", () => {
  const payload = JSON.parse(buildPayload("Match tonight", "7pm at the ground", "/matches/42"));
  assertEquals(payload, { title: "Match tonight", body: "7pm at the ground", url: "/matches/42" });
});

test("buildPayload - falls back to defaults when fields are omitted", () => {
  const payload = JSON.parse(buildPayload());
  assertEquals(payload, { title: "KATL Cricket", body: "", url: "." });
});

test("buildPayload - falls back to defaults when fields are empty strings", () => {
  const payload = JSON.parse(buildPayload("", "", ""));
  assertEquals(payload, { title: "KATL Cricket", body: "", url: "." });
});
