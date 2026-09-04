# 🔐 Situla Auth 2.0

<p align="center">
  <strong>🌐 <a href="README.md">English</a> | 简体中文</strong>
</p>

<p align="center">
  <a href="https://github.com/Aquarius-Situla/Situla-auth/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-AGPL%203.0-blue?style=flat&logo=open-source-initiative" alt="License">
  </a>&nbsp;&nbsp;
  <a href="https://nodejs.org/">
    <img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=flat&logo=node.js" alt="Node.js">
  </a>&nbsp;&nbsp;
  <a href="https://www.docker.com/">
    <img src="https://img.shields.io/badge/Docker-已支持-2496ED?style=flat&logo=docker" alt="Docker">
  </a>&nbsp;&nbsp;
  <a href="https://nginxproxymanager.com/">
    <img src="https://img.shields.io/badge/NPM-Forward_Auth-009639?style=flat&logo=nginx" alt="Nginx Proxy Manager">
  </a>&nbsp;&nbsp;
  <a href="https://fidoalliance.org/">
    <img src="https://img.shields.io/badge/WebAuthn-Passkeys%20%26%20FIDO2-FF6B00?style=flat" alt="WebAuthn">
  </a>&nbsp;&nbsp;
  <a href="https://openid.net/developers/how-connect-works/">
    <img src="https://img.shields.io/badge/OIDC-认证中心-F78C40?style=flat&logo=openid" alt="OIDC">
  </a>
</p>

<p align="center">
  极简、轻量（<strong>&lt;50MB 内存</strong>）的苹果设计风格（Apple HIG）单用户个人身份认证门户与原生 OpenID Connect (OIDC) 认证服务中心。支持 Passkey (WebAuthn) 生物识别无密登录、硬件 FIDO2 密钥、AES 加密 TOTP 双因子、平滑密码显隐交互，并内置可视化的 Nginx Proxy Manager (NPM) 联动配置生成器。
</p>

---

## 💡 为什么选择 Situla Auth？ (开发初衷)

像 **authentik** 或 **Keycloak** 这样成熟的企业级身份认证方案功能极为强大，但它们的资源消耗往往非常庞大——通常需要 **2GB 以上内存** 才能平稳运行。

**Situla Auth** 专为 **极端低配服务器**（例如 512MB–1GB 内存的轻量云 VPS）、自建 Homelab 爱好者以及个人单用户场景量身打造，在保证安全性的同时追求极致的极简与轻盈：

- **极致低内存占用**：生产环境下常驻内存仅需 **30MB 至 50MB**。
- **零沉重外部依赖**：基于 Node.js、Express 与内置嵌入式 SQLite 引擎，开箱即用，自动执行零停机数据迁移与热备。
- **专为单用户安全护航**：剔除企业级多租户与复杂权限树的冗余层级，专注守护个人反向代理后端与自建应用。

