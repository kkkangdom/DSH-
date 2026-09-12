# dsh-skills-sh

DeepSeek Harness（DSH）插件：在 WebUI 设置里增加一级分区 **Skills.sh**。按关键词搜索 Skills.sh、把 GitHub 来源的技能目录束安装到 DSH 技能目录，并检查更新或卸载本插件管理过的本机技能。

本插件不修改 DSH 源码。写入完成后，由 DSH 对 `$DSH_HOME/skills` 的文件监视发现技能。

## 安装

只针对 web profile：

```sh
dsh plugin --profile web add github:kkkangdom/DSH-
```

重启 web profile 后，打开设置 → **Skills.sh**。

## 命令

```sh
npm install
npm run build
npm run typecheck
npm test
```

从 GitHub 源码安装时会跑 `prepare`（与 `build` 相同），以便 `dsh plugin add` 之后就有可加载的 `lib/` 产物。

## 范围

- 搜索 Skills.sh（`GET https://skills.sh/api/search`）；关键词少于 2 个字符不发请求，也不拉排行榜。
- 只安装 GitHub 来源，把匹配的技能目录束（不是整仓）写入 `$DSH_HOME/skills/<slug>/`。
- 只管理本插件安装过的**本机技能**。外来技能不出现在列表里，也不会被更新或卸载；安装时若覆盖外来技能，必须先确认收编。
- 覆盖、更新、卸载前都要确认。
- 任何写入都不能离开 DSH 技能目录。

词汇以仓库根目录 `CONTEXT.md` 为准，决策见 `docs/adr/`。
