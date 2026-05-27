# TestPilot Studio 当前设计文档

## 1. 文档目的

本文档描述 `testpilot-studio` 在 2026-05-26 这次整理后的当前前端架构状态，重点说明：

- 应用当前的实际分层
- 运行入口与模块边界
- 本次清理删除的无用代码
- 新提取的公共方法
- 后续继续优化的建议

本文档记录的是“当前实现”，不是长期规划。长期演进方向仍以 [project-structure-optimization-plan.md](/D:/GitCloneData/testpilot-studio/docs/project-structure-optimization-plan.md) 为准。

## 2. 当前架构总览

当前 `src` 目录已经基本稳定在三层结构：

```text
src/
  app/        应用装配层：入口、路由、布局、Provider、全局样式
  features/   业务模块层：按业务域组织页面、组件、接口、状态、工具
  shared/     共享层：跨模块复用组件、请求能力、常量、store、utils
  services/   业务 API 聚合出口
  utils/      兼容保留的通用工具，后续可继续向 shared 收口
```

这套结构已经不再依赖旧的 `src/pages`、`src/components`、`src/store` 兼容壳目录，目录表达与运行关系现在是一致的。

## 3. 运行入口

当前实际启动链路如下：

```text
index.html
  -> src/main.tsx
  -> src/app/main.tsx
  -> src/app/App.tsx
  -> src/app/router/routes.tsx
  -> src/app/layouts/AppShell.tsx
```

分层职责如下：

- `src/main.tsx`：保留为 Vite 默认入口，仅负责转发到 `app/main`
- `src/app/main.tsx`：装配 React Root、Router、React Query、全局样式
- `src/app/App.tsx`：装配主题和顶层路由
- `src/app/router/routes.tsx`：登录页与受保护工作台路由分流
- `src/app/layouts/AppShell.tsx`：工作台布局、一级导航、项目选择、业务子路由

## 4. 模块边界

### 4.1 `app`

`app` 只负责装配，不直接承载具体业务实现。

- `layouts/AppShell.tsx`：应用壳与工作台导航
- `providers/*`：查询与主题 Provider
- `router/*`：路由与鉴权守卫
- `styles/*`：应用级样式入口、布局样式、主题样式

### 4.2 `features`

`features` 按业务域组织代码，当前主要模块包括：

- `auth`
- `projects`
- `requirements`
- `api-automation`
- `ui-automation`
- `test-cases`
- `ai-testing`
- `profile`
- `testing`
- `base-services`

每个模块内部按需要继续拆分为 `api / components / hooks / pages / styles / store / utils / types`。

### 4.3 `shared`

`shared` 负责跨模块复用能力，当前包含：

- `shared/api/request.ts`：统一请求基础设施
- `shared/components/*`：跨模块组件
- `shared/constants/*`：模板函数等共享常量
- `shared/store/*`：跨模块共享状态
- `shared/utils/*`：跨模块工具方法

## 5. 本次整理内容

### 5.1 删除的无用代码文件

本次删除的是“迁移完成后仍残留、且已无任何有效引用”的兼容壳文件，主要包括：

- 旧页面壳：`src/pages/*.tsx`
- 旧组件壳：`src/components/*.tsx`
- 旧 store 壳：`src/store/*.ts`
- 已未接入的 `src/shared/components/AppHeaderContext.tsx`
- 已无实际用途的 `src/App.tsx`

删除后带来的收益：

- 顶层目录不再同时存在“真实实现”和“历史转发壳”
- 新同学查看代码时能直接定位到真实业务实现
- 降低后续继续迁移时误改旧入口、误加新壳层的概率

### 5.2 引用收口

原先部分页面仍通过旧路径访问真实实现，例如：

- `@/components/TextCodeEditor`
- `@/components/JsonEditor`
- `@/store/workbench`
- `../components/EntityDrawers`

本次已统一改为直接引用真实模块位置，例如：

- `@/shared/components/TextCodeEditor/TextCodeEditor`
- `@/shared/components/JsonEditor/JsonEditor`
- `@/features/projects/store/workbench.store`
- 直接引用对应 feature 内组件类型

### 5.3 提取的公共方法

本次新增了三个共享工具文件：

- [src/shared/utils/array.ts](/D:/GitCloneData/testpilot-studio/src/shared/utils/array.ts)
- [src/shared/utils/value.ts](/D:/GitCloneData/testpilot-studio/src/shared/utils/value.ts)
- [src/shared/utils/payload.ts](/D:/GitCloneData/testpilot-studio/src/shared/utils/payload.ts)

具体收口内容如下：

- `moveArrayItem`
  之前在 `api-automation` 与 `ui-automation` 中各自实现了一份，现统一收敛到 `shared/utils/array.ts`
- `parseMaybeJsonValue / prettyPrintValue / formatOptionalValue`
  之前分散在功能模块工具中，现统一抽到 `shared/utils/value.ts`
- update payload 差异赋值逻辑
  在 [src/utils/updatePayload.ts](/D:/GitCloneData/testpilot-studio/src/utils/updatePayload.ts) 中大量重复出现“字段变化才写入 payload”的逻辑，现通过 `shared/utils/payload.ts` 收敛为通用 helper

这次提取后，公共方法的边界更清晰：

- 与业务无关的数组/值处理逻辑进入 `shared`
- 具体业务字段的 payload 组装仍保留在 `utils/updatePayload.ts`

## 6. 当前设计判断

### 6.1 优点

- 运行入口与目录结构已经基本一致
- `app / features / shared` 的职责边界清楚
- React Query、Zustand、Ant Design 的接入方式稳定
- 公共能力开始从 feature helper 中回流到 `shared/utils`

### 6.2 仍需关注的点

- [src/features/api-automation/pages/ApiCollectionDetailPage.tsx](/D:/GitCloneData/testpilot-studio/src/features/api-automation/pages/ApiCollectionDetailPage.tsx) 仍是超大页面
- [src/features/ui-automation/pages/UiTestSuiteCasePage.tsx](/D:/GitCloneData/testpilot-studio/src/features/ui-automation/pages/UiTestSuiteCasePage.tsx) 仍同时承担编辑器与运行控制台职责
- [src/services/api.ts](/D:/GitCloneData/testpilot-studio/src/services/api.ts) 仍是业务 API 聚合出口，后续可进一步按运行域拆分
- 构建结果存在主包过大告警，说明后续值得考虑路由级或模块级拆包

## 7. 后续建议

建议下一阶段优先做这三件事：

1. 拆大页面  
优先继续拆 `ApiCollectionDetailPage` 和 `UiTestSuiteCasePage`，将“编辑区、运行区、历史区、报告区”拆成容器组件或 hooks。

2. 继续把通用工具向 `shared` 收口  
当前 `src/utils/format.tsx` 与 `src/utils/updatePayload.ts` 已具备继续拆分基础，后续可以把真正跨模块的格式化与 payload helper 逐步迁移到 `shared/utils`。

3. 处理构建包体积  
当前构建可通过，但主包超过 500 kB。后续可评估：
   - 路由级懒加载
   - 测试模块按子域拆包
   - 编辑器与报告类重组件延迟加载

## 8. 本次整理后的验证结果

本次整理后已完成以下验证：

- `npm run type-check`
- `npm run lint`
- `npm run build`

结果：

- 类型检查通过
- ESLint 通过
- 生产构建通过
- 构建保留一条 chunk 体积告警，属于优化建议，不影响当前可用性
