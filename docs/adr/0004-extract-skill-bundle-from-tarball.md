# 从 GitHub tarball 只抽出匹配的技能目录束

Skills.sh 的 GitHub 来源往往是整仓多技能，而 DSH 不扫描嵌套 `SKILL.md`。把整仓写入 `$DSH_HOME/skills/<slug>/` 会让 DSH 发现不了技能。因此按来源下载 tarball，只把目录名或 frontmatter `name` 等于 slug 的那一份目录束写入 DSH 技能目录。找不到或无法唯一匹配则安装失败、不写盘。
