# dsh-skills-sh

A DeepSeek Harness (DSH) plugin that adds a **Skills.sh** section to WebUI Settings: search the Skills.sh directory by keyword, install GitHub-sourced skill bundles into the DSH skills directory, then update or uninstall the skills this plugin manages.

This plugin does not modify DSH source. After a write, DSH discovers skills through its file watch on `$DSH_HOME/skills`.

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

## Scope

- Search Skills.sh (`GET https://skills.sh/api/search`); keywords shorter than 2 characters do not query and do not load a trending list.
- Install only GitHub sources, extracting the matching skill bundle (not the whole repository) into `$DSH_HOME/skills/<slug>/`.
- Manage **local skills** this plugin installed. Foreign skills in the same directory are not listed, updated, or uninstalled unless you confirm overwriting them during install.
- Confirmation is required before overwrite, update, and uninstall.
- Writes never leave the DSH skills directory.

See `CONTEXT.md` for domain terms and `docs/adr/` for the recorded decisions.
