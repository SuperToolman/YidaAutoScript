# 宜搭脚本工具箱 Re

一个面向宜搭后台场景的油猴脚本项目，基于 `Vite + React + vite-plugin-monkey` 构建。脚本会根据当前访问的宜搭页面自动注入对应工具，覆盖表单设计器、集成自动化、数据管理页、数据集页、我的应用页等多个高频场景，帮助完成表单迁移、字段回填、数据集迁移、批量复制、依赖修复等操作。

## 项目介绍

本项目本质上是一个运行在浏览器中的增强型用户脚本。

- 使用 `vite-plugin-monkey` 构建 Tampermonkey/Greasemonkey 用户脚本。
- 使用 React 组织各页面工具面板与弹窗。
- 通过 `InterfaceService` 封装宜搭页面内常用接口。
- 通过 `ProcessService`、`SchemaConvertService`、`FormFillService` 等服务承载核心业务逻辑。
- 运行时会根据 URL 自动判断当前页面，并只挂载当前页面所需的工具模块。

适用目标主要包括：

- 宜搭表单设计器增强
- 集成自动化导入导出与迁移
- 应用级迁移与修复
- 数据管理页批量操作
- 数据集跨应用迁移

## 项目结构

```text
yida_auto_script
├─ src
│  ├─ components                # 通用 UI 组件，如工具箱、字段大纲、API 卡片等
│  ├─ hooks                     # DOM 挂载相关 Hook
│  ├─ pages                     # 各宜搭页面的功能入口
│  │  ├─ designer               # 旧版表单设计器工具
│  │  ├─ newDesigner            # 新版集成自动化设计器工具
│  │  ├─ logicFlow              # 集成自动化列表/逻辑流页面工具
│  │  ├─ dataset                # 数据集页工具
│  │  ├─ view                   # 数据管理页工具
│  │  └─ myApp                  # 我的应用页工具
│  ├─ services                  # 核心业务与接口服务层
│  │  ├─ dataset                # 数据集元数据处理
│  │  ├─ datasource             # 数据源和字段面板辅助逻辑
│  │  ├─ schema                 # Schema 转换、模板代码生成
│  │  ├─ shared                 # 浏览器工具、运行态、样式配置
│  │  └─ ui                     # React 挂载和 Monaco 编辑器相关能力
│  ├─ App.jsx                   # 页面识别与页面组件分发入口
│  ├─ main.js                   # 用户脚本初始化入口
│  └─ global.js                 # 全局运行时状态
├─ vite.config.js               # 用户脚本构建配置与 match 元数据
├─ package.json                 # 项目依赖与构建脚本
└─ README.md
```

## 核心业务代码说明

### 1. 页面路由分发

`src/App.jsx` 是脚本的页面分发中心，会根据当前 URL 判断所处页面：

- `pageDesigner`：旧版表单设计器
- `newDesigner`：新版设计器 / 集成自动化配置页
- `logicFlow`：集成自动化列表页
- `view`：表单数据管理页
- `dataset`：数据集页
- `myApp`：我的应用页

命中后会渲染对应 `pages/*/index.jsx` 模块。

### 2. 脚本初始化

`src/services/ScriptService.js` 负责：

- 解析当前页面 URL 中的 `appId`、`formUuid`、`processCode`
- 初始化 `global.info`
- 获取 CSRF Token
- 初始化接口服务实例 `global.services`
- 调用 UI 挂载服务，将 React 工具注入目标页面

### 3. 服务层职责

`src/services` 是项目最重要的业务层，主要职责如下：

- `InterfaceService.js`
  - 封装宜搭接口调用
  - 提供应用、表单、流程、导航、数据源等读写能力
  - 是大多数业务功能的底层 API 入口
- `ProcessService.js`
  - 处理集成自动化导入、导出、批量迁移
  - 负责流程编码修正、目标表单匹配、批量生成自动化
  - 也是“主表生成明细表自动化”的核心实现位置
- `schema/SchemaConvertService.js`
  - 处理表单 Schema、关联组件、跨组织表单/应用 ID 映射
  - 支撑页面迁移、关联表单修复、跨组织导入转换
- `FormFillService.js`
  - 面向新版设计器中的规则配置页面
  - 通过 DOM 自动化完成字段匹配、值类型切换、整页批量回填
