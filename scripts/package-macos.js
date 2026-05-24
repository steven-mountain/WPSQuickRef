import path from 'node:path'
import {
  ADDIN_DIR,
  ADDIN_NAME,
  ADDIN_DISPLAY_NAME,
  APP_VERSION,
  cleanupStage,
  prepareStage,
  releaseDir,
  writeFile,
  zipStage
} from './package-common.js'

const stageRoot = prepareStage('macos')
const zipPath = path.join(releaseDir, `${ADDIN_NAME}-macos-v${APP_VERSION}.zip`)

writeFile(path.join(stageRoot, 'tools', 'merge_publish.py'), createMergePublishPy(), 0o755)
writeFile(path.join(stageRoot, 'install.command'), createInstallCommand(), 0o755)
writeFile(path.join(stageRoot, 'uninstall.command'), createUninstallCommand(), 0o755)

zipStage(stageRoot, zipPath)
cleanupStage(stageRoot)
console.log(`macOS 离线包已生成：${zipPath}`)

function createInstallCommand() {
  return `#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "请先关闭 WPS Office，再继续安装 ${ADDIN_DISPLAY_NAME}。"
read -r -p "按回车继续..."

ADDON_ROOT="$HOME/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons"
PLUGIN_NAME="${ADDIN_NAME}"
PLUGIN_DIR="${ADDIN_DIR}"
SOURCE_DIR="$PWD/jsaddons/$PLUGIN_DIR"
TARGET_DIR="$ADDON_ROOT/$PLUGIN_DIR"
PUBLISH_FILE="$ADDON_ROOT/publish.xml"
SOURCE_PUBLISH="$PWD/jsaddons/publish.xml"

mkdir -p "$ADDON_ROOT"
rm -rf "$TARGET_DIR"
cp -R "$SOURCE_DIR" "$TARGET_DIR"

if [ -f "$PUBLISH_FILE" ]; then
  cp "$PUBLISH_FILE" "$PUBLISH_FILE.bak"
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "未找到 python3，无法自动合并 publish.xml。请参考 README.md 手动安装。"
  read -r -p "按回车退出..."
  exit 1
fi

python3 "$PWD/tools/merge_publish.py" install "$PUBLISH_FILE" "$SOURCE_PUBLISH" "$PLUGIN_NAME"

echo "安装完成。请重新打开 WPS Office，并检查顶部是否出现“引用助手”。"
read -r -p "按回车退出..."
`
}

function createUninstallCommand() {
  return `#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "请先关闭 WPS Office，再继续卸载 ${ADDIN_DISPLAY_NAME}。"
read -r -p "按回车继续..."

ADDON_ROOT="$HOME/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons"
PLUGIN_NAME="${ADDIN_NAME}"
PLUGIN_DIR="${ADDIN_DIR}"
TARGET_DIR="$ADDON_ROOT/$PLUGIN_DIR"
PUBLISH_FILE="$ADDON_ROOT/publish.xml"

rm -rf "$TARGET_DIR"

if [ -f "$PUBLISH_FILE" ]; then
  cp "$PUBLISH_FILE" "$PUBLISH_FILE.bak"
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "未找到 python3，无法自动更新 publish.xml。请参考 README.md 手动删除插件配置。"
  read -r -p "按回车退出..."
  exit 1
fi

python3 "$PWD/tools/merge_publish.py" uninstall "$PUBLISH_FILE" "" "$PLUGIN_NAME"

echo "卸载完成。请重新打开 WPS Office。"
read -r -p "按回车退出..."
`
}

function createMergePublishPy() {
  return `#!/usr/bin/env python3
import os
import sys
import xml.etree.ElementTree as ET

action = sys.argv[1]
target_publish = sys.argv[2]
source_publish = sys.argv[3] if len(sys.argv) > 3 else ""
plugin_name = sys.argv[4] if len(sys.argv) > 4 else ""

def load_or_new(path):
    if not os.path.exists(path):
        return ET.ElementTree(ET.Element("jsplugins"))
    try:
        tree = ET.parse(path)
        if tree.getroot().tag != "jsplugins":
            raise ValueError("publish.xml 根节点不是 jsplugins")
        return tree
    except Exception as exc:
        print(f"解析 publish.xml 失败：{exc}")
        sys.exit(1)

tree = load_or_new(target_publish)
root = tree.getroot()

for child in list(root):
    if child.tag in ("jsplugin", "jspluginonline") and child.attrib.get("name") == plugin_name:
        root.remove(child)

if action == "install":
    try:
        source_tree = ET.parse(source_publish)
        for child in list(source_tree.getroot()):
            if child.tag in ("jsplugin", "jspluginonline") and child.attrib.get("name") == plugin_name:
                root.append(child)
    except Exception as exc:
        print(f"读取源 publish.xml 失败：{exc}")
        sys.exit(1)

os.makedirs(os.path.dirname(target_publish), exist_ok=True)
ET.indent(tree, space="  ")
tree.write(target_publish, encoding="utf-8", xml_declaration=True)
`
}
