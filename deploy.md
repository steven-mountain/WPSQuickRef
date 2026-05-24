# 在线部署说明

本项目可以通过 HTTPS 静态服务器发布为在线 WPS 加载项。在线方式更适合跨平台分发，尤其是 macOS 环境。

## 构建

```bash
npm install
npm run build
```

构建产物位于：

```text
dist/
```

`dist/` 应包含：

- `index.html`
- `ribbon.xml`
- `manifest.xml`
- `assets/`
- `images/`
- 其他 Vite 生成的资源文件

## 部署要求

- 必须使用 HTTPS，或使用 WPS 允许的内网可信地址。
- 静态服务器必须能直接访问 `ribbon.xml`。
- 推荐路径以 `/` 结尾，例如：

```text
https://example.com/wps-ref-manager/
```

部署后应能访问：

```text
https://example.com/wps-ref-manager/ribbon.xml
https://example.com/wps-ref-manager/index.html
```

## Nginx 示例

```nginx
server {
  listen 443 ssl;
  server_name example.com;

  root /var/www/wps-ref-manager;
  index index.html;

  location /wps-ref-manager/ {
    try_files $uri $uri/ /wps-ref-manager/index.html;
  }
}
```

将 `dist/` 内文件上传到：

```text
/var/www/wps-ref-manager/
```

## GitHub Pages

1. 将 `dist/` 内容发布到 GitHub Pages 分支或目录。
2. 确认 Pages 地址可访问 `ribbon.xml`。
3. 使用 `wpsjs publish -s https://<user>.github.io/<repo>/` 生成发布入口。

## Cloudflare Pages

1. 构建命令：`npm run build`
2. 输出目录：`dist`
3. 部署完成后确认 `https://<project>.pages.dev/ribbon.xml` 可访问。

## 对象存储 / 公司内网服务器

可将 `dist/` 上传到 OSS、COS、S3 或公司内网静态文件服务。注意：

- MIME 类型需要正确返回 XML、HTML、JS、CSS。
- 如果 WPS 客户端无法访问公网，请使用公司内网 HTTPS 地址。
- 更新版本时直接替换 `dist/` 内容，用户重新打开 WPS 后加载新资源。

## wpsjs publish

项目保留官方在线发布命令：

```bash
npm run publish -- -s https://example.com/wps-ref-manager/
```

该命令会生成 WPS 官方流程使用的发布入口文件。离线包不依赖 `wpsjs publish`。
