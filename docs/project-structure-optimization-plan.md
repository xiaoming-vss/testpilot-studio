# 项目结构优化计划

## 1. 文档目的

这份文档用于指导 `testpilot-studio` 后续的前端结构治理。目标不是一次性“大重构”，而是在**不影响现有业务可用性**的前提下，把当前项目从“技术分层”逐步演进为更适合中长期维护的“业务模块分层”。

这份计划默认面向后续实际改造执行，因此会尽量写清楚：

- 为什么要改
- 先改什么，后改什么
- 当前文件大致应该迁移到哪里
- 每一阶段做到什么程度算完成

---

## 2. 当前现状判断

### 2.1 当前结构

当前 `src` 目录主要为：

```text
src/
  assets/
  components/
  pages/
  services/
  store/
  utils/
  App.tsx
  App.css
  index.css
  main.tsx
```

### 2.2 当前结构的问题

当前结构并不是“错误”的，它适合早期开发和快速迭代，但对于现在这个项目的业务体量，已经出现了几个明显信号：

1. 目录是按技术职责拆分，不是按业务领域拆分。
2. 页面文件过大，单文件承担了过多 UI、数据请求、表单、状态和交互逻辑。
3. `services/api.ts` 同时承担了接口定义、类型定义、请求封装和业务接口聚合。
4. 路由、布局、查询逻辑、工作台状态在 `AppShell` 一类文件里耦合较重。
5. 样式集中在全局文件，后续容易变成维护成本很高的“总样式池”。
6. 缺少明确的 `app / features / shared` 层次，后续扩展会越来越依赖“人脑记忆”。

### 2.3 当前结构仍然保留的优点

这些部分可以保留并继续演进：

- 技术栈是主流的：`Vite + React + TypeScript + React Query + Zustand + Ant Design`
- 已经有基础分层意识：`pages / components / services / store / utils`
- TypeScript、ESLint 配置已经具备基本约束

### 2.4 基于最新代码的复杂度基线

根据当前这版代码，结构层没有明显变化，但复杂度热点已经进一步集中。后续优化建议以这组现状为基线：

| 文件 | 当前体量 | 判断 |
| --- | --- | --- |
| `src/App.css` | 5000+ 行 | 全局样式池过大，后续必须收缩职责 |
| `src/pages/ApiCollectionDetailPage.tsx` | 2900+ 行 | 仍然是接口自动化模块的最大复杂度来源 |
| `src/pages/UiTestSuiteCasePage.tsx` | 1900+ 行 | 相比前一版继续膨胀，说明 UI 自动化运行态复杂度上升 |
| `src/services/api.ts` | 680+ 行 | 已经同时承载多领域类型、接口、运行报告和请求能力 |
| `src/pages/ProjectsPage.tsx` | 590 行 | 仍然偏重，但不是当前第一优先级 |
| `src/components\ApiEnvironmentDrawer.tsx` | 520+ 行 | 业务能力较强，适合独立为 feature 组件 |
| `src/pages\ApiAutomationPage.tsx` | 500+ 行 | 已具备拆成容器 + hooks 的条件 |
| `src/components\UiTestSuiteSection.tsx` | 320+ 行 | 已从“简单区块”演变为带分页、运行、编辑的业务组件 |

补充判断：

1. `ui-automation` 模块现在已经不只是“测试集 + 用例编辑”，还包含调试运行、整集运行、运行历史、运行报告、快照等运行态能力。
2. `api-automation` 模块同样包含 collection 运行、运行历史、运行报告、环境切换、断言与提取规则等复杂子域。
3. `EntityDrawers.tsx` 已经同时承载 sprint、requirement、collection、ui test suite 多种业务抽屉，不再适合作为单一公共组件文件继续增长。

---

## 3. 优化目标

### 3.1 总目标

把项目结构调整为：

- `app`：应用级入口、路由、Provider、全局布局、主题
- `features`：按业务模块组织代码
- `shared`：跨模块复用的基础能力
- `assets`：全局静态资源

### 3.2 目标效果

优化完成后，希望达到以下效果：

1. 新业务功能可以直接放到对应模块，不需要先思考“放 pages 还是 components 还是 services”。
2. 单个页面不再同时承担所有职责，而是由页面容器 + 子组件 + hooks + api 配合完成。
3. 公共逻辑和业务逻辑边界更清晰。
4. 大文件逐步拆小，降低维护和修改风险。
5. 后续接入测试、权限、国际化、监控时更容易落位。

