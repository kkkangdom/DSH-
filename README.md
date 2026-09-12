# dsh-skills-sh

A DeepSeek Harness (DSH) plugin that adds a **Skills.sh** section to WebUI Settings.

This plugin does not modify DSH source.

## Install

Web profile only:

```sh
dsh plugin --profile web add github:kkkangdom/DSH-
```

Restart the web profile, then open Settings → **Skills.sh**.

## Commands

```sh
npm install
npm run build
npm run typecheck
npm test
```

GitHub source installs run `prepare` (the same as `build`) so the loadable `lib/` artifacts exist after `dsh plugin add`.

See `CONTEXT.md` for domain terms and `docs/adr/` for the recorded decisions.
