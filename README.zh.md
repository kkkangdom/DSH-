# dsh-skills-sh

[English](./README.md) | **简体中文**

DeepSeek Harness（DSH）插件：在 WebUI 设置里增加一级分区 **Skills.sh**。

按关键词搜索 [Skills.sh](https://www.skills.sh/)，把 GitHub 来源的技能目录束安装到 DSH 技能目录，并检查更新或卸载本插件管理过的**本机技能**。

本插件不修改 DSH 源码。写入完成后，由 DSH 对 `$DSH_HOME/skills`（默认 `~/.dsh/skills`）的文件监视发现技能。

## 安装

只针对 web profile。若 `PATH` 里没有 `dsh`，用 `npx`：

```sh
npx @deepseek-ai/dsh plugin --profile web add github:kkkangdom/dsh-skills-sh
```

或：

```sh
dsh plugin --profile web add github:kkkangdom/dsh-skills-sh
```

第一次从 GitHub 安装时，pnpm 可能拦住 `prepare` 构建。把报错里打印的 `allowBuilds` 原样写进 `$DSH_HOME/profiles/web/pnpm-workspace.yaml`，再执行一次同一条命令。本机还需要 [pnpm](https://pnpm.io/)（当前 Node 执行 `corepack enable` 即可）。

重启 web profile：

```sh
npx @deepseek-ai/dsh web
```

打开设置 → **Skills.sh**。

## 使用

- 输入至少 2 个字符搜索。卡片展示名称、简介、来源、安装量和 Skills.sh 链接。
- 非 GitHub 来源仍会展示，但不能安装。
- 安装写入 `$DSH_HOME/skills/<slug>/`。覆盖、更新、卸载前都会确认。
- 搜索结果可以收起，以便看到**本机技能**；安装成功后会自动收起。
- 已安装的搜索条目显示「已安装」，不再出现安装按钮。

## 命令

```sh
npm install
npm run build
npm run typecheck
npm test
```

从 GitHub 源码安装时会跑 `prepare`（与 `build` 相同），以便 `dsh plugin add` 之后就有可加载的 `lib/`。

## 测试

每个 PR 都会由 GitHub Actions 跑类型检查、测试和构建。PR 上的 Checks 和仓库的 Actions 页就是测试在仓库里的留痕。

```sh
npm test
```

测试只打技能管家（搜索、安装、路径安全、更新、卸载），用临时 DSH 技能目录和内存夹具，不访问真实网络。

## 范围

- 搜索 Skills.sh（`GET https://skills.sh/api/search`）；关键词少于 2 个字符不发请求，也不拉排行榜。
- 只安装 GitHub 来源，把匹配的技能目录束（不是整仓）写入 `$DSH_HOME/skills/<slug>/`。
- 只管理本插件安装过的**本机技能**。外来技能不出现在列表里，也不会被更新或卸载；安装时若覆盖外来技能，必须先确认收编。
- 覆盖、更新、卸载前都要确认。
- 任何写入都不能离开 DSH 技能目录。
- 不做：启用/停用、编辑 `SKILL.md`、从其他 Agent 导入、MCP、按 GitHub topic 搜仓库、调用 `npx skills`。

词汇以仓库根目录 `CONTEXT.md` 为准，决策见 `docs/adr/`。
