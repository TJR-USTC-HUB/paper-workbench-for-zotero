# Paper Workbench for Zotero

[English](README.md)

一个面向专注论文阅读的非官方、跨平台 Zotero 插件：在三栏 PDF 工作台中集成自动划词翻译、笔记和兼容 OpenAI 的 AI 对话。

> [!IMPORTANT]
> 这是非官方社区项目，与 Zotero、OpenAI 及其维护者不存在隶属、背书或官方合作关系。

[下载最新 XPI](https://github.com/TJR-USTC-HUB/paper-workbench-for-zotero/releases/latest) ·
[报告问题](https://github.com/TJR-USTC-HUB/paper-workbench-for-zotero/issues)

## 功能概览

阅读器固定为三个互不重叠的区域：

```text
PDF 论文 | 划词翻译 | 笔记 + AI 对话
```

- **可调整的三栏工作台**：拖动两条竖向边界，以及笔记与对话之间的横向边界；尺寸会在下次打开时恢复。
- **自动划词翻译**：在 PDF 中选中文字，中间栏自动显示大字号中文译文。
- **专注笔记**：选择已有子笔记或创建新笔记。切换或关闭前自动保存；关闭笔记后，对话占满右栏。
- **严格选区问答**：只依据当前 PDF 选区和本次问题回答。专注模式不会附加全文、附近段落、旧对话、联网搜索、工具结果或其他 Zotero 条目。
- **简洁对话格式**：用户问题在右侧，AI 回答在左侧；翻译栏和对话栏共用暖米白/陶土色调，没有绿色气泡。
- **端点优先配置**：登录时只输入 Base URL 和 API Key。插件通过 `/models` 自动发现模型并验证连接，发送前可选择模型和支持的思考强度。

## 兼容性

| 项目         | 支持范围                                                                 |
| ------------ | ------------------------------------------------------------------------ |
| 操作系统     | Windows、macOS、Linux                                                    |
| Zotero       | 7–10                                                                     |
| 核心 AI 模式 | 兼容 OpenAI 的 API                                                       |
| 接口要求     | Bearer Key、`GET /models`，以及兼容 Responses 或 Chat Completions 的接口 |

核心三栏阅读模式不需要 Node.js，也不需要额外浏览器。
可选的原生“窗口置顶”辅助功能目前只支持 Linux，并依赖 `wmctrl`；这不影响停靠在 Zotero 阅读器中的三栏工作台。

## 安装

Windows、macOS 和 Linux 使用相同的安装方法：

1. 从 [GitHub Releases](https://github.com/TJR-USTC-HUB/paper-workbench-for-zotero/releases/latest) 下载 `paper-workbench-for-zotero.xpi`。
2. 在 Zotero 中打开 **工具 → 插件**。
3. 打开齿轮菜单，选择 **从文件安装插件…**。
4. 选择下载的 `.xpi`；如 Zotero 提示，请重新启动。
5. 打开任意 PDF 附件，阅读器中会显示论文、翻译和工作区三栏。

更新时直接安装新版 XPI 覆盖旧版本；如有提示，重新启动 Zotero。

## 首次登录

第一次打开时默认处于未登录状态。右栏只要求填写：

- **Base URL**：兼容 OpenAI 服务的接口地址，例如其 `/v1` 地址。
- **API Key**：该服务签发的访问凭证。

登录页没有模型 ID 输入框。点击 **登录** 后，插件会：

1. 请求端点的 `/models` 列表；
2. 如果列表包含 `gpt-6.1-sol`，优先选择它；否则选择返回的第一个模型；
3. 验证所选模型可以正常响应；
4. 将端点、密钥、已发现模型和登录状态保存在当前本机 Zotero 配置中。

登录后，输入框上方会出现模型和思考强度选择。可用档位取决于当前模型，可能包括 `low`、`medium`、`high`、`xhigh` 和 `max`。

点击 **退出登录** 会停止活动请求，清除已保存的 API Key 和当前模型选择，并让 AI 栏与翻译栏一起恢复到未登录状态。

## 日常使用

### 翻译选区

1. 在 PDF 中选中英文句子或段落。
2. 中间栏会自动翻译。
3. 选择另一段文字即可替换原文和译文。

未登录时不会发起翻译请求。

### 询问选区

1. 在 PDF 中准确选择需要解释的原文。
2. 可在输入框上方选择模型和思考强度。
3. 直接发送默认解释请求，或输入只针对该选区的问题。
4. 在左侧回答气泡中阅读结果。

没有实时 PDF 选区时，发送按钮保持禁用，避免误发其他内容。

### 使用笔记

1. 点击右栏工具条中的 **笔记**。
2. 选择已有笔记，或点击 **新建笔记**。
3. 在对话上方编辑笔记。
4. 完成后点击 **关闭笔记**。插件会先保存，再关闭笔记区域，并让对话占满整列。

## 数据与隐私

- API Key 保存在当前本机 Zotero 配置中，不会写入源码、XPI 或 Release 源码包。
- 划词翻译会把当前选中文字发送到你配置的模型端点。
- 专注对话只发送当前选区和本次问题。旧消息会在本地显示，但不会附加到下一次专注请求。
- Zotero 笔记和文库数据仍由 Zotero 管理。
- 本机配置文件和配置备份可能包含凭证，请勿发布或分享。

使用前请查看所配置模型服务的隐私政策和数据保留条款。

## 卸载

1. 如果希望插件清除已保存的 API Key，请先退出登录。
2. 在 Zotero 中打开 **工具 → 插件**。
3. 打开本插件的菜单，选择 **移除**。
4. 如有提示，重新启动 Zotero。

移除插件不会删除 Zotero 文库或 Zotero 笔记。

## 开发

开发环境需要 Node.js 22 和 npm。

```bash
git clone https://github.com/TJR-USTC-HUB/paper-workbench-for-zotero.git
cd paper-workbench-for-zotero
npm ci
npm test
npm run build
```

构建结果位于 `.scaffold/build/`。不要提交 `.env`、Zotero 配置目录、API Key 或生成的构建目录。

项目使用 Windows、macOS、Linux 三平台 CI 矩阵进行测试和构建冒烟检查；平台无关的 Release XPI 只打包一次。

## 许可证与上游项目

Paper Workbench for Zotero 派生自 [xuhan-rgb/zotero-ai-sidebar](https://github.com/xuhan-rgb/zotero-ai-sidebar)。本项目保留上游许可证和版权信息，并继续以 [AGPL-3.0-or-later](LICENSE) 发布。详细作者信息可查看 Git 历史和项目文件；向本仓库提交的贡献同样按该许可证发布。
