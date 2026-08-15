import { strict as assert } from "node:assert";
import test from "node:test";
import {
  decideLockedSessionNotification,
  shouldSuppressLockedSessionContent,
} from "../../../packages/protocol/src/session-privacy-runtime.mts";

test("locked sessions suppress private, sensitive, and secret notification content", () => {
  const locked = { state: "LOCKED" };
  assert.equal(shouldSuppressLockedSessionContent(locked, "PUBLIC"), false);
  assert.equal(shouldSuppressLockedSessionContent(locked, "PRIVATE"), true);
  assert.equal(shouldSuppressLockedSessionContent(locked, "SENSITIVE"), true);
  assert.equal(shouldSuppressLockedSessionContent(locked, "SECRET"), true);
  assert.deepEqual(
    decideLockedSessionNotification({
      session: locked,
      sensitivity: "PRIVATE",
      requestedChannels: ["VOICE", "DESKTOP", "DASHBOARD"],
    }),
    { channels: ["SILENT"], contentSuppressed: true, deferUntilUnlocked: true },
  );
});

test("unlocked sessions preserve the requested bounded notification channels and public locked notices remain safe", () => {
  assert.deepEqual(
    decideLockedSessionNotification({
      session: { state: "UNLOCKED" },
      sensitivity: "SENSITIVE",
      requestedChannels: ["VOICE", "DASHBOARD"],
    }),
    { channels: ["VOICE", "DASHBOARD"], contentSuppressed: false, deferUntilUnlocked: false },
  );
  assert.deepEqual(
    decideLockedSessionNotification({
      session: { state: "LOCKED" },
      sensitivity: "PUBLIC",
      requestedChannels: ["DESKTOP"],
    }),
    { channels: ["DESKTOP"], contentSuppressed: false, deferUntilUnlocked: false },
  );
  assert.throws(
    () => decideLockedSessionNotification({ session: { state: "LOCKED" }, sensitivity: "PUBLIC", requestedChannels: ["DESKTOP", "DESKTOP"] }),
    /unique/iu,
  );
});
