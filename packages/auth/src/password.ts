import type * as Argon2 from "@node-rs/argon2";

// `@node-rs/argon2` ships a native `.node` binary, resolved through a
// platform-specific optional-dependency sub-package (e.g.
// `@node-rs/argon2-linux-x64-gnu`) that `serverExternalPackages` doesn't
// reach transitively. A plain runtime `import` here gets pulled into
// webpack's static module graph via this package's transpiled barrel
// (both apps' next.config.ts transpilePackages) and webpack tries — and
// fails — to parse the binary as JS. `eval("require")` hides the call from
// webpack's static analysis so it resolves as a real Node `require()` at
// runtime instead — the standard escape hatch for native addons under a
// bundler (same technique `ws`/`bufferutil` use). The `import type` above
// is erased at compile time and never reaches webpack, so it's safe and
// doesn't trigger the same problem.
//
// Hiding the require from webpack's static analysis *also* hides it from
// Vercel's serverless output file-tracer, which uses the same kind of
// analysis to decide which files get copied into the deployed function —
// a hidden require never gets traced, so the native binary went missing at
// runtime ("Cannot find module '@node-rs/argon2'") despite building fine.
// Both next.config.ts files compensate with an explicit
// `outputFileTracingIncludes` glob for the Linux binary instead.
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