> [!NOTE]
> 对于大型企业、多租户团队或需要对接复杂 LDAP/Active Directory 体系的生产场景，依然建议采用 [authentik](https://goauthentik.io/) 等重型企业级方案。

---

## ✨ 核心特性

### 🔑 现代生物识别与无密码登录
- **Passkey (WebAuthn) 凭证登录**：支持 Face ID、Touch ID、Windows Hello 及 Android 原生通行密钥，无需输入密码，指纹或面容一触即达。
- **FIDO2 硬件双因子安全密钥**：支持物理硬件防钓鱼双因子认证（如 YubiKey、Nitrokey 等，支持 `residentKey` 首选偏好）。
- **TOTP 身份验证器应用**：支持 Google Authenticator、Apple 钥匙串、1Password、Bitwarden 等所有标准 TOTP 客户端。
- **Bcrypt 一次性应急恢复码**：防止验证器丢失的高强度单次使用备份密钥。

### 🌐 Forward Auth 与内置可视化 NPM 配置生成器
- **反向代理认证卫士**：通过高效轻巧的 `/verify` 端点，与 Nginx Proxy Manager (NPM) 无缝配合，保护所有下游服务。
- **后台内置交互式 NPM 生成器**：管理员控制台内置可视化配置向导。支持按需一键生成网页基础防护（Web Protection）、用户名单点登录（Username SSO）、邮箱单点登录（Email SSO）、自定义免认证放行路径（API Bypass）以及 Tor 隐藏服务 Onion-Location 标头，彻底免去手工编辑 Nginx 配置文件的繁琐。

### 🆔 原生 OIDC Provider (OpenID Connect 身份认证中心)
- **标准化 IdP 协议**：严格遵循 OpenID Connect 标准，支持高安全级的 PKCE 授权码模式（Authorization Code Flow with PKCE）。
- **零配置密钥自动生成**：首次启动自动生成生产级 RSA JWKS 签名密钥对并持久化。
- **无缝对接主流开源应用**：直接作为 Grafana、Gitea、Nextcloud、Jellyfin 等应用的单点登录后端。
- **可视化客户端管理**：可在控制台直接查看、新增、管理已登记的 OIDC 客户端应用凭据。

### 🎨 典雅的 Apple Human Interface 视觉与交互
- **纯正 Apple HIG 风格**：原生级 iOS/macOS 视觉系统，矢量 SF 风格线性图标，自适应深色/浅色外观。
- **全局统一 3px 苹果微光晕**：输入框与所有模态弹窗统一采用精致的 3px 微光晕（`0 0 0 3px rgba(0, 113, 227, 0.15)`），告别粗暴的大面积阴影。
- **单卡片渐进式展开与密码显隐**：Apple ID 经典单卡片折叠交互，集成原生线性小眼睛切换按钮（动态切换明密文）；
- **移动触控防跳动优化**：展开密码框时取消强硬的强制抢焦，杜绝手机端虚拟键盘猛烈顶起界面的抖动。

### 🔒 纵深防御与隐私安全体系
- **Sudo 敏感操作提权校验**：修改密码、注销 2FA、重置恢复码等高危操作时，需通过独立的 Sudo 弹窗二次核验主密码。
- **不受信重定向安全拦截**：内置苹果风格警告页（`warning.html`），拦截非信任域名列表外的 `?rd=` 重定向请求，彻底杜绝钓鱼式开放重定向利用。
- **恒定时间密码比对**：内置 Bcrypt 虚拟哈希比对，防范针对用户名的计时侧信道枚举攻击。
- **静态数据 AES-256-GCM 强加密**：TOTP 密钥种子与敏感信息落盘时全量进行 AES-256-GCM 密文存储并校验认证标签。
- **隐私保护邮箱掩码**：接口对邮箱信息进行严格脱敏处理（如 `si*****@corp.internal`），保护隐私。
- **安全审计日志**：自动记录登录活动、访问 IP、User-Agent、认证状态与安全事件，随时随地在后台检索。
- **会话瞬时吊销缓存**：通过实时内存缓存校验 `token_version` 与 JTI 黑名单，退出登录即刻全网失效。

### 🌍 严格对称的双语国际化体系
- **动态无缝语言切换**：支持英文（`en-US`）与简体中文（`zh-CN`）自由切换。
- **100% 对称字典架构**：240+ 词条实现严格一对一精准映射，支持事件驱动的组件级响应式重渲染。

---

## 📁 工程目录与架构全景

```text
situla-auth/
├── core/                           # 核心基础设施层
│   ├── crypto.js                   # AES-256-GCM 加密引擎、密钥强度核验与随机序列生成
│   └── database.js                 # SQLite 引擎、数据表热迁移与自动化热备接口
├── services/                       # 核心业务逻辑服务层
│   ├── authService.js              # 用户认证、Bcrypt 比对与 JWT 令牌签发
│   ├── accountService.js           # 个人账户维护、密码修改、邮箱绑定与隐私脱敏
│   ├── webauthnService.js          # WebAuthn Passkey 注册与认证逻辑 (SimpleWebAuthn v9)
│   ├── totpService.js              # TOTP 密钥生成、二维码渲染与 AES 密文存储
│   ├── recoveryService.js          # 一次性应急恢复码生成与 Bcrypt 校验
│   ├── oidcService.js              # OpenID Connect 客户端发现元数据与应用授权
│   └── auditService.js             # 登录与安全事件审计日志记录服务
├── routes/                         # 模块化 RESTful API 路由
│   ├── auth.js                     # 登录、登出、会话状态与 Sudo 提权端点
│   ├── account.js                  # 账户资料与凭据更新端点
│   ├── passkey.js                  # Passkey 注册与认证挑战端点
│   ├── fido2.js                    # FIDO2 硬件双因子密钥挑战端点
│   ├── totp.js                     # TOTP 动态码设置、验证与开关端点
│   ├── recovery.js                 # 应急恢复码生成与核验端点
│   ├── oidc-clients.js             # OIDC 客户端管理端点
│   └── logs.js                     # 审计日志拉取端点
├── middleware/                     # 中间件层
│   └── auth.js                     # JWT 令牌认证、Sudo 提权核验与版本吊销拦截
├── public/                         # 前端单页应用与静态资源 (Apple HIG 规范)
│   ├── index.html                  # 登录门户（折叠卡片、小眼睛切换、Passkey 无密）
│   ├── admin.html                  # 管理控制台（账户、2FA、NPM 生成器、OIDC、日志）
│   ├── 2fa.html                    # 独立 2FA 二次验证挑战页
│   ├── warning.html                # 不受信重定向拦截与提示页
│   ├── css/                        # 模块化 CSS 架构 (CSS Design Tokens)
│   │   ├── tokens.css              # 全局设计变量（主题配色、3px 微光晕、过渡动画）
│   │   ├── base.css / layout.css   # 全局样式重置与响应式栅格布局
│   │   └── components/             # 独立解耦组件样式（modals, forms, npm-generator 等）
│   ├── js/                         # ES 模块与前端驱动逻辑
│   │   ├── modules/                # 业务解耦模块 (ui, api, npm-generator, oidc, fido2 等)
│   │   └── login.js / admin.js     # 各页面编排入口脚本
│   ├── i18n/                       # 国际化语言系统
│   │   ├── i18n.js                 # 双向国际化解析引擎与事件总线
│   │   └── locales/                # 严格对称的多语言词条包 (en-US, zh-CN)
│   └── assets/                     # 矢量矢量图标与品牌标识 (SVG)
├── tests/                          # 自动化测试与持续集成门禁
│   ├── smoke-test.js               # 核心业务容器内冒烟校验脚本
│   └── docker-smoke-test.sh        # 外部黑盒基础设施健康探针
├── deploy.sh                       # 工业级一键生产部署、数据热备与平滑重启运维脚本
├── Dockerfile                      # 轻量化生产 Docker 镜像定义
├── docker-compose.yml              # 生产容器网络与卷编排定义
├── server.js                       # Node.js Express 根入口与服务组装
└── oidc.mjs                        # 原生 OIDC Provider 协议引擎
```

---

## 🚀 快速上手部署

### 方案 1：自动化一键部署（强烈推荐）

Situla Auth 自带工业级自动化部署脚本（`deploy.sh`），涵盖依赖自动补全、Docker 专用网络探测与创建、环境配置交互式引导、SQLite 数据库无缝热备、镜像平滑重构以及双层黑白盒冒烟健康门禁：

```bash
# 1. 克隆代码仓库并进入目录
git clone https://github.com/Aquarius-Situla/Situla-auth.git
cd Situla-auth

# 2. 运行一键部署脚本
bash deploy.sh
```

首次运行该脚本时，将自动弹出配置向导引导您补充基础参数。

### 方案 2：标准 Docker Compose 手动部署

```bash
# 1. 复制并调整环境变量文件
cp .env.example .env
nano .env

# 2. 创建 SQLite 数据挂载持久化目录
mkdir -p data

# 3. 构建并启动容器
docker compose up -d --build
```

---

## ⚙️ 环境变量配置指南 (`.env`)

在 `.env` 文件中配置以下核心参数：

| 环境变量名 | 必填 | 默认值 | 详细说明 | 示例值 |
|---|:---:|---|---|---|
| `ADMIN_USER` | **是** | `admin` | 管理员初始用户名 | `admin` |
| `ADMIN_PASS` | **是** | — | 管理员初始登录密码 | `YourStrongPasswordHere` |
| `COOKIE_DOMAIN` | **是** | `.example.com` | 会话 Cookie 作用泛域名（必须以 `.` 开头） | `.example.com` |
| `RP_ID` | **是** | `auth.example.com` | WebAuthn Relying Party ID（认证主域名，无协议头） | `auth.example.com` |
| `TRUSTED_DOMAINS` | 否 | — | 允许重定向跳转的额外合法根域名（以半角逗号分隔） | `app.example.com,b.org` |
| `PORT` | 否 | `3000` | 容器内部监听端口 | `3000` |
| `JWT_SECRET` | 自动 | *(首次自动生成)* | 用于签名会话 Cookie 的 256 位安全密钥 | *(留空即可)* |
| `ENCRYPTION_KEY`| 自动 | *(首次自动生成)* | 用于 TOTP 密文落盘的 256 位 AES 密钥 | *(留空即可)* |
| `OIDC_JWKS` | 自动 | *(首次自动生成)* | 用于 OIDC 令牌签名的 RSA 密钥对 | *(留空即可)* |
| `OIDC_ISSUER` | 否 | `https://<RP_ID>` | OIDC 元数据发现端点公布的颁发者 URL | `https://auth.example.com` |
| `OIDC_CLIENTS` | 否 | `[]` | 预先登记的 OIDC 客户端应用列表 JSON | *(可通过管理界面配置)* |
| `SMTP_HOST` | 否 | — | 可选 SMTP 邮件发送服务器地址 | `smtp.example.com` |
| `SMTP_PORT` | 否 | `465` | SMTP 邮件服务器端口 | `465` |
| `SMTP_USER` | 否 | — | SMTP 账号邮箱地址 | `noreply@example.com` |
| `SMTP_PASS` | 否 | — | SMTP 账号密码或应用授权码 | `secret` |

> [!TIP]
> `JWT_SECRET`、`ENCRYPTION_KEY` 和 `OIDC_JWKS` 会在系统首次启动时自动生成并安全持久化，您完全无需手动计算。

---

## 🌐 信任重定向安全域机制 (`?rd=`)

用户访问受保护服务触发拦截后，Situla Auth 会通过 `?rd=` 参数安全记住原本请求的地址，并在认证成功后平滑回跳：

1. **自动信任根**：
   - 您的 `COOKIE_DOMAIN`（如 `*.example.com`）与 `RP_ID`（如 `auth.example.com`）已被系统自动纳入安全信任根，其下的所有子域名均可直接跳转。
2. **扩展信任根 (`TRUSTED_DOMAINS`)**：
   - 若您拥有多个独立主域名需要集中认证，只需在 `.env` 中声明：`TRUSTED_DOMAINS=company.internal,partner.org`。其下所有子域名即可自动受信任。
3. **防钓鱼拦截提示**：
   - 一旦跳转目标不在信任根范围内，系统将立即阻断并导航至 **不受信重定向警告页**（`warning.html`），向用户揭示目标真实域名并提供管理员加白指引，彻底拦截恶意钓鱼跳转。

---

## 🛡️ Nginx Proxy Manager (NPM) 反向代理集成

### 使用内置可视化生成器（强烈推荐）

Situla Auth 在管理控制台内置了交互式的 **NPM 配置生成器**：

1. 登录 Situla Auth 管理后台（`https://auth.example.com/admin`）；
2. 点击顶部导航栏的 **NPM 生成器**；
3. 选择所需的保护方案：
   - **基础网页保护**：仅阻断未登录访客，不向后端应用传递身份标头；
   - **用户名 SSO**：自动向下游应用注入 `Remote-User` 标头（适用于按用户名匹配的 FreshRSS、Audiobookshelf 等）；
   - **邮箱 SSO**：自动向下游应用注入 `Remote-Email` 标头（适用于按邮箱匹配的 Beszel、Grafana 等）；
4. 按需填写免认证放行路径（如 Webhook、API 等）或 Onion 暗网地址；
5. 点击 **复制配置**，直接粘贴至 NPM 代理主机的 **Advanced**（高级配置）选项卡中即可！

### 手工配置核心 Nginx 参考代码块

若您习惯手工书写 Nginx 配置，可将以下基础骨架粘贴至 NPM Proxy Host 的 **Advanced** 中：

```nginx
# 1. 定义 Forward Auth 内部核验路由
location /_auth {
    internal;
    proxy_pass http://situla-auth:3000/verify;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    proxy_set_header X-Original-URI $request_uri;
}

# 2. 捕获 401 鉴权失败并携带原本 URL 重定向至登录界面
error_page 401 = @error401;
location @error401 {
    return 302 https://auth.example.com/?rd=https://$http_host$request_uri;
}

# 3. 守护主服务入口
location / {
    auth_request /_auth;

    proxy_pass $forward_scheme://$server:$port;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

> [!IMPORTANT]
> 确保 `situla-auth` 容器与 Nginx Proxy Manager 容器挂载在相同的外部 Docker 网络下（例如 `npm_default`），以保证 NPM 能够正常通过容器名访问 `http://situla-auth:3000`。

---

## 🔐 OIDC Provider (OpenID Connect 认证接入)

Situla Auth 内置原生 OIDC Provider，支持高安全标准的 PKCE 授权码模式。

### 发现端点 (Discovery Endpoint)
部署成功后，元数据端点位于：
```
https://<your-auth-domain>/oidc/.well-known/openid-configuration
```

### 支持的 Scopes 与 Claims
- `openid`：`sub`（唯一用户标识）
- `profile`：`preferred_username`、`name`
- `email`：`email`、`email_verified`

### 接入第三方应用示例

您可在管理后台的 **OIDC 管理** 弹窗中可视化登记客户端，或直接在 `.env` 中通过 `OIDC_CLIENTS` 配置。

**Grafana 接入配置示例** (`grafana.ini`)：
```ini
[auth.generic_oauth]
enabled = true
name = Situla Auth
client_id = grafana
client_secret = your-client-secret
scopes = openid profile email
auth_url = https://auth.example.com/oidc/auth
token_url = https://auth.example.com/oidc/token
api_url = https://auth.example.com/oidc/userinfo
```

---

## 🔄 运维更新与数据持久化

### 更新生效规则

| 修改内容 | 所需执行的命令 |
|---|---|
| 仅修改 `.env` 环境变量配置 | `docker compose restart` |
| 修改前端或服务端源码（`public/`, `services/`, `server.js` 等） | `docker compose up -d --build` |
| 运行完整发布、热备与双层冒烟检查 | `bash deploy.sh` |

> [!WARNING]
> 由于静态前端资源（`public/`）与依赖库在构建时已被编译进容器镜像，单纯的 `restart` 只会重置进程，不会重新拉取文件。在修改任何代码文件后，务必使用 `docker compose up -d --build` 或 `bash deploy.sh`。

### 数据存储与热备机制

- **持久化挂载**：SQLite 数据库持久保存在宿主机的 `./data/database.sqlite` 中，映射至容器内 `/app/data`，镜像重建或升级绝不会丢失数据。
- **自动快照热备**：每次执行 `bash deploy.sh` 时，部署管线均会自动对现有数据库生成带时间戳的热备快照（如 `./data/database.sqlite.bak_YYYYMMDD_HHMMSS`），确保无论发生任何意外皆可瞬时回滚。

---

## 📄 开源许可证

本项目基于 **AGPL-3.0 License** 开源。详情请参阅 [LICENSE](LICENSE) 文件。
