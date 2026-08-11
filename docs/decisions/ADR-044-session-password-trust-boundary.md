# ADR-044 — Session Password Trust Boundary

- **Status:** Accepted
- **Date:** 2026-08-11
- **Decision Type:** Binding Architecture Decision
- **Related Bottleneck:** #22

## Context

JARVIS V1 is intended as a single-user Windows desktop assistant. Requiring multi-user identity management or speaker recognition in V1 would add unnecessary complexity. At the same time, JARVIS must distinguish between an authenticated user who may issue authoritative voice/text instructions and an unauthenticated person near the machine.

The user approved a session-password model: JARVIS starts locked, requires a JARVIS session password to establish an authoritative session, and thereafter treats voice/text prompts as originating from the authenticated user. Authentication does not create blanket execution authority.

## Decision

JARVIS V1 SHALL operate as a single-user authenticated desktop assistant using a JARVIS Session Unlock boundary.

JARVIS SHALL start in a locked state and SHALL require successful session authentication before private data, connected integrations, AI workers, or consequential tools become available.

After successful unlock, voice and text prompts SHALL be treated as originating from the authenticated authoritative user for the duration of that trusted session.

Session authentication SHALL establish who may issue authoritative commands, but SHALL NOT grant generalized or unlimited execution authority.

JARVIS SHALL act only within authority explicitly granted by one or more of:

- the authenticated user's current instruction;
- an existing approved standing permission;
- an explicitly configured automation or event policy.

Authentication SHALL remain distinct from intent and authorization:

1. **Authentication** — establishes that the current voice/text input belongs to the authoritative JARVIS user.
2. **Intent / Authority** — establishes what the authenticated user actually asked JARVIS to do, including any previously approved automation scope.
3. **Permission** — the deterministic Permission Engine decides whether the requested operations are allowed and whether additional confirmation is required.

The existing governing rule remains:

> **AI decides. Software authorizes. Software verifies.**

## Session Lock Behavior

JARVIS SHALL return to the locked state when:

- explicitly locked by the user;
- the associated Windows session is locked;
- the Windows user signs out;
- any configured inactivity policy requires locking.

While locked:

- private information SHALL NOT be disclosed;
- new consequential work SHALL NOT be initiated from voice/text input;
- low-level emergency controls such as stop, mute, or equivalent safe deterministic controls MAY remain available;
- previously authorized background work MAY continue only according to its task, permission, recovery, and safety policies.

## Action Authorization After Unlock

Unlocking JARVIS does not bypass existing risk controls.

For example, an authenticated instruction such as "check Gmail" may authorize JARVIS to read Gmail within configured integration permissions, but it does not authorize JARVIS to independently reply to messages unless that action was explicitly requested or covered by an approved automation.

Likewise, "check production" does not imply "fix production", and "investigate Cloudflare" does not imply permission to modify DNS records.

HIGH and CRITICAL actions MAY still require explicit confirmation according to the Permission Engine even during an authenticated session.

## Password Storage

The JARVIS session password MUST NOT be stored in plaintext.

JARVIS SHALL store only an appropriate salted password-verification representation using a modern password-hashing / key-derivation mechanism suitable for local desktop authentication.

The Credential Broker and integration secrets remain separate from the session-password mechanism. Successful session authentication SHALL NOT expose raw provider credentials to AI orchestrators or workers.

## V1 Trust Boundary

For V1, physical access to an already-unlocked JARVIS session is treated as access to the authenticated user's command channel. Speaker recognition is therefore not required for V1.

Speaker identification, multi-user profiles, and stronger identity signals MAY be added later, but SHALL remain separate from the Permission Engine and SHALL NOT require redesigning the V1 session boundary.

## Product Principle

> **Enter the JARVIS password once, then talk naturally. The password establishes who may issue commands; the Permission Engine still controls what JARVIS may do.**
