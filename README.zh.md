# dsh-skills-sh

DeepSeek Harness（DSH）插件：在 WebUI 设置里增加一级分区 **Skills.sh**。

本插件不修改 DSH 源码。

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

词汇以仓库根目录 `CONTEXT.md` 为准，决策见 `docs/adr/`。
