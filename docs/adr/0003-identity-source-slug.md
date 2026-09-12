# 技能身份是 `{来源}/{slug}`，本地文件夹用 slug

Skills.sh 用 `{source}/{slug}` 区分技能；DSH 只扫描 `$DSH_HOME/skills/<文件夹>/SKILL.md`。本地文件夹改用 `owner__slug` 会让 DSH 与 Skills.sh 的短名对不上。因此身份以 `{来源}/{slug}` 为准，文件夹名为 slug。两个来源抢同一 slug 视为重复安装，确认后再覆盖。
