# 安装时由插件自己写入 DSH 技能目录

本插件的职责是让 DSH 发现技能，而不是复用 `npx skills`。技能 CLI 默认写到各 Agent 目录，无法保证只动 `$DSH_HOME/skills`，路径安全测试也难做。因此安装、更新、卸载都由插件自己落盘，只写 DSH 技能目录；装完依赖 DSH 对 `$DSH_HOME/skills` 的文件监视来发现技能，不改 DSH 源码。