---

## 4. 结构设计原则

后续改造建议遵守以下原则：

1. **优先按业务领域拆分，而不是继续按技术类型堆积。**
2. **先搬家，再细拆。**
   第一阶段先建立合理目录，不追求一次性把所有逻辑全部重写。
3. **避免大爆炸式重构。**
   每次改造保持可运行、可提交、可回滚。
4. **公共能力进入 shared，业务能力留在 feature 内。**
5. **只有真的跨模块复用，才提升为 shared。**
   不要过早抽象。
6. **页面负责组装，复杂逻辑尽量下沉到 hooks / api / components。**
7. **避免重新产生超级文件。**
   例如新的 feature 内也不应该再出现一个 2000 行的页面文件。

---

## 5. 目标目录结构

建议演进到下面这类结构：

```text
src/
  app/
    layouts/
      AppShell.tsx
    providers/
      QueryProvider.tsx
      ThemeProvider.tsx
      RouterProvider.tsx
    router/
      routes.tsx
      guards/
        ProtectedRoute.tsx
    styles/
      index.css
      theme.css
    App.tsx
    main.tsx

  features/
    auth/
      api/
      components/
      hooks/
      pages/
      store/
      types/

    projects/
      api/
      components/
      hooks/
      pages/
      types/
      utils/

    requirements/
      api/
      components/
      hooks/
      pages/
      types/

    api-automation/
      api/
      components/
      hooks/
      pages/
      types/
      utils/

    ui-automation/
      api/
      components/
      hooks/
      pages/
      types/

    profile/
      pages/
      components/

  shared/
    api/
      client.ts
      request.ts
      types.ts
    components/
      PageFrame/
      JsonEditor/
      drawers/
    hooks/
    lib/
    store/
    constants/
    utils/

  assets/
```

说明：

- `app` 放应用装配层，不放具体业务实现。
- `features` 放业务模块，每个模块尽量自包含。
- `shared` 放跨业务复用能力。
- `assets` 保留全局静态资源。

---

## 6. 当前文件到目标结构的迁移建议

下面是第一版建议映射，不要求一次性完成，但后续优化尽量以此为方向。

### 6.1 应用入口层

| 当前文件 | 目标位置 | 说明 |
| --- | --- | --- |
| `src/main.tsx` | `src/app/main.tsx` | 应用入口 |
| `src/App.tsx` | `src/app/App.tsx` | 顶层应用装配 |
| `src/components/AppShell.tsx` | `src/app/layouts/AppShell.tsx` | 布局层，后续继续拆路由与查询逻辑 |
| `src/components/ProtectedRoute.tsx` | `src/app/router/guards/ProtectedRoute.tsx` | 路由守卫 |
| 路由定义散落在 `App.tsx` / `AppShell.tsx` | `src/app/router/routes.tsx` | 统一路由注册 |

### 6.2 认证模块

| 当前文件 | 目标位置 | 说明 |
| --- | --- | --- |
| `src/pages/AuthPage.tsx` | `src/features/auth/pages/AuthPage.tsx` | 登录/注册页 |
| `src/store/auth.ts` | `src/features/auth/store/auth.store.ts` | 认证状态 |

### 6.3 项目与需求模块

| 当前文件 | 目标位置 | 说明 |
| --- | --- | --- |
| `src/pages/ProjectsPage.tsx` | `src/features/projects/pages/ProjectsPage.tsx` | 后续继续拆容器和子组件 |
| `src/pages/ProjectDetailPage.tsx` | `src/features/projects/pages/ProjectDetailPage.tsx` | 项目详情 |
| `src/pages/SprintDetailPage.tsx` | `src/features/projects/pages/SprintDetailPage.tsx` | 可先放 projects，后续再独立 sprint 模块 |
| `src/pages/RequirementDetailPage.tsx` | `src/features/requirements/pages/RequirementDetailPage.tsx` | 需求详情 |
| `src/components/EntityDrawers.tsx` 中的 `SprintDrawer` | `src/features/projects/components/SprintDrawer.tsx` | 保留在项目域内 |
| `src/components/EntityDrawers.tsx` 中的 `RequirementDrawer` | `src/features/requirements/components/RequirementDrawer.tsx` 或 `src/features/projects/components/RequirementDrawer.tsx` | 看最终 requirement 是否独立成域 |
| `src/store/workbench.ts` | `src/features/projects/store/workbench.store.ts` 或 `src/shared/store/workbench.store.ts` | 看后续是否仍然全局通用 |

