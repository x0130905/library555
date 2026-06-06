# 超级无敌学习资料平台：GitHub + Netlify 后台版部署教程

这是一份新手向说明。照着做，你可以把这个 PDF 资料库部署到 Netlify，并通过网页后台 `/admin/` 修改分类和编辑资料信息。

## 先说结论

如果你只想让网站能打开，可以把 zip 拖到 Netlify。

但如果你想让 `/admin/` 后台保存修改，就不能只拖拽 zip。原因很简单：

- 拖拽部署只是把一份静态文件上传到 Netlify。
- 网页后台无法直接修改已经部署好的静态文件。
- 后台保存资料时，需要把改动提交到 GitHub。
- Netlify 再从 GitHub 自动重新部署。

所以后台版必须使用这个流程：

```text
本地项目 -> GitHub 仓库 -> Netlify 连接 GitHub -> 开启 Identity + Git Gateway -> /admin/ 后台保存
```

## 你最终会得到什么

- 学生通过邀请邮箱登录。
- 学生只能在线查看 PDF，没有下载按钮。
- 管理员可以邀请用户、设置角色。
- 管理员可以进入 `/admin/` 后台。
- 管理员可以修改分类、标题、简介、时间、大小、标签。
- PDF 文件先通过 GitHub 上传到 `public/pdfs/`，后台只填写 PDF 路径。这样可以避免 Git Gateway/Decap 上传二进制 PDF 后损坏。
- 保存后自动提交到 GitHub，并触发 Netlify 自动部署。
- 同一个邮箱账号同一时间只允许一台设备保持登录。新设备登录后，旧设备会自动退出。

如果某个 PDF 文件结构不标准，PDF.js 可能会报 `Bad XRef` 一类错误。本项目已加入兼容预览兜底：Canvas 渲染失败时，会自动切换到浏览器内置 PDF 预览。长期建议把这类 PDF 用 Adobe Acrobat、WPS、Chrome 打开后重新“另存为 PDF”再上传。

## 项目结构

项目根目录应该长这样：

```text
.
├── index.html
├── admin/
│   ├── index.html
│   └── config.yml
├── src/
│   ├── app.js
│   └── styles.css
├── data/
│   └── pdfs.json
├── public/
│   └── pdfs/
├── netlify/
│   └── functions/
│       ├── admin-users.js
│       ├── device-session.js
│       ├── pdf-data.js
│       ├── pdf-file.js
│       └── session-utils.js
├── README.md
└── netlify.toml
```

特别注意：上传到 GitHub 时，`index.html` 必须在仓库根目录，不要套一层多余文件夹。

正确：

```text
你的仓库/
├── index.html
├── admin/
├── src/
```

错误：

```text
你的仓库/
└── pdf-library-netlify/
    ├── index.html
    ├── admin/
    ├── src/
```

## 第 1 步：把项目上传到 GitHub

### 方法 A：用 GitHub 网页上传

适合新手。

