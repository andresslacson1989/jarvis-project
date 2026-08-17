import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import {
  ReleaseSourceBindingError,
  validateReleaseSource,
  validateSourceCommitIdentity,
} from "../../../tools/release/validate-source-commit.mjs";

const execFileAsync = promisify(execFile);

test("release source binding requires the expected commit and a clean worktree", async () => {
  const root = await mkdtemp(join(tmpdir(), "jarvis-release-source-"));
  try {
    await execFileAsync("git", ["init", "--initial-branch=master"], { cwd: root, windowsHide: true });
    await execFileAsync("git", ["config", "user.email", "qualification@example.invalid"], {
      cwd: root,
      windowsHide: true,
    });
    await execFileAsync("git", ["config", "user.name", "JARVIS Qualification"], {
      cwd: root,
      windowsHide: true,
    });
    await writeFile(join(root, "source.txt"), "qualified\n");
    await writeFile(join(root, ".gitignore"), "generated/\n");
    await execFileAsync("git", ["add", "source.txt", ".gitignore"], { cwd: root, windowsHide: true });
    await execFileAsync("git", ["commit", "-m", "qualification fixture"], {
      cwd: root,
      windowsHide: true,
    });
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      windowsHide: true,
    });
    const head = stdout.trim();
    assert.deepEqual(await validateReleaseSource({ sourceCommitSha: head, repositoryRoot: root }), {
      head,
      clean: true,
    });

    await mkdir(join(root, "generated"), { recursive: true });
    await writeFile(join(root, "generated", "release.bin"), "qualification output\n");
    assert.deepEqual(await validateReleaseSource({ sourceCommitSha: head, repositoryRoot: root }), {
      head,
      clean: true,
    });

    await writeFile(join(root, "source.txt"), "changed\n");
    await assert.rejects(
      validateReleaseSource({ sourceCommitSha: head, repositoryRoot: root }),
      (error) => error instanceof ReleaseSourceBindingError && /clean worktree/u.test(error.message),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("release source identity rejects malformed and mismatched commit values", () => {
  assert.throws(
    () => validateSourceCommitIdentity({ head: "a".repeat(40), expected: "not-a-sha", status: "" }),
    /40-character Git SHA/u,
  );
  assert.throws(
    () => validateSourceCommitIdentity({ head: "a".repeat(40), expected: "b".repeat(40), status: "" }),
    /does not match repository HEAD/u,
  );
});