### 6.4 接口自动化模块

| 当前文件 | 目标位置 | 说明 |
| --- | --- | --- |
| `src/pages/ApiAutomationPage.tsx` | `src/features/api-automation/pages/ApiAutomationPage.tsx` | 模块首页 |
| `src/pages/ApiCollectionDetailPage.tsx` | `src/features/api-automation/pages/ApiCollectionDetailPage.tsx` | 后续重点拆分 |
| `src/components/ApiEnvironmentDrawer.tsx` | `src/features/api-automation/components/ApiEnvironmentDrawer.tsx` | 业务强相关，不建议一开始放 shared |
| `src/components/EntityDrawers.tsx` 中的 `CollectionDrawer` | `src/features/api-automation/components/CollectionDrawer.tsx` | 明确归属到接口自动化模块 |

### 6.5 UI 自动化模块

| 当前文件 | 目标位置 | 说明 |
| --- | --- | --- |
| `src/pages/UiAutomationPage.tsx` | `src/features/ui-automation/pages/UiAutomationPage.tsx` | 模块首页 |
| `src/pages/UiTestSuiteCasePage.tsx` | `src/features/ui-automation/pages/UiTestSuiteCasePage.tsx` | 后续重点拆分 |
| `src/components/UiTestSuiteSection.tsx` | `src/features/ui-automation/components/UiTestSuiteSection.tsx` | 业务相关组件 |
| `src/components/EntityDrawers.tsx` 中的 `UiTestSuiteDrawer` | `src/features/ui-automation/components/UiTestSuiteDrawer.tsx` | 明确归属到 UI 自动化模块 |
| `DEFAULT_UI_TEST_SUITE_RUN_CONFIG` | `src/features/ui-automation/constants/defaultRunConfig.ts` | 从混合抽屉文件中拆出默认运行配置 |

### 6.6 公共组件与基础能力

| 当前文件 | 目标位置 | 说明 |
| --- | --- | --- |
| `src/components/PageFrame.tsx` | `src/shared/components/PageFrame/PageFrame.tsx` | 通用页面容器 |
| `src/components/JsonEditor.tsx` | `src/shared/components/JsonEditor/JsonEditor.tsx` | 可复用的编辑器能力 |
| `src/components/TestPilotLogo.tsx` | `src/shared/components/TestPilotLogo.tsx` | 品牌组件 |
| `src/components/AppHeaderContext.tsx` | `src/shared/components/AppHeaderContext.tsx` 或 `src/app/layouts/context/` | 看实际使用范围决定 |

### 6.7 接口与类型

| 当前文件 | 目标位置 | 说明 |
| --- | --- | --- |
| `src/services/api.ts` | 拆分到 `src/shared/api/` + 各 `features/*/api/` + 各 `features/*/types/` | 这是后续重点治理对象 |
| `src/utils/format.tsx` | `src/shared/utils/format.ts` | 如包含业务格式化，再局部拆出 |
| `src/utils/updatePayload.ts` | 按业务拆到各 feature 的 `utils/` | 不建议继续作为大杂烩公共工具 |
| `src/store/theme.ts` | `src/app/providers/` 或 `src/shared/store/theme.store.ts` | 主题更偏应用层/共享层 |

---

## 7. 分阶段执行计划

建议按 7 个阶段推进。

### 阶段 0：建立重构基线

目标：先让后续改动更稳。

建议动作：

1. 补充基础脚本，例如 `format`、`type-check`。
2. 明确 lint 通过、build 通过作为每阶段验收条件。
3. 如果要做大规模移动，优先补充路径别名，例如 `@/app`、`@/features`、`@/shared`。
4. 保证每次调整后都能本地运行。

完成标准：

- `build` 可通过
- `lint` 可通过
- 目录迁移不会依赖大量相对路径回跳

### 阶段 1：建立 app / features / shared 骨架

目标：先把大方向定下来。

建议动作：

1. 新建 `src/app`、`src/features`、`src/shared`。
2. 把应用入口、顶层布局、守卫、全局样式迁移到 `app`。
3. 不做大规模逻辑拆分，先完成“目录归位”。

完成标准：