1. 打开 [GitHub](https://github.com/)。
2. 登录账号。
3. 点击右上角 `+`。
4. 选择 `New repository`。
5. Repository name 填一个名字，例如：

```text
pdf-library
```

6. Public 或 Private 都可以。
7. 不要勾选 `Add a README file`，因为项目里已经有 README。
8. 点击 `Create repository`。
9. 进入新仓库后，点击 `uploading an existing file`。
10. 打开你本地项目文件夹。
11. 选中项目里面的所有文件和文件夹，而不是选中外层文件夹本身。
12. 拖到 GitHub 上传区域。
13. 等上传完成。
14. 点击 `Commit changes`。

上传完成后，你应该能在 GitHub 仓库首页看到：

```text
index.html
admin
src
data
public
netlify
netlify.toml
```

### 方法 B：用 GitHub Desktop

如果 PDF 文件比较大，GitHub 网页上传失败，可以安装 GitHub Desktop。

大概流程是：

1. 安装 GitHub Desktop。
2. 登录 GitHub。
3. `File -> Add local repository`。
4. 选择项目文件夹。
5. Commit。
6. Publish repository。

## 第 2 步：确认 GitHub 默认分支

打开你的 GitHub 仓库首页，左上方会显示当前分支，通常是：

```text
main
```

也可能是：

```text
master
```

打开 `admin/config.yml`，确认这里的分支一致：

```yml
backend:
  name: git-gateway
  branch: main
```

如果 GitHub 默认分支是 `master`，就改成：

```yml
backend:
  name: git-gateway
  branch: master
```

改完后提交到 GitHub。

## 第 3 步：在 Netlify 连接 GitHub 部署

不要使用拖拽部署。

请按下面做：

1. 打开 [Netlify](https://app.netlify.com/)。
2. 登录账号。
3. 进入 Team dashboard。
4. 点击 `Add new project`。
5. 选择 `Import an existing project`。
6. 选择 `GitHub`。
7. 按提示授权 Netlify 访问 GitHub。
8. 选择你刚才创建的 GitHub 仓库。
9. Build settings 这样填：

```text
Base directory: 留空
Build command: 留空
Publish directory: .
Functions directory: netlify/functions
```

项目里已经有 `netlify.toml`，正常情况下 Netlify 会自动识别这些设置。

本项目不需要安装额外 npm 依赖，Netlify 直接部署静态文件和 Functions 即可。

10. 点击 `Deploy` 或 `Publish`。
11. 等部署完成。

部署成功后，你会得到一个网址，例如：

```text
https://your-site-name.netlify.app
```

## 第 4 步：开启 Netlify Identity

进入你的 Netlify 站点后台：

1. 打开站点。
2. 找到 `Project configuration`。
3. 找到 `Identity`。
4. 点击启用 Identity。
5. Registration preference 选择：

```text
Invite only
```

这样只有收到邀请邮件的人才能注册。

## 第 5 步：开启 Git Gateway

这是 `/admin/` 后台能不能保存文件的关键。

进入：

```text
Project configuration -> Identity -> Services -> Git Gateway
```

然后点击：

```text
Enable Git Gateway
```

如果页面要求 GitHub 授权或 Access Token，按提示授权。

Git Gateway 需要访问你当前 Netlify 站点连接的 GitHub 仓库。开启后，Decap CMS 才能把后台修改提交到 GitHub。

## 第 6 步：邀请管理员账号

进入 Netlify 后台的 Identity 用户管理：

1. 找到 `Identity`。
2. 找到 `Users`。
3. 点击 `Invite users`。
4. 输入你的管理员邮箱。
5. 发送邀请。
6. 打开邮箱。
7. 点击邀请链接。
8. 设置密码。

## 第 7 步：给管理员添加 admin 角色

这一步很重要。没有 `admin` 角色，你能登录，但不能进入资料后台。

在 Netlify 后台：

1. 进入 `Identity -> Users`。
2. 点击你的管理员邮箱。
3. 找到用户详情里的角色或 metadata 设置。
4. 添加角色：

```text
admin
```

如果界面让你编辑 JSON metadata，可以设置成：

```json
{
  "roles": ["admin"]
}
```

如果你还需要普通学生账号，就给学生添加：

```text
learner
```

## 第 8 步：进入网站测试

打开你的 Netlify 网站：

```text
https://your-site-name.netlify.app
```

1. 点击登录。
2. 用管理员邮箱登录。
3. 登录后右上角应该看到：

```text
资料后台
用户管理
退出登录
```

4. 点击 `资料后台`。
5. 进入 `/admin/`。
6. 如果正常，会打开资料编辑后台。

## 单设备登录限制

本项目已经加入单设备登录限制：

- 每个邮箱账号只有一个当前有效设备会话。
- 如果同一个账号在新设备或新浏览器登录，新设备会成为有效设备。
- 旧设备会在下一次自动校验时退出，通常不超过 30 秒。
- 同一台设备的同一个浏览器打开多个标签页，一般不会互相踢出。
- 不同浏览器、无痕窗口、不同手机/电脑，会被视为不同设备会话。

这个功能使用 Netlify Identity 的用户元数据记录当前有效设备，不需要你自己搭数据库，也不需要额外安装依赖。相关函数是：

```text
netlify/functions/device-session.js
```

如果部署后设备限制不生效，请检查：

1. Netlify Identity 是否已开启。
2. 账号是否已经完成邀请注册并能正常登录。
3. Netlify Functions 是否能正常运行。

## 第 9 步：添加 PDF 的正确方式

为了避免后台上传 PDF 后文件损坏，不要在 Decap CMS 里直接上传 PDF 二进制文件。

正确流程是：

```text
先在 GitHub 上传 PDF -> 再到 /admin/ 填写资料信息和 PDF 路径
```

### 9.1 先在 GitHub 上传 PDF

1. 打开你的 GitHub 仓库。
2. 进入 `public/pdfs/` 文件夹。
3. 点击 `Add file`。
4. 选择 `Upload files`。
5. 上传你的 PDF 文件。
6. 点击 `Commit changes`。

建议 PDF 文件名使用英文、数字、短横线，例如：

```text
experiment-02-result.pdf
```

不要优先使用空格、特殊符号很多的文件名。

### 9.2 再到后台填写资料信息

进入 `/admin/` 后：

1. 点击 `资料库`。
2. 打开 `PDF 资料清单`。
3. 点击新增一条资料。
4. 填写：
   - ID
   - 标题
   - 分类
   - 简介
   - PDF 文件路径
   - 上传时间
   - 文件大小
   - 标签
5. 保存。

PDF 文件路径示例：

```text
public/pdfs/experiment-02-result.pdf
```

保存后后台会把资料信息写入 GitHub 的 `data/pdfs.json`。

然后 Netlify 会自动重新部署。等 1 到 3 分钟后，前台资料库会显示新资料。

## 常见错误：Git Gateway backend is not returning valid settings

如果 `/admin/` 出现红色提示：

```text
Your Git Gateway backend is not returning valid settings.
Please make sure it is enabled.
```

按这个顺序排查。

### 1. 你是不是拖拽 zip 部署的？

如果是拖拽部署，后台不能保存。

解决：

重新从 GitHub 仓库导入部署。

路径：

```text
Netlify -> Add new project -> Import an existing project -> GitHub
```

### 2. Netlify 站点有没有连接 GitHub 仓库？

进入 Netlify：

```text
Project configuration -> Build & deploy -> Continuous deployment -> Repository
```

这里应该能看到你的 GitHub 仓库。

如果没有，说明站点不是 GitHub 部署。

### 3. Identity 有没有开启？

进入：

```text
Project configuration -> Identity
```

确认 Identity 已启用。

### 4. Git Gateway 有没有开启？

进入：

```text
Project configuration -> Identity -> Services -> Git Gateway
```

确认 Git Gateway 已启用。

如果没有启用，点击 `Enable Git Gateway`。

### 5. Git Gateway 有没有 GitHub 权限？

如果你改过仓库权限、仓库从 public 改成 private，或者 GitHub 授权失效，Git Gateway 可能失效。

解决：

1. 到 Netlify 的 Git Gateway 设置里重新授权。
2. 或到：

```text
Project configuration -> Build & deploy -> Continuous deployment -> Repository
```

重新连接 GitHub 仓库。

### 6. 分支名是否一致？

打开 GitHub 仓库，看默认分支是 `main` 还是 `master`。

然后检查 `admin/config.yml`：

```yml
backend:
  name: git-gateway
  branch: main
```

如果 GitHub 是 `master`，这里必须改成：

```yml
backend:
  name: git-gateway
  branch: master
```

改完提交到 GitHub，等 Netlify 重新部署。

### 7. 是否给 Git Gateway 限制了角色？

Git Gateway 设置里可以限制哪些角色能使用后台。

如果你设置了只允许 `admin`，那你的 Identity 用户必须有 `admin` 角色。

如果不确定，可以先把 Git Gateway 的 Roles 留空，等后台能打开后再限制。

## 常见错误：登录了但没有资料后台按钮

原因：当前用户没有 `admin` 角色。

解决：

1. 去 Netlify 后台。
2. 打开 `Identity -> Users`。
3. 找到你的邮箱。
4. 添加 `admin` 角色。
5. 退出网站。
6. 重新登录。

## 常见错误：后台保存了，但前台没变化

按顺序检查：

1. GitHub 仓库里 `data/pdfs.json` 有没有变。
2. GitHub 仓库里 `public/pdfs/` 有没有新 PDF。
3. Netlify 有没有自动开始新部署。
4. Netlify 最新部署是否成功。
5. 等 1 到 3 分钟后刷新前台。

如果浏览器缓存比较顽固，可以强制刷新：

```text
Windows: Ctrl + F5
Mac: Command + Shift + R
```

## 常见错误：PDF 在线查看失败

检查：

1. `data/pdfs.json` 里的 `fileUrl` 是否正确。
2. PDF 是否真的存在于 `public/pdfs/`。
3. 文件名是否包含奇怪符号。
4. 建议 PDF 文件名使用英文、数字、短横线，例如：

```text
chapter-01.pdf
```

不要优先使用：

```text
第 一 章 #最终版!!.pdf
```

中文文件名通常也能用，但英文更稳。

## 常见错误：后台上传 PDF 后内容损坏或乱码

这通常是 Git Gateway/Decap CMS 处理 PDF 二进制上传时不稳定导致的。

本版本已经改成更稳定的方式：

- 不在后台直接上传 PDF。
- 先到 GitHub 仓库的 `public/pdfs/` 上传真实 PDF 文件。
- 再到 `/admin/` 后台填写 `public/pdfs/文件名.pdf`。

如果你已经通过旧后台上传过损坏 PDF，请删除 GitHub 里对应的损坏文件，然后重新用 GitHub 网页上传原始 PDF。

## 重要文件说明

### `admin/config.yml`

这是后台配置文件。当前关键配置：

```yml
backend:
  name: git-gateway
  branch: main
```

如果你的 GitHub 默认分支不是 `main`，一定要改。

### `data/pdfs.json`

这是资料清单。后台保存时会修改它。

结构示例：

```json
{
  "pdfs": [
    {
      "id": "chapter-01",
      "title": "第一章学习资料",
      "category": "理论力学",
      "description": "这份资料的简短说明。",
      "fileUrl": "public/pdfs/chapter-01.pdf",
      "uploadDate": "2026-06-06",
      "size": "2.4 MB",
      "tags": ["理论力学", "第一章"]
    }
  ]
}
```

### `public/pdfs/`

这里存放 PDF 文件。

### `netlify.toml`

这里告诉 Netlify：

- 网站从当前目录发布。
- 函数目录是 `netlify/functions`。
- 把 `data/pdfs.json` 和 `public/pdfs/**` 打包进函数。
- 阻止用户直接访问原始 PDF 和 JSON。

## 官方文档参考

- Netlify 从 Git 仓库部署：<https://docs.netlify.com/start/quickstarts/deploy-from-repository/>
- Netlify Git Gateway：<https://docs.netlify.com/manage/security/secure-access-to-sites/git-gateway/>
- Decap CMS Git Gateway：<https://decapcms.org/docs/git-gateway-backend/>

备注：Netlify 官方文档说明 Git Gateway 已经进入 deprecated 状态，但对已启用站点仍可继续使用。如果你的 Netlify 后台完全找不到 Git Gateway 入口，说明你的账号或新站点可能已经不适合继续走这条路线，后续需要换成 GitHub OAuth 后台或其他 CMS 方案。
