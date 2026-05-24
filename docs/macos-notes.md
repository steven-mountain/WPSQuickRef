# macOS 兼容性说明

macOS 版 WPS 的 JS 加载项机制与 Windows 不完全一致，并且可能随 WPS 版本变化。

## 默认离线路径

离线安装脚本默认使用：

```text
~/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons/
```

该路径来自当前 wpsjs 调试流程中使用的 macOS WPS 容器路径。

## 可能的问题

### 安装后顶部没有「引用助手」

可能原因：

- 当前 WPS 版本不读取该 jsaddons 路径。
- WPS 沙盒容器 ID 变化。
- macOS 权限限制导致脚本未写入成功。
- WPS 需要完全退出后重新启动。

### install.command 无法运行

在终端中执行：

```bash
chmod +x install.command uninstall.command
./install.command
```

### 缺少 python3

macOS 离线包使用 `python3` 合并 `publish.xml`。如果系统没有 `python3`，脚本会停止并保留原文件。此时建议使用在线部署方式。

## 推荐方案

面向 macOS 用户分发时，优先使用在线部署：

1. 将 `dist/` 部署到 HTTPS 静态服务器。
2. 使用 WPS 官方加载项发布入口或公司内部发布机制分发。

在线方式可以避免不同 macOS WPS 版本的本地路径差异。
