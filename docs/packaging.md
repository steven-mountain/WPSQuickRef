# 开发者打包说明

## 基本信息

- 加载项内部名：`WPSRefManager`
- 显示名：`书签引用管理器`
- 版本：`1.0.0`
- 插件目录名：`WPSRefManager_1.0.0`

版本常量位于：

```text
src/config/appInfo.ts
scripts/package-common.js
```

发布新版本时请同时更新这两个文件以及 `package.json` 中的版本号。

## 构建

```bash
npm run build
```

输出目录：

```text
dist/
```

构建产物应包含：

- `index.html`
- `ribbon.xml`
- `manifest.xml`
- `assets/`
- `images/`

## 生成离线包

Windows：

```bash
npm run package:windows
```

macOS：

```bash
npm run package:macos
```

全部：

```bash
npm run package:all
```

输出：

```text
release/WPSRefManager-windows-v1.0.0.zip
release/WPSRefManager-macos-v1.0.0.zip
```

## 离线包结构

```text
install.bat / install.command
uninstall.bat / uninstall.command
README.md
tools/
jsaddons/
  publish.xml
  WPSRefManager_1.0.0/
    index.html
    ribbon.xml
    manifest.xml
    assets/
    images/
```

## publish.xml 合并策略

安装脚本不会覆盖用户已有的 `publish.xml`：

1. 若目标 `publish.xml` 存在，先备份为 `publish.xml.bak`。
2. 读取已有 XML。
3. 删除同名 `WPSRefManager` 的旧配置。
4. 插入当前版本配置。
5. 保留其他 `jsplugin` / `jspluginonline` 配置。

如果 XML 解析失败，脚本会保留原文件并退出，提示用户手动处理。

## 在线发布

在线部署只需要发布 `dist/` 到 HTTPS 静态服务器。可选使用：

```bash
npm run publish -- -s https://example.com/wps-ref-manager/
```

离线打包脚本不依赖 `wpsjs publish`。