- 入口文件全部进入 `app`
- 路由守卫位置明确
- 全局样式位置明确

### 阶段 2：拆分 services/api.ts

目标：把最容易继续膨胀的文件先控制住。

建议动作：

1. 保留一个共享请求客户端，例如：
   - `shared/api/client.ts`
   - `shared/api/request.ts`
2. 把类型按领域拆分：
   - `features/projects/types.ts`
   - `features/api-automation/types.ts`
   - `features/ui-automation/types.ts`
   - `features/auth/types.ts`
3. 把接口按领域拆分：
   - `features/projects/api/projects.api.ts`
   - `features/requirements/api/requirements.api.ts`
   - `features/api-automation/api/apiCollections.api.ts`
   - `features/api-automation/api/apiCases.api.ts`
   - `features/api-automation/api/apiRuns.api.ts`
   - `features/api-automation/api/apiEnvironments.api.ts`
   - `features/ui-automation/api/uiSuites.api.ts`
   - `features/ui-automation/api/uiCases.api.ts`
   - `features/ui-automation/api/uiRuns.api.ts`
   - `features/auth/api/auth.api.ts`
4. 如有必要，保留一个临时聚合出口，减少迁移期间的改动面。

完成标准：

- 不再只有一个超大 `api.ts`
- 请求底座和业务接口分离
- 类型定义不再全部挤在同一个文件

### 阶段 3：按业务模块搬迁页面和组件

目标：让代码真正进入业务边界。

建议动作：

1. 将 `pages` 下文件迁入对应 feature。
2. 将强业务相关组件迁入对应 feature 的 `components`。
3. 将 `EntityDrawers.tsx` 拆成多个 feature 内部抽屉组件，不再继续作为混合业务组件存在。
4. 只有确认是跨模块复用的组件才放到 `shared/components`。

完成标准：

- 页面和业务组件主要分布在 `features/*`
- 根目录级的 `pages`、`components` 开始收缩

### 阶段 4：拆解大页面

目标：降低单文件复杂度。

优先级建议：

1. `ApiCollectionDetailPage.tsx`
2. `UiTestSuiteCasePage.tsx`
3. `ApiAutomationPage.tsx`
4. `ProjectsPage.tsx`
5. `AppShell.tsx`

建议拆法：

1. 页面容器：负责路由参数、页面装配
2. 数据 hooks：负责查询、变更、缓存刷新
3. 表单组件：负责表单 UI 和交互
4. 列表/面板组件：负责局部展示
5. 纯工具函数：留在模块内 `utils/`

完成标准：

- 重点页面不再是几千行单文件
- 数据逻辑和视图逻辑基本分离

### 阶段 5：样式治理

目标：控制全局样式规模。

建议动作：

1. 保留真正全局的 reset、theme token、layout 基础样式。
2. 将模块强相关样式迁移到模块内。
3. 如后续样式继续增长，优先考虑：
   - `*.module.css`
   - `*.module.scss`
   - 或者统一的 token + 组件局部样式方案

完成标准：

- `App.css` 不再承担大部分业务样式
- 样式和业务模块的对应关系更清楚

### 阶段 6：规范补齐

目标：把“结构整理”升级为“工程治理”。

建议动作：

1. 增加 `type-check`、`format` 脚本
2. 视情况引入 `prettier`
3. 增加基础测试能力
4. 统一命名规范：
   - 组件：`PascalCase.tsx`
   - hooks：`useXxx.ts`
   - store：`xxx.store.ts`
   - api：`xxx.api.ts`
   - types：`types.ts` 或 `xxx.types.ts`
5. 统一导入规范，减少深层相对路径

完成标准：

- 项目不仅“看起来整齐”，而且具备持续约束能力

---

## 8. 重点改造对象说明

### 8.1 `src/services/api.ts`

这是当前最需要治理的基础文件之一。

建议目标：

- 请求客户端独立
- 类型按业务拆分
- 接口按业务拆分
- 避免一个文件成为所有领域的汇总中心

建议额外注意：

- `api-automation` 和 `ui-automation` 都已经出现“实体管理 + 运行态 + 报告态”的双层复杂度，不要只按 CRUD 拆接口文件。
- 更合理的拆法是按“对象域 + 运行域”分开，例如 `uiSuites / uiCases / uiRuns`，`apiCollections / apiCases / apiRuns / apiEnvironments`。

### 8.2 `src/pages/ApiCollectionDetailPage.tsx`

