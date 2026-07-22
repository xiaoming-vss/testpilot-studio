# TestPilot Studio

TestPilot Studio 是一个面向测试协作的前端工作台，用于围绕项目、迭代和需求管理测试资产与测试活动。

## 功能范围

- 项目、迭代、需求管理
- 功能测试集与测试用例维护
- API 自动化测试集、环境、用例、断言和运行报告
- UI 自动化测试集、步骤编排和运行配置
- AI 测试任务与 Skill 库入口
- 禅道连接管理与项目/迭代/需求绑定
- 登录态保护、项目切换、明暗主题切换

## 技术栈

- React 19
- TypeScript
- Vite 8
- Ant Design 6
- React Router 7
- TanStack React Query 5
- Zustand 5

## 本地开发

```bash
npm install
npm run dev
```

## 常用命令

```bash
npm run type-check
npm run lint
npm run build
npm run verify
```

说明：

- `npm run build` 会先执行 TypeScript 构建，再执行 Vite 构建。
- `npm run verify` 会依次执行 type-check、lint 和 build。

## 文档

- [功能文档](docs/functional-specification.md)
- [系统设计](docs/system-design.md)

## 本地文件约定

以下内容属于本地工具、运行产物或个人工作区，不应提交到仓库：

- `.agents/`
- `.codex/`
- `.trellis/`
- `.trae/`
- `AGENTS.md`
- `output/`
- `dist/`
- `node_modules/`
- `.env`
