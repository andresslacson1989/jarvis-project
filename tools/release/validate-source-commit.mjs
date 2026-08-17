import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const SOURCE_COMMIT_PATTERN = /^[0-9a-f]{40}$/iu;

export class ReleaseSourceBindingError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "ReleaseSourceBindingError";
  }
}

export function validateSourceCommitIdentity({ head, expected, status }) {
  if (!SOURCE_COMMIT_PATTERN.test(expected)) {
    throw new ReleaseSourceBindingError("release sourceCommitSha must be a 40-character Git SHA");
  }
  if (head.toLowerCase() !== expected.toLowerCase()) {
    throw new ReleaseSourceBindingError(
      `release sourceCommitSha ${expected} does not match repository HEAD ${head}`,
    );
  }
  if (status.length !== 0) {
    throw new ReleaseSourceBindingError(
      "release packaging requires a clean worktree; uncommitted or untracked files are present",
    );
  }
  return { head: head.toLowerCase(), clean: true };
}

async function git(repositoryRoot, args) {
  try {
    const result = await execFileAsync("git", args, {
      cwd: repositoryRoot,
      windowsHide: true,
      maxBuffer: 64 * 1024,
    });
    return result.stdout.trim();
  } catch (error) {
    throw new ReleaseSourceBindingError(`could not inspect release source repository with Git: ${error.message}`, {
      cause: error,
    });
  }
}

export async function validateReleaseSource({ sourceCommitSha, repositoryRoot = process.cwd() }) {
  if (!isAbsolute(repositoryRoot)) {
    throw new ReleaseSourceBindingError("release repository root must be absolute");
  }
  const root = await realpath(resolve(repositoryRoot)).catch((error) => {
    throw new ReleaseSourceBindingError("release repository root cannot be canonicalized", { cause: error });
  });
  const topLevel = await git(root, ["rev-parse", "--show-toplevel"]);
  const canonicalTopLevel = await realpath(topLevel).catch((error) => {
    throw new ReleaseSourceBindingError("Git repository root cannot be canonicalized", { cause: error });
  });
  if (canonicalTopLevel !== root) {
    throw new ReleaseSourceBindingError("release repository root is not the Git worktree root");
  }
  const head = await git(root, ["rev-parse", "HEAD"]);
  const status = await git(root, ["status", "--porcelain=v1", "--untracked-files=all"]);
  return validateSourceCommitIdentity({ head, expected: sourceCommitSha, status });
}