- `dataset/DataMetadataService.js`
  - 负责数据集导出时补齐跨组织迁移所需元信息
- `datasource/DataSourceService.js`
  - 负责解析字段面板和数据源面板，用于自动回填
- `ui/UiMountService.jsx`
  - 负责将 React UI 注入页面

### 4. 公共能力

项目中还存在几类高频公共能力：

- `OutlinePanel.jsx`
  - 拉取当前组织的应用-表单-字段结构
  - 支持搜索、复制结构、复制 `APP_ID` / `FORM_UUID` / 字段 ID
  - 是多个页面共用的结构浏览工具
- `BrowserUtilsService.js`
  - 封装 toast、剪贴板、等待 DOM、菜单选择等浏览器侧基础能力
- `RuntimeStateService.js`
  - 保存字段回填模式、日志回调、暂停状态等运行时状态

## 脚本触发页面与功能

脚本配置在 `vite.config.js` 的 `userscript.match` 中，当前主要覆盖以下页面。

### 1. 旧版表单设计器

匹配示例：

- `https://*.aliwork.com/alibaba/web/*/design/pageDesigner*`
- `https://*.aliwork.com/dingtalk/web/*/design/pageDesigner*`

页面模块：`src/pages/designer`

主要功能：

- 字段大纲
  - 查看当前组织应用结构、表单结构、字段结构
  - 支持搜索、复制字段 ID、复制应用 Token
- 内容转换
  - 转换关联表单配置
  - 转换整份 Schema 中的关联映射和数据源引用
  - 查看并复制当前页面 Schema
- 页面迁移
  - 基于当前普通表单一键生成审批表单
  - 基于子表单一键生成明细记录表单
  - 可选同步生成“主表到明细表”的集成自动化
- 跨应用 API
  - 内置跨应用查询示例代码
- JS-API
  - 内置常用 JS-API 片段与说明
- 打印生成
  - 上传 Excel，生成打印页 HTML/CSS 模板
- 数据填充弹窗增强
  - 在数据填充映射弹窗中注入“全部填充 / 填充一条 / 暂停”

### 2. 新版设计器 / 集成自动化配置页

匹配示例：

- `https://*/dingtalk/web/*/design/newDesigner*`
- `https://*.aliwork.com/*/design/newDesigner.html*`

页面模块：`src/pages/newDesigner`

主要功能：

- 字段大纲
- 嵌入式字段规则自动填充面板
  - 自动读取当前可用数据源
  - 支持三种填充模式：
    - `A`：忽略缺失
    - `B`：缺失时转公式
    - `C`：文本优先
  - 支持填充一条、填充全部、暂停
  - 支持清空缺失值规则项

### 3. 集成自动化列表页

匹配示例：

- `https://*.aliwork.com/*/admin/logicFlow*`

页面模块：`src/pages/logicFlow`

主要功能：

- 从剪贴板导入集成自动化迁移 JSON
- 展示导入进度、成功数、失败数、逐条结果
- 批量导出集成自动化
- 按流程名、流程编码、表单名搜索并批量勾选导出
- 导出结果直接复制到剪贴板

### 4. 数据管理页

匹配示例：

- `https://*.aliwork.com/APP_*/admin/FORM-*`

页面模块：`src/pages/view`

主要功能：

- 表单复制与粘贴
  - 批量复制当前应用表单 Schema
  - 从剪贴板粘贴并自动创建新表单
- 字段大纲
- 批量修改
  - 批量修改字段
  - 批量修改表单
  - 批量修改表单 JS
- 打印生成
- 关于脚本

### 5. 数据集页

匹配示例：

- `https://*.aliwork.com/APP_*/admin/*dataSet*`

页面模块：`src/pages/dataset`

主要功能：

- 批量复制数据集定义
  - 查询当前应用数据集
  - 多选后导出为 JSON
  - 自动补充跨组织迁移所需元数据
- 数据集导入
  - 支持粘贴 JSON 批量导入
  - 当前重点支持“跨应用表单”类型数据集的迁移导入
  - 导入时会根据应用名、表单名自动匹配目标组织中的表单

### 6. 我的应用页

匹配示例：

