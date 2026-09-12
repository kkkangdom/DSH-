# dsh-skills-sh

**English** | [简体中文](./README.zh.md)

A DeepSeek Harness (DSH) plugin that adds a first-level **Skills.sh** section to WebUI Settings.

Search [Skills.sh](https://www.skills.sh/) by keyword, install GitHub-sourced skill bundles into the DSH skills directory, then update or uninstall the **local skills** this plugin manages.

This plugin does not modify DSH source. After a write, DSH discovers skills through its file watch on `$DSH_HOME/skills` (default `~/.dsh/skills`).

## Install

Web profile only. If `dsh` is not on your `PATH`, use `npx`:

```sh
npx @deepseek-ai/dsh plugin --profile web add github:kkkangdom/dsh-skills-sh
```

or:

```sh
dsh plugin --profile web add github:kkkangdom/dsh-skills-sh
```

pnpm may block the git `prepare` script the first time. Add the exact `allowBuilds` key it prints to `$DSH_HOME/profiles/web/pnpm-workspace.yaml`, then run the same command again. You also need [pnpm](https://pnpm.io/) on `PATH` (`corepack enable` is enough on current Node).

Restart the web profile:

```sh
npx @deepseek-ai/dsh web
```

Open Settings → **Skills.sh**.

## Usage

- Type at least 2 characters to search. Cards show name, description, source, install count, and a Skills.sh link.
- Non-GitHub sources stay visible but cannot be installed.
- Install writes `$DSH_HOME/skills/<slug>/`. Overwrite, update, and uninstall ask for confirmation.
- Collapse search results to see **Local skills**. After a successful install the list collapses automatically.
- Installed hits show **Installed** instead of the install button.

## Commands

```sh
npm install
npm run build
npm run typecheck
npm test
```

GitHub source installs run `prepare` (the same as `build`) so `lib/` exists after `dsh plugin add`.

## Tests

GitHub Actions runs typecheck, tests, and build on every pull request. Checks on the PR and the Actions tab are the test record in this repository.

```sh
npm test
```

The suite exercises the skill steward only (search, install, path safety, update, uninstall) with a temp DSH skills directory and in-memory fixtures. It does not call the live network.

## Scope

- Search Skills.sh (`GET https://skills.sh/api/search`). Keywords shorter than 2 characters do not query and do not load a trending list.
- Install only GitHub sources, extracting the matching skill bundle (not the whole repository) into `$DSH_HOME/skills/<slug>/`.
- Manage **local skills** this plugin installed. Foreign skills in the same directory are not listed, updated, or uninstalled unless you confirm overwriting them during install.
- Confirmation is required before overwrite, update, and uninstall.
- Writes never leave the DSH skills directory.
- Out of scope: enable/disable, editing `SKILL.md`, importing from other agents, MCP, GitHub topic search, `npx skills`.

See `CONTEXT.md` for domain terms and `docs/adr/` for the recorded decisions.
