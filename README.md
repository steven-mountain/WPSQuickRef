# 书签引用管理器

书签引用管理器（WPSRefManager）是一个面向 WPS 文字的加载项，用于优化长文档中“创建书签引用源、插入页码交叉引用、统一管理引用源”的操作流程。

适用场景：

- 长合同、标书、技术文档、论文、制度文件中的页码交叉引用。
- 需要频繁创建书签，并在其他位置插入该书签所在页码。
- 需要检查失效引用、刷新页码、管理引用源名称。

当前版本：1.0.0

## Windows 安装

1. 下载 `release/WPSRefManager-windows-v1.0.0.zip`。
2. 解压到任意目录。
3. 关闭 WPS Office。
4. 双击 `install.bat`。
5. 重新打开 WPS 文字。
6. 顶部菜单应出现「引用助手」。

安装脚本会写入：

```text
%APPDATA%\kingsoft\wps\jsaddons
```

如果已有 `publish.xml`，安装脚本会先备份为 `publish.xml.bak`，再合并插件配置，不会覆盖其他加载项。

## macOS 安装

1. 下载 `release/WPSRefManager-macos-v1.0.0.zip`。
2. 解压到任意目录。
3. 关闭 WPS Office。
4. 双击 `install.command`。
5. 如果系统提示没有权限，在终端进入解压目录后执行：

```bash
chmod +x install.command uninstall.command
./install.command
```

安装脚本会尝试写入：

```text
~/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons/
```

macOS WPS 加载项安装机制可能因 WPS 版本不同而变化。如离线包不可用，优先使用在线部署方式。

## 卸载

Windows：关闭 WPS 后双击 `uninstall.bat`。

macOS：关闭 WPS 后双击 `uninstall.command`，或执行：

```bash
./uninstall.command
```

卸载脚本会删除 `WPSRefManager_1.0.0` 插件目录，并从 `publish.xml` 中移除 WPSRefManager 配置，不影响其他插件。

## 常见问题

### 顶部没有出现「引用助手」

- 确认已完全关闭并重新打开 WPS。
- 确认安装脚本没有报错。
- 检查 `publish.xml` 中是否存在 `name="WPSRefManager"` 的配置。
- Windows 可检查 `%APPDATA%\kingsoft\wps\jsaddons`。
- macOS 可检查 `~/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons/`。

### 插件按钮点击无反应

- 确认插件目录中存在 `index.html`、`ribbon.xml`、`assets/`。
- 尝试重新安装。
- 如果 WPS 禁用了加载项或企业策略限制网页加载项，需要联系管理员。

### macOS 安装后不显示

macOS 版 WPS 的加载项路径和机制可能随版本变化。请优先尝试在线部署方式；如果必须离线安装，请检查实际 WPS 容器路径是否与 README 中路径一致。

### 如何更新插件

关闭 WPS 后，运行新版本安装脚本。安装脚本会更新同名插件配置，并备份旧的 `publish.xml`。

### 如何卸载插件

运行离线包中的卸载脚本。卸载脚本会保留其他插件配置。

## 开发者命令

```bash
npm install
npm run build
npm run package:windows
npm run package:macos
npm run package:all
```

在线部署说明见 [deploy.md](deploy.md)。
开发者打包说明见 [docs/packaging.md](docs/packaging.md)。
macOS 兼容说明见 [docs/macos-notes.md](docs/macos-notes.md)。