- `https://*.aliwork.com/myApp*`

页面模块：`src/pages/myApp`

主要功能：

- 应用迁移导出向导
  - 选择要迁移的应用
  - 统计表单数、字段数、自动化数量
  - 导出表单 Schema、导航结构、集成自动化数据
- 应用迁移导入向导
  - 创建目标应用
  - 添加应用数据源
  - 迁移表单与自动化
  - 创建导航分组并整理父子关系
- 依赖修复
  - 关联组件修复
  - 集成自动化修复

## 项目运行机制

整体调用链可以概括为：

1. 用户访问宜搭页面
2. 用户脚本根据 URL 命中 `match`
3. `main.js` 调用 `ScriptService.init()`
4. 初始化全局信息、接口服务和 React 根节点
5. `App.jsx` 根据当前 URL 选择对应页面模块
6. 页面模块再将工具箱、按钮或弹窗 Portal 到目标 DOM 节点

也就是说，这个项目不是传统的独立 Web 页面，而是“注入到宜搭页面中的增强层”。

## 安装方式

### 方式一：直接安装构建产物

适合普通使用者。

1. 安装浏览器扩展：
   - [Tampermonkey](https://www.tampermonkey.net/)
2. 获取脚本：
   - 可使用项目构建后的 `.user.js` 文件
   - 或使用配置中提供的在线地址：
     - `downloadURL`：`https://update.greasyfork.org/scripts/564224/%E5%AE%9C%E6%90%AD%E8%84%9A%E6%9C%AC%E5%B7%A5%E5%85%B7%E7%AE%B1.user.js`
3. 在 Tampermonkey 中安装脚本
4. 打开宜搭对应页面，脚本会自动生效

### 方式二：本地开发与构建

适合二次开发。

#### 1. 安装依赖

```bash
npm install
```

#### 2. 本地开发

```bash
npm run dev
```

说明：

- 该命令会以 Vite 开发模式构建用户脚本
- 适合本地调试脚本逻辑和界面

#### 3. 生产构建

```bash
npm run build
```

构建完成后：

- 在构建输出目录中找到生成的用户脚本文件
- 一般会是 `.user.js` 形式
- 将其导入 Tampermonkey 即可使用

## 使用方式

### 普通使用

1. 安装 Tampermonkey
2. 安装本脚本
3. 登录宜搭后台
4. 进入支持的页面
5. 在页面顶部、侧边工具箱或弹窗内使用对应功能

### 推荐使用流程示例

#### 表单迁移

1. 在源环境进入数据管理页或我的应用页
2. 导出表单 Schema 或应用迁移数据
3. 在目标环境进入对应页面
4. 粘贴 Schema 或执行导入向导
5. 根据需要再执行依赖修复

#### 集成自动化迁移

1. 在源环境的集成自动化页面批量导出
2. 复制导出的 JSON
3. 在目标环境对应表单或逻辑流页面点击“从剪贴板导入”
4. 查看导入结果，必要时再做修复

#### 数据集迁移

1. 在源环境数据集页批量复制
2. 在目标环境数据集页粘贴 JSON 并导入
3. 观察导入提示与自动刷新结果

## 技术栈

- React 18
- Vite
- vite-plugin-monkey
- Tailwind CSS
- xlsx

## 注意事项

- 本项目强依赖宜搭页面 DOM 结构与现网接口，若宜搭前端结构变化，部分功能可能需要同步调整。
- 大部分迁移能力依赖当前账号对目标应用、表单、流程拥有足够权限。
- 涉及跨组织迁移时，脚本会尽量按应用名、表单名、字段名做自动匹配，但仍建议在导入后人工核对。
- 批量导入、批量导出、自动回填等操作建议先在测试环境验证。

## 开发建议

新增功能时建议遵循现有分层方式：

- 页面注入入口写在 `src/pages/*`
- 网络接口调用写在 `src/services/InterfaceService.js`
- 复杂业务编排写在独立 service 中
- DOM 自动化逻辑尽量集中在对应服务中
- 通用 UI 放在 `src/components`

---

如果后续还要继续完善文档，建议补充：

- 各迁移 JSON 的数据结构说明
- 常见失败场景与排查方式
- 依赖修复模块的具体操作示例