这是当前最明显的“页面过重”文件之一。

建议优先拆出：

- collection 基础信息区
- case 列表区
- assert rule 面板
- extract rule 面板
- run result 面板
- 环境选择与运行工具条
- 数据 hooks

### 8.3 `src/pages/UiTestSuiteCasePage.tsx`

建议优先拆出：

- suite 基础信息区
- case 列表区
- 调试运行面板
- 整集运行历史与运行报告面板
- 快照视图与步骤结果视图
- step 编辑相关组件
- 数据 hooks

补充判断：

- 这个页面当前已经同时承担了“用例编辑器”和“测试运行控制台”两种职责。
- 如果继续增长，建议后续考虑把“suite case editor”和“suite run console”拆成两个页面层容器或两个大区块容器。

### 8.4 `src/components/AppShell.tsx`

建议逐步拆出：

- `app/layouts/AppShell.tsx`
- `app/router/routes.tsx`
- `features/projects/hooks/useActiveProject.ts`
- `features/auth/hooks/useCurrentUser.ts`

### 8.5 `src/components/EntityDrawers.tsx`

这是这次更新后新增需要纳入计划的重点文件。

建议目标：

- 不再把 sprint、requirement、collection、ui test suite 抽屉继续堆在同一个文件
- 抽屉组件回归各自 feature
- 默认配置常量和表单类型从混合组件文件中拆出
- 只保留真正跨域复用的底层抽屉壳或表单片段进入 `shared`

---

## 9. 实施顺序建议

为了控制风险，推荐按下面顺序执行：

1. 新建目录骨架
2. 迁移入口、布局、守卫、全局样式
3. 抽出共享请求客户端
4. 拆 `api.ts`
5. 拆 `EntityDrawers.tsx`，把混合业务抽屉归位到各 feature
6. 页面和业务组件归位到 `features`
7. 拆重点大页面
8. 样式收口
9. 补测试和工程规范

不建议一开始就直接大规模拆页面，因为那样更容易同时引入结构变更和行为变更，排查成本会很高。

---

## 10. 验收标准

当结构优化达到第一阶段目标时，至少应满足：

1. 顶层目录已经形成 `app / features / shared`
2. `services/api.ts` 已经拆分，不再是唯一接口中心
3. 大部分页面与业务组件已进入对应 feature
4. `App.css` 的职责收缩为全局样式，不再承载大量业务样式
5. 关键大页面完成首轮拆分
6. `build`、`lint`、基础运行均正常

如果达到更理想状态，还应满足：

1. 新增一个业务模块时，不需要修改多个无关目录
2. 新人看到目录结构可以快速定位业务代码
3. 跨模块复用和模块内私有代码边界清晰

---

## 11. 执行注意事项

1. 每次只做一类事情，不要一边迁移目录一边改业务逻辑。
2. 大文件拆分优先抽子组件和 hooks，不要一开始就过度抽象。
3. 不要把所有东西都放进 `shared`，否则只是把问题从根目录挪到了公共目录。
4. 如果某些模块边界暂时不稳定，可以先放在更大的 feature 下，例如先把 `sprint` 放在 `projects` 下。
5. 如果路径迁移较多，优先引入别名，否则相对路径会快速恶化。

---

## 12. 后续可直接执行的第一批任务

如果后面开始正式动手，建议第一批就做这些：

1. 新建 `src/app`、`src/features`、`src/shared`
2. 迁移 `main.tsx`、`App.tsx`、`ProtectedRoute.tsx`、`AppShell.tsx`
3. 新建 `app/router/routes.tsx`
4. 增加路径别名
5. 将 `services/api.ts` 先拆成：
   - `shared/api/request.ts`
   - `features/projects/api/*.ts`
   - `features/api-automation/api/*.ts`
   - `features/ui-automation/api/*.ts`
6. 拆 `EntityDrawers.tsx`，分别迁移到 `projects / requirements / api-automation / ui-automation`
7. 再开始拆 `ApiCollectionDetailPage.tsx` 和 `UiTestSuiteCasePage.tsx`

---

## 13. 一句话结论

这个项目当前已经具备继续规范化的基础，但现在更像“可工作的早中期结构”，还不是“适合持续扩展的模块化结构”。后续最合适的方向不是推倒重来，而是**按阶段把项目演进成 `app + features + shared` 的业务模块化结构**。
