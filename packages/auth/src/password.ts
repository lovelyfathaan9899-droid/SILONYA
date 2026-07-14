import type * as Argon2 from "@node-rs/argon2";

// `@node-rs/argon2` ships a native `.node` binary. A plain runtime `import`
// here gets pulled into webpack's static module graph via this package's
// transpiled barrel (apps/admin's next.config.ts transpilePackages) and
// webpack tries — and fails — to parse the binary as JS. `eval("require")`
// hides the call from webpack's static analysis so it resolves as a real
// Node `require()` at runtime instead — the standard escape hatch for
// native addons under a bundler (same technique `ws`/`bufferutil` use).
// The `import type` above is erased at compile time and never reaches
// webpack, so it's safe and doesn't trigger the same problem.
const nodeRequire = eval("require") as (id: string) => typeof Argon2;
const { hash, verify } = nodeRequire("@node-rs/argon2");

/**
 * argon2id hashing (AUTHENTICATION.md §2.3, §6) — memory-hard, GPU-resistant.
 * Never use a reversible encryption scheme for passwords.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return hash(plainPassword, {
    algorithm: 2, // argon2id
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(
  plainPassword: string,
  passwordHash: string,
): Promise<boolean> {
  return verify(passwordHash, plainPassword);
}
