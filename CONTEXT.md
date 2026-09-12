# Skills.sh 技能管理

DSH WebUI 设置里的技能管理插件：从 Skills.sh 浏览并安装技能，只管理本插件写入 DSH 技能目录的那些技能。

## Language

**DSH**:
DeepSeek Harness，本插件所依附的宿主。
_Avoid_: DeepSeek 客户端, 模型本身

**插件**:
本仓库交付的 DSH bundle，给 WebUI 增加设置入口和技能生命周期操作。
_Avoid_: 技能, 扩展, addon

**技能**:
一份带 `SKILL.md` 的目录束，供 DSH 发现后交给模型使用。
_Avoid_: 插件, 包, 仓库

**Skills.sh**:
公开的 Agent Skills 目录站及其目录数据，浏览与安装的唯一市场。
_Avoid_: GitHub Marketplace, npm, 技能 CLI

**DSH 技能目录**:
用户级目录 `$DSH_HOME/skills`（默认 `~/.dsh/skills`）。本插件的写入、更新、删除只发生在这里。
_Avoid_: `~/.agents/skills`, 项目 `.dsh/skills`, 其他 Agent 的技能目录

**本机技能**:
本插件安装或更新过、且仍留在 DSH 技能目录中的技能。不是 DSH 当前能加载的全部技能。
_Avoid_: 已安装技能（若指 DSH 扫到的全部）, 本地所有技能

**外来技能**:
位于 DSH 技能目录中、但不在本插件管理范围内的技能。不出现在本机技能列表中，不会被更新或卸载。若安装时目标文件夹与外来技能冲突，经确认覆盖后收进台账，变为本机技能。
_Avoid_: 系统技能, 内置技能

**不支持的来源**:
Skills.sh 上非 GitHub 的来源（如 well-known 站点）。搜索结果仍展示，但不能安装。不是来源失效，也不是网络失败。
_Avoid_: 来源失效, 网络失败

**来源**:
Skills.sh 上的 `source` 字段，多为 GitHub 的 `owner/repo`。
_Avoid_: git remote, npm registry, 下载 URL

**技能身份**:
Skills.sh 的稳定 id，格式 `{来源}/{slug}`，例如 `mattpocock/skills/grilling`。
_Avoid_: 仅用 slug, 仅用文件夹名, 仓库 URL

**重复安装**:
目标文件夹已经存在于 DSH 技能目录中。覆盖前必须确认。
_Avoid_: 更新（身份相同且内容有变时用「更新」）

**更新**:
本机技能的技能身份未变，远端内容哈希与本地不同。更新前必须确认。
_Avoid_: 覆盖安装, 升级插件

**来源失效**:
按技能身份再取远端时，目录或仓库明确不存在（如 404）。不是暂时的网络失败。本地文件保留，不可更新，仍可卸载。
_Avoid_: 网络失败, 安装失败

**覆盖**:
用新内容整体替换 DSH 技能目录里已有的那个技能文件夹。安装冲突与更新都会走到覆盖，且都必须先确认。
_Avoid_: 合并, 追加文件

**目录束**:
一份技能在磁盘上的形态：含 `SKILL.md` 的目录，以及与它同级的 scripts、references 等文件。安装时只写入匹配 slug 的那一份目录束，不写入整个来源仓库。
_Avoid_: 仓库, 克隆, 整包
