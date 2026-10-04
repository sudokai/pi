---
name: update-local-install
description: Rebuild the source-linked local pi command so it matches this checkout. Use when asked to update, rebuild, or refresh the local pi installation or the linked pi binary.
---

# Updating the local pi installation

Run commands from the repo root (two directories above this skill).

This updates the `pi` command that is linked at this checkout. It does not pull, reset, stash, or commit. A matching npm version does not mean the binary is current: the checkout can be ahead of the published package.

## 1. Identify the install

Resolve `pi` through every symlink (`which pi`, then `readlink` / `realpath`). `npm list -g` and `npm prefix -g` can miss it when Node comes from mise or another version manager.

- If the resolved path is `packages/coding-agent/dist/bundle/cli.js` inside this checkout, continue below. The usual layout is a global `node_modules/@earendil-works/pi-coding-agent` symlink to `packages/coding-agent`.
- If `pi` is a Nix profile, the pi.dev installer, or a real npm, pnpm, or Bun global package outside this checkout, stop. Do not replace that install from this skill. Update it with its package manager. `pi update` is for those installs only.

Do not run `pi update` for a source link. It treats the command as a global npm package and replaces the symlink with the published package.

## 2. Sync dependencies

```bash
npm install --ignore-scripts
```

Use this when `node_modules` may lag the lockfile, and always after a lockfile change. Do not use `npm ci` (it deletes `node_modules`) and do not run dependency lifecycle scripts.

A `packages/ai` typecheck error about a missing `@anthropic-ai/sdk` export, such as `BetaInputTransformation`, means the installed SDK is older than `packages/ai/package.json`. Confirm `node_modules/@anthropic-ai/sdk/package.json` matches that pin, then install again before building.

## 3. Rebuild

```bash
npm run build
```

Build from the repo root. The coding-agent bundle depends on the other packages' `dist` output, and `packages/tui` must be built before `packages/coding-agent`. Following this skill is the request to build; the repo rule that forbids an unsolicited `npm run build` does not apply.

If `packages/coding-agent` fails typecheck on fields that exist in dependency source (`samplingParamsByThinkingLevel` on `Model`, `OAuthClientMetadataDocument` from `@earendil-works/pi-mcp`), dependency `dist` is stale. Rebuild from the root instead of building coding-agent alone.

Do not run `npm test` or `npm run check` as part of this update.

## 4. Verify

- `pi --version` runs, and the resolved `pi` path is still `packages/coding-agent/dist/bundle/cli.js` in this checkout.
- That bundle's mtime is from this rebuild.
- `git status` is clean of unexpected tracked changes. The ai build runs `generate-models` and can dirty `packages/ai/src/models.generated.ts` and provider data. Report those files. Do not revert or commit them unless the user asks. Other sessions may own other dirty files.
