/**
 * 转换模块
 * 提供组件转换相关功能，如构建标准文本字段组件等。
 */

import global from '../../global.js';
import Utils from '../shared/BrowserUtilsService.js';

export default class ConvertModule {
static extractConvertItems(nodeSchema) {
        const components = [];
        const dataSources = [];
        const jsIds = [];

        // 1. 提取组件树中的关联表单组件
        function traverse(nodes) {
            if (!Array.isArray(nodes)) return;
            for (const node of nodes) {
                if (node.componentName === 'AssociationFormField') {
                    components.push(node);
                }
                if (node.children && node.children.length > 0) {
                    traverse(node.children);
                }
            }
        }
        if (nodeSchema.componentsTree) traverse(nodeSchema.componentsTree);

        // 2. 提取数据源中的跨应用引用 (通常在 Page 节点的 dataSource 属性中)
        const dsConfig = nodeSchema.dataSource || (nodeSchema.props && nodeSchema.props.dataSource);
        if (dsConfig && (Array.isArray(dsConfig.list) || Array.isArray(dsConfig.online))) {
            const list = dsConfig.list || dsConfig.online || [];
            list.forEach(ds => {
                if (ds.type === 'remote' && ds.options && (ds.options.appType || ds.options.formUuid)) {
                    dataSources.push(ds);
                }
            });
        }

        // 3. 提取 JS 代码中的 ID (formUuid/appType)
        // 即使没有组件/数据源，只要有 JS 代码，我们也尝试去转换
        if (nodeSchema.actions && nodeSchema.actions.module && typeof nodeSchema.actions.module.source === 'string') {
            const code = nodeSchema.actions.module.source;
            const formUuidRegex = /formUuid\s*[:=]\s*['"](FORM-[A-Z0-9]+)['"]/g;
            const appTypeRegex = /appType\s*[:=]\s*['"](APP_[A-Z0-9]+)['"]/g;
            
            let match;
            while ((match = formUuidRegex.exec(code)) !== null) {
                jsIds.push({ type: 'formUuid', id: match[1] });
            }
            while ((match = appTypeRegex.exec(code)) !== null) {
                jsIds.push({ type: 'appType', id: match[1] });
            }
        }

        return { components, dataSources, jsIds };
    }

    static async getConvertInfo(nodeSchema) {
        let resultList = [];
        let errorList = [];

        // 1) 提取所有关联表单字段、数据源和 JS ID
        const { components: associationFormFields, dataSources: remoteDataSources, jsIds } = ConvertModule.extractConvertItems(nodeSchema);

        if (associationFormFields.length === 0 && remoteDataSources.length === 0 && jsIds.length === 0) {
            Utils.log('未找到任何关联组件、数据源或 JS 引用', 'warn');
            return { errorList, resultList };
        }

        // 2) 强制刷新并获取当前环境(B环境)的全量应用结构
        try {
            if (!global.info.appStructure.length) {
                Utils.log('正在获取当前环境全量结构...', 'info');
                const res = await global.services.getFullAppStructure();
                global.info.appStructure = Utils.getFullStructureApps(res);
                Utils.log(`获取全量结构成功，共 ${global.info.appStructure ? global.info.appStructure.length : 0} 个应用`, 'success');
            }
        } catch (e) {
            Utils.log('获取当前环境全量结构失败', e, 'error');
        }
        
        const bEnvApps = global.info.appStructure || [];

        // 预先建立 ID -> Name 的映射 (从组件和数据源中提取，这是A环境的信息)
        const idToNameMap = new Map(); // formUuid -> { formName, appName }
        const appIdToNameMap = new Map(); // appId -> appName

        
        // 从组件中提取已知信息
        associationFormFields.forEach(field => {
            const af = field.props.associationForm;
            if (af && af.formUuid && af.formTitle) {
                idToNameMap.set(af.formUuid, { formName: af.formTitle, appName: af.appName });
            }
            if (af && af.appType && af.appName) {
                appIdToNameMap.set(af.appType, af.appName);
            }
        });

        // 从数据源中提取已知信息
        remoteDataSources.forEach(ds => {
            const opts = ds.options;
            const formTitle = opts.tableName || opts.formName;
            const appName = opts.appName || opts.appTitle;
            if (opts && opts.formUuid && formTitle) {
                idToNameMap.set(opts.formUuid, { formName: formTitle, appName: appName });
            }
            if (opts && opts.appType && appName) {
                appIdToNameMap.set(opts.appType, appName);
            }
        });

        // 辅助：从全量结构中查找 ID 对应的应用/表单信息 (用于 JS ID 解析)
        const resolveIdFromFullStructure = async (id, type) => {
            // 策略0：优先检查 Schema 自带的 _idNameMapping (增强复制带来的)
            if (nodeSchema._idNameMapping && nodeSchema._idNameMapping[id]) {
                const info = nodeSchema._idNameMapping[id];
                if (type === 'appType' && info.appName) {
                    return { appName: info.appName, appId: id };
                }
                if (type === 'formUuid' && info.formName) {
                    return { appName: info.appName, formName: info.formName, formUuid: id };
                }
            }

            // 策略1：优先查本地缓存的 idToNameMap (最准确，因为是当前 Schema 自带的)
            if (type === 'formUuid' && idToNameMap.has(id)) {
                return { ...idToNameMap.get(id), formUuid: id };
            }
            if (type === 'appType' && appIdToNameMap.has(id)) {
                return { appName: appIdToNameMap.get(id), appId: id };
            }

            // 查全量结构 (兼容同环境迁移)
            for (const app of bEnvApps) {
                if (type === 'appType' && (app.appId === id || app.appType === id)) {
                    return { appName: app.appName?.zh_CN || app.appName, appId: app.appType };
                }
                if (type === 'formUuid' && Array.isArray(app.forms)) {
                    const form = app.forms.find(f => f.formUuid === id);
                    if (form) {
                        return { 
                            appName: app.appName?.zh_CN || app.appName, 
                            appId: app.appType, 
                            formName: form.title?.zh_CN || form.title || form.formName, 
                            formUuid: form.formUuid 
                        };
                    }
                }
            }
            return null;
        };

        // 核心查找逻辑：在 B 环境中查找对应应用
        const resolveAppInB = (sourceAppName) => {
            if (!sourceAppName) return null;
            const targetName = sourceAppName.trim();
            
            // 辅助：获取右侧名称 (去除前缀)
            const getRightSide = (name) => {
                const idx = name.indexOf('-');
                return idx > -1 ? name.substring(idx + 1).trim() : name.trim();
            };
            const targetRight = getRightSide(targetName);

            // 1. 精确匹配应用名 (OriginalName 或 Name)
            let found = bEnvApps.find(app => (app.appName === targetName) || (app.appOriginalName === targetName));
            if (found) return found;

            // 2. 模糊匹配 (右侧匹配)
            found = bEnvApps.find(app => {
                const appName = app.appName || app.appOriginalName || '';
                return getRightSide(appName) === targetRight;
            });
            if (found) return found;

            return null;
        };

        const appIdsToFetch = new Set();
        const resolvedJsIds = [];

        // 3.1 收集组件中的应用ID
        for (const field of associationFormFields) {
            const appName = field.props.associationForm?.appName;
            const target = resolveAppInB(appName);
            if (target) appIdsToFetch.add(target.appId);
        }

        // 3.2 收集数据源中的应用ID
        for (const ds of remoteDataSources) {
            const appName = ds.options?.appName || ds.options?.appTitle; 
            if (appName) {
                const target = resolveAppInB(appName);
                if (target) appIdsToFetch.add(target.appId);
            }
        }

        // 3.3 收集 JS ID 中的应用ID
        for (const item of jsIds) {
            // 解析出 A 环境的信息 (ID -> Name)
            const info = await resolveIdFromFullStructure(item.id, item.type);
            if (info) {
                resolvedJsIds.push({ ...item, info });
                // 使用解析出的 A 环境应用名，去 B 环境查找
                const target = resolveAppInB(info.appName);
                if (target) {
                    appIdsToFetch.add(target.appId);
                } else {
                    Utils.log(`JS引用了应用[${info.appName}]，但在当前环境未找到对应应用`, 'warn');
                }
            } else {
                Utils.log(`无法解析 JS 中的 ID: ${item.id} (请确保在复制Schema时已包含映射信息)`, 'warn');
            }
        }

        Utils.log(`需要查询详情的应用数量: ${appIdsToFetch.size} ${Array.from(appIdsToFetch)}`);

        // 4) 预加载应用详情 (为了获取字段列表)
        const fieldCache = new Map(); 

        const promises = Array.from(appIdsToFetch).map(async (appId) => {
            try {
                if (fieldCache.has(appId)) return;
                const listField = await global.services.getListFieldInApp(appId);
                fieldCache.set(appId, listField);
            } catch (error) {
                Utils.log(`加载应用详情 ${appId} 失败:`, error, 'error');
            }
        });
        await Promise.all(promises);

        // 5) 逐个匹配并生成结果
        const normalize = (t) => {
            if (t == null) return '';
            return String(t).replace(/\u00a0/g, ' ').replace(/\s+/g, '').trim();
        };
        
        // 辅助：在应用详情中查找表单
        const findFormInfo = (listField, criteria) => {
            if (!listField || !Array.isArray(listField.content)) return null;
            const { formUuid, formTitle } = criteria;
            return listField.content.find(formItem =>
                (formUuid && formItem.formUuid === formUuid)
                || (formTitle && normalize(formItem.title?.zh_CN) === normalize(formTitle))
            );
        };

        // 5.1 处理关联表单组件
        for (const field of associationFormFields) {
            try {
                const associationForm = field.props.associationForm;
                const appName = associationForm.appName;
                const targetAppInfo = resolveAppInB(appName);

                if (!targetAppInfo) {
                    errorList.push({
                        field: field.props.fieldId,
                        message: `未找到目标应用: ${appName}`
                    });
                    continue;
                }

                const listField = fieldCache.get(targetAppInfo.appId);
                const formInfo = findFormInfo(listField, { 
                    formUuid: associationForm.formUuid, 
                    formTitle: associationForm.formTitle 
                });

                if (!formInfo) {
                    errorList.push({
                        targetInfo: targetAppInfo,
                        message: `在应用【${targetAppInfo.appName}】中未找到表单【${associationForm.formTitle}】`,
                    });
                    continue;
                }

                // 字段匹配
                const fieldInfo = formInfo.fields.find(fieldItem => {
                    const name = fieldItem.name?.zh_CN || '';
                    const target = associationForm.mainFieldLabel;
                    if (target && typeof target === 'object') {
                        return normalize(name) === normalize(target.zh_CN || '');
                    } else if (target) {
                        return normalize(name) === normalize(target);
                    } else if (associationForm.mainFieldId) {
                        return fieldItem.fieldId === associationForm.mainFieldId;
                    }
                    return false;
                });

                resultList.push({
                    type: 'component',
                    node: field,
                    fieldId: field.props.fieldId,
                    label: field.props.label?.zh_CN || '',
                    from: {
                        appName: associationForm.appName,
                        appId: associationForm.appType,
                        formName: associationForm.formTitle,
                        formUuid: associationForm.formUuid,
                        fieldId: associationForm.mainFieldId,
                        fieldName: typeof associationForm.mainFieldLabel === 'object' ? associationForm.mainFieldLabel.zh_CN : associationForm.mainFieldLabel || '',
                    },
                    to: {
                        appName: targetAppInfo.appName,
                        appId: targetAppInfo.appId,
                        formName: formInfo.title?.zh_CN,
                        formUuid: formInfo.formUuid,
                        fieldId: fieldInfo?.fieldId || "",
                        fieldName: fieldInfo?.name?.zh_CN || fieldInfo?.zh_CN || "",
                    }
                });

            } catch (error) {
                Utils.log(`处理关联表单字段失败:`, error, field, 'error');
                errorList.push({ field: field.props.fieldId, error: error.message });
            }
        }

        // 5.2 处理数据源
        for (const ds of remoteDataSources) {
            try {
                const appName = ds.options?.appName;
                const formTitle = ds.options?.tableName || ds.options?.formName; 
                
                if (!appName || !formTitle) continue;

                const targetAppInfo = resolveAppInB(appName);
                if (!targetAppInfo) continue;

                const listField = fieldCache.get(targetAppInfo.appId);
                const formInfo = findFormInfo(listField, { formTitle });
                if (!formInfo) continue;

                resultList.push({
                    type: 'datasource',
                    ds: ds,
                    from: {
                        appName: appName,
                        appId: ds.options.appType,
                        formName: formTitle,
                        formUuid: ds.options.formUuid,
                    },
                    to: {
                        appName: targetAppInfo.appName,
                        appId: targetAppInfo.appId,
                        formName: formInfo.title?.zh_CN,
                        formUuid: formInfo.formUuid,
                    }
                });
            } catch (e) {
                Utils.log('处理数据源失败', e, 'warn');
            }
        }

        // 5.3 处理 JS ID
        for (const item of resolvedJsIds) {
            try {
                const info = item.info;
                const targetAppInfo = resolveAppInB(info.appName);
                if (!targetAppInfo) continue;

                // 如果是 App ID 替换
                if (item.type === 'appType') {
                    resultList.push({
                        type: 'js_app',
                        from: { appId: item.id, appName: info.appName },
                        to: { appId: targetAppInfo.appId, appName: targetAppInfo.appName }
                    });
                    continue;
                }

                // 如果是 Form ID 替换
                const listField = fieldCache.get(targetAppInfo.appId);
                const formInfo = findFormInfo(listField, { formTitle: info.formName });
                if (!formInfo) continue;

                resultList.push({
                    type: 'js_form',
                    from: { formUuid: item.id, formName: info.formName, appName: info.appName },
                    to: { formUuid: formInfo.formUuid, formName: formInfo.title?.zh_CN, appName: targetAppInfo.appName }
                });

            } catch (e) {
                Utils.log('处理 JS ID 失败', e, 'warn');
            }
        }

        Utils.log('处理完成:', { resultCount: resultList.length, errorCount: errorList.length }, 'info');
        return { errorList, resultList };
    }

    static replaceAssociationFormInTree(tree, conversionInfo) {
        if (!Array.isArray(tree)) return;

        for (const node of tree) {
            if (node.componentName === 'AssociationFormField' &&
                node.props && node.props.fieldId === conversionInfo.fieldId) {

                if (node.props.associationForm) {
                    const fromForm = conversionInfo.from?.formName || '';
                    const fromField = conversionInfo.from?.fieldName || '';
                    const toForm = conversionInfo.to?.formName || '';
                    const toField = conversionInfo.to?.fieldName || '';
                    const label = conversionInfo.label || '';
                    if (typeof ConvertModule.getPanelLogger() === 'function') {
                        ConvertModule.getPanelLogger()(`已替换 ${conversionInfo.fieldId} (${label})：${fromForm}.${fromField} -> ${toForm}.${toField}`);
                    }

                    const oldFormInfo = node.props.associationForm;

                    node.props.associationForm = {
                        ...oldFormInfo,
                        appName: conversionInfo.to.appName,
                        appType: conversionInfo.to.appId,
                        formTitle: conversionInfo.to.formName,
                        formUuid: conversionInfo.to.formUuid,
                        mainFieldId: conversionInfo.to.fieldId,
                        mainFieldLabel: {
                            zh_CN: conversionInfo.to.fieldName,
                            en_US: conversionInfo.to.fieldName,
                            type: "i18n"
                        }
                    };
                    if (typeof ConvertModule.getPanelLogger() === 'function') {
                        ConvertModule.getPanelLogger()(`目标表单：${oldFormInfo.formTitle} -> ${conversionInfo.to.formName}`);
                    }
                }
            }

            if (node.children && node.children.length > 0) {
                ConvertModule.replaceAssociationFormInTree(node.children, conversionInfo);
            }
        }
    }

    static getPanelLogger() {
        return (text, level = 'info') => Utils.logToPanel(text, level);
    }

    static parseJsonInput(input, output, log, options = {}) {
        const { useConsoleLog = false } = options || {};
        let inputValue;
        try {
            inputValue = JSON.parse(input.value);
        } catch (error) {
            if (useConsoleLog) Utils.log("JSON解析失败:", error, 'error');
            if (output) output.value = "JSON解析失败，请检查输入格式";
            if (typeof log === 'function') log("JSON解析失败", 'error');
            return null;
        }
        return inputValue;
    }

    static async runConversion(options) {
        const { inputSelector, outputSelector, startText, process, useConsoleLog = false } = options || {};
        const input = document.querySelector(inputSelector);
        const output = document.querySelector(outputSelector);
        const log = ConvertModule.getPanelLogger();
        if (!input) return;
        const inputValue = ConvertModule.parseJsonInput(input, output, log, { useConsoleLog });
        if (!inputValue) return;
        if (startText) log(startText);
        const result = await process(inputValue, log, output);
        if (!result || !result.skipOutput) {
            output.value = JSON.stringify(inputValue, null, 2);
        }
        if (result && result.finishText) log(result.finishText);
    }

    static async event_convertForm() {
        await ConvertModule.runConversion({
            inputSelector: "#conversion-input",
            outputSelector: "#conversion-result",
            startText: "开始转换",
            useConsoleLog: true,
            process: async (inputValue, log, output) => {
                let tree = null;
                let isFullSchema = false;

                if (inputValue && Array.isArray(inputValue.componentsTree)) {
                    tree = inputValue.componentsTree;
                    isFullSchema = true;
                } else if (Array.isArray(inputValue)) {
                    tree = inputValue;
                } else if (inputValue && inputValue.componentName === 'Page' && Array.isArray(inputValue.children)) {
                    tree = [inputValue];
                }

                if (!tree) {
                    log("未找到可转换的结构 (需包含 componentsTree 或为组件数组)", 'error');
                    return { finishText: "转换失败：格式不正确" };
                }

                log("获取关联表单及数据源转换信息");
                // 传入 inputValue 以便提取数据源
                const convertFormInfoList = await ConvertModule.getConvertInfo(inputValue);
                log(`获取到转换信息，结果数：${convertFormInfoList?.resultList?.length || 0}`);

                if (convertFormInfoList.resultList && convertFormInfoList.resultList.length) {
                    log("开始置换");
                    const targetList = convertFormInfoList.resultList;
                    targetList.forEach(item => {
                        if (item.type === 'component') {
                            ConvertModule.replaceAssociationFormInTree(tree, item);
                        } else if (item.type === 'datasource') {
                            // 直接修改数据源对象
                            if (item.ds && item.ds.options) {
                                item.ds.options.appType = item.to.appId;
                                item.ds.options.formUuid = item.to.formUuid;
                                if (item.ds.options.appName) item.ds.options.appName = item.to.appName;
                                if (item.ds.options.tableName) item.ds.options.tableName = item.to.formName;
                                log(`已替换数据源 [${item.ds.id || 'unknown'}]：${item.from.formName} -> ${item.to.formName}`);
                            }
                        }
                    });
                    log(`置换完成，共处理了${targetList.length}项`);
                } else {
                    log("未找到需要置换的项");
                }

                if (convertFormInfoList.errorList && convertFormInfoList.errorList.length) {
                    Utils.log("转换过程中出现错误:", convertFormInfoList.errorList, 'error');
                    log(`转换过程中出现错误：${convertFormInfoList.errorList.length}项`, 'error');
                    convertFormInfoList.errorList.forEach((item, index) => {
                        const label = item.label || item.field || '';
                        const msg = item.message || item.error || '未知错误';
                        log(`错误${index + 1}：${label ? `${label} - ` : ''}${msg}`, 'error');
                    });
                }

                // 处理 actions (JS 代码) - 同样适用于单页面/组件转换场景
                const allReplacements = [];
                if (convertFormInfoList.resultList) {
                    convertFormInfoList.resultList.forEach(item => {
                        if (item.from.formUuid && item.to.formUuid) allReplacements.push({ from: item.from.formUuid, to: item.to.formUuid });
                        if (item.from.appId && item.to.appId) allReplacements.push({ from: item.from.appId, to: item.to.appId });
                        if (item.from.fieldId && item.to.fieldId) allReplacements.push({ from: item.from.fieldId, to: item.to.fieldId });
                    });
                }

                const uniqueReplacements = [];
                const seen = new Set();
                allReplacements.forEach(r => {
                    const key = `${r.from}|${r.to}`;
                    if (!seen.has(key) && r.from !== r.to) {
                        seen.add(key);
                        uniqueReplacements.push(r);
                    }
                });

                if (inputValue.actions && Array.isArray(inputValue.actions) && uniqueReplacements.length > 0) {
                    log(`开始检查 JS 面板代码，共 ${uniqueReplacements.length} 个替换规则...`);
                    let jsModifiedCount = 0;
                    
                    inputValue.actions.forEach(action => {
                        if (action.module && typeof action.module.source === 'string') {
                            let code = action.module.source;
                            let originalCode = code;
                            
                            uniqueReplacements.forEach(({ from, to }) => {
                                code = code.split(from).join(to);
                            });

                            if (code !== originalCode) {
                                action.module.source = code;
                                jsModifiedCount++;
                                log(`已更新 Action [${action.name}] 中的引用 ID`);
                            }
                        }
                    });
                    
                    if (jsModifiedCount > 0) {
                        log(`JS 面板代码处理完成，修改了 ${jsModifiedCount} 个 Action`);
                    }
                }

                // 核心修复：如果是完整 Schema，保留其结构；如果是组件列表，提取 Page 的 children 列表
                let finalResult = inputValue;
                if (!isFullSchema) {
                    if (tree.length === 1 && tree[0].componentName === 'Page' && Array.isArray(tree[0].children)) {
                        finalResult = tree[0].children;
                        log("已提取 Page 的 children 列表供直接粘贴");
                    } else {
                        finalResult = tree;
                    }
                }

                output.value = JSON.stringify(finalResult, null, 2);
                return { skipOutput: true, finishText: "转换完成，输出结果已更新" };
            }
        });
    }

    static async event_convertSchema() {
        await ConvertModule.runConversion({
            inputSelector: "#schema-conversion-input",
            outputSelector: "#schema-conversion-result",
            startText: "开始Schema转换",
            useConsoleLog: true,
            process: async (inputValue, log, output) => {
                const pages = Array.isArray(inputValue.pages) ? inputValue.pages : [];
                if (pages.length === 0) {
                    log("未找到pages数组，无法转换componentsTree", 'warn');
                    output.value = JSON.stringify(inputValue, null, 2);
                    return { skipOutput: true };
                }

                let totalResults = 0;
                let totalErrors = 0;

                // 预先处理全局 JS 代码扫描 (因为 JS 是全局的，不属于某个 page)
                // 我们需要将 actions 传给 getConvertInfo 进行分析，同时必须传入 _idNameMapping
                log("开始分析全局 JS 代码引用...");
                const globalJsInfo = await ConvertModule.getConvertInfo({ 
                    actions: inputValue.actions,
                    _idNameMapping: inputValue._idNameMapping // 关键：传递增强复制带来的映射表
                });
                if (globalJsInfo.resultList && globalJsInfo.resultList.length) {
                    log(`JS 代码中发现 ${globalJsInfo.resultList.length} 个硬编码引用`);
                    // 将这些发现的 JS 引用映射也加入到替换列表中
                    if (!inputValue._globalReplacements) inputValue._globalReplacements = [];
                    inputValue._globalReplacements.push(...globalJsInfo.resultList);
                } else {
                    log("JS 代码中未发现可解析的引用");
                }

                for (let i = 0; i < pages.length; i++) {
                    const page = pages[i];
                    if (!page || !Array.isArray(page.componentsTree)) {
                        log(`第${i + 1}页未找到componentsTree，跳过`, 'warn');
                        continue;
                    }
                    log(`开始处理第${i + 1}页componentsTree`);
                    log("获取关联表单及数据源转换信息");
                    // 传入 page 对象以便提取数据源
                    const convertFormInfoList = await ConvertModule.getConvertInfo(page);
                    log(`获取到转换信息，结果数：${convertFormInfoList?.resultList?.length || 0}`);

                    if (convertFormInfoList.resultList && convertFormInfoList.resultList.length) {
                        log("开始置换");
                        const targetList = convertFormInfoList.resultList;
                        targetList.forEach(item => {
                            if (item.type === 'component') {
                                ConvertModule.replaceAssociationFormInTree(page.componentsTree, item);
                            } else if (item.type === 'datasource') {
                                // 直接修改数据源对象
                                if (item.ds && item.ds.options) {
                                    item.ds.options.appType = item.to.appId;
                                    item.ds.options.formUuid = item.to.formUuid;
                                    if (item.ds.options.appName) item.ds.options.appName = item.to.appName;
                                    if (item.ds.options.tableName) item.ds.options.tableName = item.to.formName;
                                    log(`已替换数据源 [${item.ds.id || 'unknown'}]：${item.from.formName} -> ${item.to.formName}`);
                                }
                            }
                        });
                        log(`置换完成，共处理了${targetList.length}项`);
                        totalResults += targetList.length;
                        
                        // 收集替换项用于 JS 代码处理
                        if (!page._replacements) page._replacements = [];
                        page._replacements.push(...targetList);
                    } else {
                        log("未找到需要置换的项");
                    }

                    if (convertFormInfoList.errorList && convertFormInfoList.errorList.length) {
                        totalErrors += convertFormInfoList.errorList.length;
                        Utils.log("转换过程中出现错误:", convertFormInfoList.errorList, 'error');
                        log(`转换过程中出现错误：${convertFormInfoList.errorList.length}项`, 'error');
                        convertFormInfoList.errorList.forEach((item, index) => {
                            const label = item.label || item.field || '';
                            const msg = item.message || item.error || '未知错误';
                            log(`错误${index + 1}：${label ? `${label} - ` : ''}${msg}`, 'error');
                        });
                    }
                }

                // 处理 actions (JS 代码) - 基于收集到的 ID 映射
                const allReplacements = [];
                // 1. 添加从组件和数据源中收集的替换规则
                pages.forEach(p => {
                    if (p._replacements) {
                        p._replacements.forEach(item => {
                            if (item.from.formUuid && item.to.formUuid) allReplacements.push({ from: item.from.formUuid, to: item.to.formUuid });
                            if (item.from.appId && item.to.appId) allReplacements.push({ from: item.from.appId, to: item.to.appId });
                            if (item.from.fieldId && item.to.fieldId) allReplacements.push({ from: item.from.fieldId, to: item.to.fieldId });
                        });
                        delete p._replacements; // 清理临时属性
                    }
                });
                // 2. 添加从 JS 扫描中收集的替换规则
                if (inputValue._globalReplacements) {
                    inputValue._globalReplacements.forEach(item => {
                        // js_app 和 js_form 类型的结果结构略有不同，需要适配
                        if (item.type === 'js_app') {
                             if (item.from.appId && item.to.appId) allReplacements.push({ from: item.from.appId, to: item.to.appId });
                        } else if (item.type === 'js_form') {
                             if (item.from.formUuid && item.to.formUuid) allReplacements.push({ from: item.from.formUuid, to: item.to.formUuid });
                        }
                    });
                    delete inputValue._globalReplacements;
                }

                // 去重
                const uniqueReplacements = [];
                const seen = new Set();
                allReplacements.forEach(r => {
                    const key = `${r.from}|${r.to}`;
                    if (!seen.has(key) && r.from !== r.to) {
                        seen.add(key);
                        uniqueReplacements.push(r);
                    }
                });

                if (inputValue.actions && Array.isArray(inputValue.actions) && uniqueReplacements.length > 0) {
                    log(`开始检查 JS 面板代码，共 ${uniqueReplacements.length} 个替换规则...`);
                    let jsModifiedCount = 0;
                    
                    inputValue.actions.forEach(action => {
                        if (action.module && typeof action.module.source === 'string') {
                            let code = action.module.source;
                            let originalCode = code;
                            
                            uniqueReplacements.forEach(({ from, to }) => {
                                // 简单的字符串替换 (split/join 比 replaceAll 兼容性更好且无需正则转义)
                                code = code.split(from).join(to);
                            });

                            if (code !== originalCode) {
                                action.module.source = code;
                                jsModifiedCount++;
                                log(`已更新 Action [${action.name}] 中的引用 ID`);
                            }
                        }
                    });
                    
                    if (jsModifiedCount > 0) {
                        log(`JS 面板代码处理完成，修改了 ${jsModifiedCount} 个 Action`);
                    } else {
                        log("JS 面板代码中未发现匹配的 ID");
                    }
                } else if (inputValue.actions && Array.isArray(inputValue.actions)) {
                    log("JS 面板代码检查：未发现需要替换的 ID 映射");
                }

                return { finishText: `Schema转换完成，结果数：${totalResults}，错误数：${totalErrors}` };
            }
        });
    }

    
    static async event_convertApprovalForm() {
        await ConvertModule.runConversion({
            inputSelector: "#approval-conversion-input",
            outputSelector: "#approval-conversion-result",
            startText: "开始转换审批表单",
            process: async (inputValue, log, output) => {
                let tree = null;
                let isFullSchema = false;

                if (inputValue && Array.isArray(inputValue.componentsTree)) {
                    tree = inputValue.componentsTree;
                    isFullSchema = true;
                } else if (Array.isArray(inputValue)) {
                    tree = inputValue;
                } else if (inputValue && inputValue.componentName === 'Page' && Array.isArray(inputValue.children)) {
                    tree = [inputValue];
                }

                if (!tree) {
                    log("未找到可转换的结构 (需包含 componentsTree 或为 Page 组件)", 'error');
                    return { finishText: "转换失败：格式不正确", skipOutput: true };
                }

                const transformed = ConvertModule.transformTree(tree);
                // todo

                // 核心修复：如果是完整 Schema，更新其 componentsTree 并保留结构；如果是 Page 结构，提取 children
                let finalResult = inputValue;
                if (isFullSchema) {
                    inputValue.componentsTree = transformed;
                    finalResult = inputValue;
                } else {
                    if (transformed.length === 1 && transformed[0].componentName === 'Page' && Array.isArray(transformed[0].children)) {
                        finalResult = transformed[0].children;
                        log("检测到顶级 Page 组件，已提取 children 列表供直接粘贴使用");
                    } else {
                        finalResult = transformed;
                    }
                }

                output.value = JSON.stringify(finalResult, null, 2);
                return { finishText: "转换完成，审批表单输出已更新", skipOutput: true };
            }
        });
    }

    /**
     * 构建标准文本字段组件
     * @param {Object} node - 组件节点
     * @param {string} labelText - 标签文本
     * @returns {Object} 标准文本字段组件配置
     */
    static buildStandardTextField(node, labelText) {
        const fieldId = node && node.props ? node.props.fieldId : '';
        return {
            componentName: 'TextField',
            props: {
                __useMediator: 'value',
                hasClear: true,
                validationType: 'text',
                __gridSpan: 1,
                linkage: '',
                tips: { en_US: '', zh_CN: '', type: 'i18n' },
                valueType: 'custom',
                labelTextAlign: 'left',
                placeholder: { type: 'i18n', zh_CN: '请输入', en_US: 'Please enter' },
                behavior: 'NORMAL',
                value: { type: 'i18n', zh_CN: '', en_US: '' },
                validation: [],
                hasLimitHint: false,
                fieldId: fieldId,
                autoHeight: false,
                visibility: ['PC', 'MOBILE'],
                dataEntryMode: false,
                submittable: 'ALWAYS',
                label: { type: 'i18n', zh_CN: labelText || '', en_US: 'Text Field' },
                __category__: 'form',
                rows: 4,
                labelColSpan: 4,
                scanCode: { enabled: false, type: 'all', editable: true },
                complexValue: { complexType: 'custom', formula: '', value: { en_US: '', zh_CN: '', type: 'i18n' } },
                size: 'medium',
                labelAlign: 'top',
                variable: '',
                formula: '',
                maxLength: 200,
                formularZoneCode: ''
            },
            condition: node && typeof node.condition === 'boolean' ? node.condition : true,
            hidden: node && typeof node.hidden === 'boolean' ? node.hidden : false,
            title: node && typeof node.title === 'string' ? node.title : '',
            isLocked: node && typeof node.isLocked === 'boolean' ? node.isLocked : false,
            conditionGroup: node && typeof node.conditionGroup === 'string' ? node.conditionGroup : ''
        };
    }

    /**
     * 递归转换组件树结构
     * @param {Array} nodes - 组件节点数组
     * @param {boolean} parentReadonly - 父级是否只读
     * @returns {Array} 转换后的组件节点数组
     */
    static transformTree(nodes, parentReadonly = false) {
        if (!Array.isArray(nodes)) return [];
        const result = [];
        const hasTextSuffix = (t) => /\s*文本$/.test(t || '');

        const isSubTable = (node) => {
            const name = (node && node.componentName) || '';
            const lower = String(name).toLowerCase();
            if (lower.includes('table') || lower.includes('subtable') || lower.includes('subform')) return true;
            const category = node && node.props ? node.props.__category__ : '';
            return category === 'table';
        };

        for (const node of nodes) {
            if (node.componentName === 'SerialNumberField') node.componentName = 'TextField';
            const titleText = typeof node.title === 'string' ? node.title : '';
            const isSubTableNode = isSubTable(node);
            const useReadonly = parentReadonly || isSubTableNode;
            if (node.props) {
                const lab = node.props.label;
                const labText = lab && typeof lab === 'object' ? lab.zh_CN : lab;
                if (labText === '审核状态' || hasTextSuffix(labText) || hasTextSuffix(titleText)) continue;
            } else if (hasTextSuffix(titleText)) {
                continue;
            }
            if (node.componentName === 'AssociationFormField') {
                const lab = node.props ? node.props.label : null;
                const labText = lab && typeof lab === 'object' ? lab.zh_CN : lab;
                const rebuilt = ConvertModule.buildStandardTextField(node, labText);
                if (rebuilt.props && rebuilt.props.behavior === 'HIDDEN') continue;
                if (rebuilt.props) rebuilt.props.behavior = useReadonly ? 'READONLY' : 'DISABLED';
                result.push(rebuilt);
                continue;
            }
            if (node.props) {
                if (node.props.behavior === 'HIDDEN') {
                    continue;
                }
                node.props.behavior = useReadonly ? 'READONLY' : 'DISABLED';

                // 移除所有组件上的事件绑定（例如 onClick, onChange, beforeSubmit 等），保证审批表单中只保留纯组件
                Object.keys(node.props).forEach(key => {
                    if (/^(on[A-Z]|before[A-Z]|after[A-Z]|did[A-Z])/.test(key) || key === 'events' || key === 'action') {
                        delete node.props[key];
                    }
                });
            }
            // 同时清理可能存在于 node 根级的事件配置
            ['events', 'action'].forEach(key => {
                if (node[key]) delete node[key];
            });
            if (node.children && node.children.length > 0) {
                node.children = ConvertModule.transformTree(node.children, useReadonly);
            }
            result.push(node);
        }
        return result;
    }

    /**
     * 转换审批表单组件树结构
     * @param {Object} formSchema - 原始审批表单 Schema
     * @returns {Object|null} 转换后的审批表单 Schema 或 null（转换失败）
     */
    static convertApprovalForm(formSchema) {
        console.log("[ConvertModule.convertApprovalForm] 开始转换审批表单", formSchema);
        if (formSchema && Array.isArray(formSchema.pages)) {
            const copySchema = JSON.parse(JSON.stringify(formSchema));
            const tree = copySchema.pages[0].componentsTree;
            const transformed = ConvertModule.transformTree(tree);
            copySchema.pages[0].componentsTree = transformed;
            copySchema.actions.module = {
                "source": "export function didMount(){console.log(`「页面JS」：当前页面地址${location.href}`)}",
                "compiled": "export function didMount(){console.log(`「页面JS」：当前页面地址${location.href}`)}"
            }
            copySchema.pages[0].componentsTree[0].dataSource.online = []

            // 强制移除 Page 节点上的 beforeSubmit 等生命周期事件绑定
            if (copySchema.pages[0].componentsTree[0] && copySchema.pages[0].componentsTree[0].componentName === 'Page') {
                const pageProps = copySchema.pages[0].componentsTree[0].props || {};

                // 移除所有生命周期和提交相关的事件绑定
                Object.keys(pageProps).forEach(key => {
                    if (/^(on[A-Z]|before[A-Z]|after[A-Z]|did[A-Z])/.test(key) || key === 'events' || key === 'action') {
                        console.log(`[ConvertModule] 移除页面级事件: ${key}`);
                        delete pageProps[key];
                    }
                });
            }

            return copySchema;
        } else {
            console.error("未找到可转换的结构 (需包含 componentsTree 或为 Page 组件)");
            return null
        }

    }

    /**
     * 转换明细表单 Schema，提取指定子表的字段并移除其他子表
     * @param {Object} formSchema - 原始主表单 Schema
     * @param {string} targetSubFormFieldId - 要提取的目标子表 fieldId
     * @returns {Object|null} 转换后的明细表单 Schema
     */
    static convertDetailsForm(formSchema, targetSubFormFieldId) {
        console.log(`[ConvertModule.convertDetailsForm] 开始转换明细表单, 目标子表: ${targetSubFormFieldId}`, formSchema);
        if (!formSchema || !Array.isArray(formSchema.pages) || !formSchema.pages[0]?.componentsTree) {
            console.error("未找到可转换的结构");
            return null;
        }

        const copySchema = JSON.parse(JSON.stringify(formSchema));
        const processTree = (nodes) => {
            if (!Array.isArray(nodes)) return [];
            let result = [];
            for (const node of nodes) {
                if (node.componentName === 'TableField') {
                    // 1.找到目标子表
                    if (node.props?.fieldId === targetSubFormFieldId) {
                        // 提取目标子表内的字段到外部
                        if (Array.isArray(node.children)) {
                            const extractedFields = processTree(node.children);
                            if (extractedFields.length > 0) {
                                const columns = Array.from({ length: 6 }, (_, i) => ({
                                    "componentName": "Column",
                                    "props": {
                                        "__style__": {},
                                        "fieldId": `column_generated_${i}_${Date.now()}`
                                    },
                                    "condition": true,
                                    "hidden": false,
                                    "title": "",
                                    "isLocked": false,
                                    "conditionGroup": "",
                                    "children": []
                                }));

                                // 轮询分配 fields 到 6 个 Column 中
                                extractedFields.forEach((field, index) => {
                                    columns[index % 6].children.push(field);
                                });

                                const columnsLayout = {
                                    "componentName": "ColumnsLayout",
                                    "props": {
                                        "layout": "2:2:2:2:2:2",
                                        "columnGap": "16px",
                                        "visibility": ["PC", "MOBILE"],
                                        "rowGap": "16px",
                                        "display": "VERTICAL",
                                        "className": "columnslayout_mob70qsd",
                                        "mobileRowGap": "0px",
                                        "__style__": ":root {\n  margin-bottom: 12px;\n}",
                                        "fieldId": `columnsLayout_generated_${Date.now()}`
                                    },
                                    "condition": true,
                                    "hidden": false,
                                    "title": "",
                                    "isLocked": false,
                                    "conditionGroup": "",
                                    "children": columns
                                };
                                
                                const pageSection = {
                                    "componentName": "PageSection",
                                    "props": {
                                        "behavior": "NORMAL",
                                        "showHeader": true,
                                        "title": {
                                            "type": "i18n",
                                            "zh_CN": "明细数据",
                                            "en_US": "Detail Data"
                                        },
                                        "tooltip": { "type": "i18n", "zh_CN": "", "en_US": "" },
                                        "showHeadDivider": true,
                                        "sectionHeaderStyle": "atmosphereA",
                                        "sectionHeaderBgColor": "#0089ff",
                                        "sectionHeaderTitleColor": "#171A1D",
                                        "pcStyle": {
                                            "text": "B",
                                            "value": "pcAtmosphereB",
                                            "img": "https://img.alicdn.com/imgextra/i4/O1CN01lavZUE1VBGHMmodq2_!!6000000002614-2-tps-137-72.png",
                                            "show": true
                                        },
                                        "withPadding": true,
                                        "mobileStyle": { "value": "origin" },
                                        "__style__": {},
                                        "fieldId": `pageSection_generated_${Date.now()}`,
                                        "visibility": ["PC", "MOBILE"],
                                        "icon": "",
                                        "showBorder": false,
                                        "withMargin": false,
                                        "showBorderMobile": false,
                                        "withMarginMobile": false,
                                        "withPaddingMobile": false
                                    },
                                    "hidden": false,
                                    "title": "",
                                    "isLocked": false,
                                    "condition": true,
                                    "conditionGroup": "",
                                    "children": [columnsLayout]
                                };
                                
                                result.push(pageSection);
                            }
                        }
                    }
                    // 非目标子表直接丢弃（即不推入 result）
                } else {
                    // 继续处理主表普通字段
                    const clonedNode = JSON.parse(JSON.stringify(node));
                    
                    // 移除事件，保持纯组件
                    if (clonedNode.props) {
                        Object.keys(clonedNode.props).forEach(key => {
                            if (/^(on[A-Z]|before[A-Z]|after[A-Z]|did[A-Z])/.test(key) || key === 'events' || key === 'action') {
                                delete clonedNode.props[key];
                            }
                        });
                    }
                    ['events', 'action'].forEach(key => {
                        if (clonedNode[key]) delete clonedNode[key];
                    });

                    if (clonedNode.children && Array.isArray(clonedNode.children)) {
                        clonedNode.children = processTree(clonedNode.children);
                    }
                    result.push(clonedNode);
                }
            }
            return result;
        };

        const tree = copySchema.pages[0].componentsTree;
        copySchema.pages[0].componentsTree = processTree(tree);

        // 清理原页面的数据源和JS逻辑
        if (copySchema.actions?.module) {
            copySchema.actions.module = {
                "source": "export function didMount(){console.log(`「页面JS」：当前明细表地址${location.href}`)}",
                "compiled": "export function didMount(){console.log(`「页面JS」：当前明细表地址${location.href}`)}"
            };
        }
        if (copySchema.pages[0].componentsTree[0]?.dataSource?.online) {
            copySchema.pages[0].componentsTree[0].dataSource.online = [];
        }

        // 强制移除 Page 节点上的事件绑定
        if (copySchema.pages[0].componentsTree[0] && copySchema.pages[0].componentsTree[0].componentName === 'Page') {
            const pageProps = copySchema.pages[0].componentsTree[0].props || {};
            Object.keys(pageProps).forEach(key => {
                if (/^(on[A-Z]|before[A-Z]|after[A-Z]|did[A-Z])/.test(key) || key === 'events' || key === 'action') {
                    console.log(`[ConvertModule] 移除页面级事件: ${key}`);
                    delete pageProps[key];
                }
            });
        }

        // 清理页面级 JS 逻辑
        if (copySchema.actions) {
            copySchema.actions.module = {
                "source": "export function didMount(){console.log(`「页面JS」：当前明细表单页面地址${location.href}`)}",
                "compiled": "export function didMount(){console.log(`「页面JS」：当前明细表单页面地址${location.href}`)}"
            };
        }

        return copySchema;
    }

    /**
     * 辅助方法：通过应用名称和表单名称在全量结构中查找目标表单
     */
    static async findTargetFormByName(appName, formName, fuzzyFormName) {
        if (!global.info.appStructure.length) {
            try {
                const res = await global.services.getFullAppStructure();
                global.info.appStructure = Utils.getFullStructureApps(res);
            } catch (e) {
                console.error("[ConvertModule] 获取全量应用结构失败", e);
                return null;
            }
        }
        
        const bEnvApps = global.info.appStructure || [];
        if (!appName || !formName) return null;

        const normalize = (t) => {
            if (t == null) return '';
            return String(t).replace(/\u00a0/g, ' ').replace(/\s+/g, '').trim();
        };
        const targetAppName = appName.trim();
        const getRightSide = (name) => {
            const idx = name.indexOf('-');
            return idx > -1 ? name.substring(idx + 1).trim() : name.trim();
        };
        const targetAppRight = getRightSide(targetAppName);
        const targetAppRightNorm = normalize(targetAppRight);

        let targetApp = bEnvApps.find(app => app.appName === targetAppName || app.appOriginalName === targetAppName) ||
                        bEnvApps.find(app => getRightSide(app.appName || app.appOriginalName || '') === targetAppRight) ||
                        bEnvApps.find(app => normalize(getRightSide(app.appName || app.appOriginalName || '')) === targetAppRightNorm);
        
        if (!targetApp) return null;

        const targetFormName = formName.trim();
        const targetFormNorm = normalize(targetFormName);
        const targetFuzzyFormNorm = fuzzyFormName ? normalize(fuzzyFormName.trim()) : null;

        let targetForm = targetApp.forms?.find(f => {
            const formText = (f.title?.zh_CN || f.title || f.formName || '');
            const formTextNorm = normalize(formText);
            return formText === targetFormName || 
                   formTextNorm === targetFormNorm || 
                   (targetFuzzyFormNorm && formTextNorm === targetFuzzyFormNorm);
        });
        
        if (!targetForm) {
            try {
                const listField = await global.services.getListFieldInApp(targetApp.appId);
                if (listField && Array.isArray(listField.content)) {
                    targetForm = listField.content.find(f => {
                        const name1 = normalize(f.title?.zh_CN);
                        const name2 = normalize(f.title);
                        const name3 = normalize(f.formName);
                        return name1 === targetFormNorm || 
                               name2 === targetFormNorm || 
                               name3 === targetFormNorm || 
                               (targetFuzzyFormNorm && (name1 === targetFuzzyFormNorm || name2 === targetFuzzyFormNorm || name3 === targetFuzzyFormNorm)) ||
                               f.formUuid === targetFormName;
                    });
                }
            } catch (e) {
                console.error("[ConvertModule] 获取应用详情失败", e);
            }
        }

        if (targetForm) {
            const resolvedFormUuid = targetForm.formUuid || targetForm.id || targetForm.formId || '';
            const resolvedAppId = targetApp.appId || targetApp.appType || '';
            return {
                appId: resolvedAppId,
                formUuid: resolvedFormUuid,
                formName: targetForm.title?.zh_CN || targetForm.title || targetForm.formName,
                appName: targetApp.appName
            };
        }
        return null;
    }

    /**
     * 根据名称映射，转换跨组织的 Payload（主要用于集成自动化导入）
     * @param {Object} payload 原始 Payload
     * @param {string} targetFormUuid 目标主表 UUID
     * @returns {Object} 转换后的 Payload
     */
    static async convertPayloadByNames(payload, targetFormUuid) {
        if (!payload) return payload;
        const isValidTargetFormUuid = typeof targetFormUuid === 'string' && targetFormUuid.startsWith('FORM-');
        
        let needConvert = false;
        let isNodesFormat = false;

        // 识别格式
        if (payload && Array.isArray(payload.nodes) && payload.props) {
            needConvert = true;
            isNodesFormat = true;
        } else if (payload && payload.schema && Array.isArray(payload.schema.children)) {
            needConvert = true;
            isNodesFormat = false;
        } else if (payload && payload.json) {
            // 支持 payload.json 是字符串的情况
            if (typeof payload.json === 'string') {
                try {
                    payload.json = JSON.parse(payload.json);
                } catch (e) {
                    console.error("[ConvertModule] 解析 payload.json 字符串失败", e);
                }
            }
            if (typeof payload.json === 'object') {
                needConvert = true;
                isNodesFormat = !!payload.json.nodes;
            }
        }

        if (!needConvert) {
            console.log("[ConvertModule.convertPayloadByNames] Payload 格式不符合自动转换条件，跳过名称转换");
            return payload;
        }

        // 提取真正的配置对象
        let configObj = payload.json && typeof payload.json === 'object' ? payload.json : payload;

        // 如果顶层存在 formUuid，则一并替换为当前目标表单 ID
        if (payload.formUuid && isValidTargetFormUuid) {
            payload.formUuid = targetFormUuid;
        }

        console.log(`[ConvertModule.convertPayloadByNames] 开始跨组织名称转换分析, targetFormUuid: ${targetFormUuid}`);
        
        // 递归遍历并替换（这是一个简化的实现，针对主要的节点类型）
        const processNode = async (node) => {
            if(!node) return;
            
            // 1. 针对 viewJson 或旧版 nodes 格式（包含 inputs 的节点）
            if (node.props && node.props.inputs) {
                const inputs = node.props.inputs;
                
                // 如果存在 formUuid 和 formName/appName 映射信息 (通常在 payload 的元数据中，或需要根据旧 ID 反查)
                // 这里为了稳健，我们主要替换 targetFormUuid（触发器通常绑定当前应用的主表）
                if ((node.type === 'trigger' || node.type === 'startEvent' || node.componentName === 'FormTrigger') && isValidTargetFormUuid) {
                    inputs.formUuid = targetFormUuid;
                    const currentAppId = global.services.getAppId();
                    if (currentAppId) {
                        inputs.appType = currentAppId;
                    }
                    console.log(`[ConvertModule] 触发器(inputs) formUuid 替换为: ${targetFormUuid}, appType 替换为: ${currentAppId || '未知'}`);
                }
                
                // 检查 inputs 中的数据源配置 (例如新增数据节点)
                if (inputs.dataSource && inputs.dataSource.options) {
                    const opts = inputs.dataSource.options;
                    if (opts.appName && (opts.formName || opts.tableName)) {
                        const targetInfo = await ConvertModule.findTargetFormByName(opts.appName, opts.formName || opts.tableName);
                        if (targetInfo) {
                            opts.appType = targetInfo.appId;
                            opts.formUuid = targetInfo.formUuid;
                            console.log(`[ConvertModule] 节点 ${node.id || node.componentName}(inputs) 的数据源映射成功: ${opts.appName}/${opts.formName} -> ${targetInfo.appId}/${targetInfo.formUuid}`);
                        } else {
                            console.warn(`[ConvertModule] 节点 ${node.id || node.componentName}(inputs) 的数据源映射失败: 未找到 ${opts.appName}/${opts.formName}`);
                        }
                    }
                }
            }

            // 2. 针对 payload.json / schema.children 格式
            if (node.props) {
                // a. 处理 StartNode 触发器
                if (node.componentName === 'StartNode' && node.props.start && isValidTargetFormUuid) {
                    node.props.start.formUuid = targetFormUuid;
                    if ('appType' in node.props.start) {
                        const currentAppId = global.services.getAppId();
                        if (currentAppId) {
                            node.props.start.appType = currentAppId;
                        }
                    }
                    console.log(`[ConvertModule] 触发器(StartNode) formUuid 替换为: ${targetFormUuid}`);
                }

                // b. 处理各类数据节点 (GetSingleDataNode, AddDataNode, UpdateDataNode 等)
                const actionKeys = [
                    'getData',
                    'addData',
                    'updateData',
                    'deleteData',
                    'upsertData',
                    'getMultipleData',
                    'getMultiData',
                    'getDataRules',
                    'addDataRules',
                    'updateDataRules',
                    'deleteDataRules',
                    'upsertDataRules',
                    'getMultipleDataRules',
                    'getMultiDataRules'
                ];
                const getTitle = (formItem) => {
                    if (!formItem) return '';
                    if (typeof formItem.title === 'string') return formItem.title;
                    if (formItem.title && formItem.title.zh_CN) return formItem.title.zh_CN;
                    if (formItem.title && formItem.title.en_US) return formItem.title.en_US;
                    return formItem.formName || formItem.tableName || '';
                };
                for (const key of actionKeys) {
                    const actionData = node.props[key];
                    if (actionData && actionData.type === 'direct_form' && isValidTargetFormUuid) {
                        actionData.sourceId = targetFormUuid;
                    }
                    if (actionData && actionData.targetItem) {
                        const targetItem = actionData.targetItem;
                        if (targetItem.appName && targetItem.formItem) {
                            const formName = getTitle(targetItem.formItem);
                            if (formName && typeof formName === 'string') {
                                const targetInfo = await ConvertModule.findTargetFormByName(targetItem.appName, formName);
                                if (targetInfo) {
                                    targetItem.appType = targetInfo.appId;
                                    targetItem.formItem.formUuid = targetInfo.formUuid;
                                    targetItem.appName = typeof targetInfo.appName === 'string' ? targetInfo.appName : (targetInfo.appName?.zh_CN || targetItem.appName);
                                    actionData.appType = targetInfo.appId;
                                    actionData.sourceId = targetInfo.formUuid;
                                    console.log(`[ConvertModule] 节点 ${node.componentName}(${key}) 的数据源映射成功: ${targetItem.appName}/${formName} -> ${targetInfo.appId}/${targetInfo.formUuid}`);
                                } else {
                                    console.warn(`[ConvertModule] 节点 ${node.componentName}(${key}) 的数据源映射失败: 未找到 ${targetItem.appName}/${formName}`);
                                }
                            }
                        }
                    }
                }
            }

            // 递归处理子节点
            if(node.children && Array.isArray(node.children)) {
                for(let i=0; i<node.children.length; i++) {
                    await processNode(node.children[i]);
                }
            }
        };

        if (isNodesFormat) {
            for(let i=0; i<configObj.nodes.length; i++) {
                await processNode(configObj.nodes[i]);
            }
        } else if (configObj.schema && configObj.schema.children) {
            for(let i=0; i<configObj.schema.children.length; i++) {
                await processNode(configObj.schema.children[i]);
            }
        }

        // 重新包装
        if (payload.json && typeof payload.json === 'object') {
            payload.json = configObj;
        }

        console.log("[ConvertModule.convertPayloadByNames] 跨组织名称转换完成");
        return payload;
    }
}

/**
 * 构建 Monaco Editor 嵌入的 Iframe 地址
 * @param {string} editorId - 编辑器实例 ID
 * @param {object} config - 编辑器配置
 * @returns {string} - 完整的 Iframe 地址
 */
