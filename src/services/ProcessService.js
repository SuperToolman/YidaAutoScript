import global from '../global.js';
import Utils from '@/services/shared/BrowserUtilsService';
import StateModule from '@/services/shared/RuntimeStateService';
import ConvertModule from '@/services/schema/SchemaConvertService';

export default class ProcessService {
    static formatTimeForName(date = new Date()) {
        const pad = (n) => String(n).padStart(2, '0');
        const y = date.getFullYear();
        const m = pad(date.getMonth() + 1);
        const d = pad(date.getDate());
        const hh = pad(date.getHours());
        const mm = pad(date.getMinutes());
        const ss = pad(date.getSeconds());
        return `${y}${m}${d}${hh}${mm}${ss}`;
    }

    static resolveSourceFormName(rawData, payload) {
        const fromMeta = rawData && rawData.__migrationMeta && rawData.__migrationMeta.source && rawData.__migrationMeta.source.formName
            ? String(rawData.__migrationMeta.source.formName).trim()
            : '';
        if (fromMeta) return fromMeta;

        if (payload && payload.schema && Array.isArray(payload.schema.children)) {
            const actionKeys = ['getData', 'addData', 'updateData', 'deleteData', 'upsertData', 'getMultipleData', 'getMultiData'];
            for (const node of payload.schema.children) {
                for (const key of actionKeys) {
                    const actionData = node && node.props ? node.props[key] : null;
                    const targetItem = actionData && actionData.targetItem ? actionData.targetItem : null;
                    const formName = targetItem && targetItem.formItem
                        ? (targetItem.formItem.title || targetItem.formItem.formName || targetItem.formItem.tableName || '')
                        : '';
                    if (formName) return String(formName).trim();
                }
            }
        }

        if (payload && Array.isArray(payload.nodes)) {
            for (const node of payload.nodes) {
                const opts = node && node.props && node.props.inputs && node.props.inputs.dataSource && node.props.inputs.dataSource.options
                    ? node.props.inputs.dataSource.options
                    : null;
                const formName = opts ? (opts.formName || opts.tableName || '') : '';
                if (formName) return String(formName).trim();
            }
        }

        return '';
    }

    static getMacroName(name) {
        const text = typeof name === 'string' ? name.trim() : '';
        const idx = text.indexOf('-');
        return idx > -1 ? text.substring(idx + 1).trim() : text;
    }

    /**
     * 保存集成自动化流程
     */
    static async saveProcess(formUuid, processCode, payload, viewJson, isLogic = 'true', extraParams = {}) {
        // 使用 global.services 提供的原生 fetch 调用，以确保 viewJson 等关键参数被正确发送
        return await global.services.saveProcess(formUuid, processCode, payload, viewJson, isLogic, extraParams);
    }

    /**
     * 导入 Payload 并创建/更新集成自动化
     */
    static async importPayload(inputData, targetAppId) {
        if (!inputData) throw new Error('输入数据不能为空');
        const isValidFormUuid = (val) => typeof val === 'string' && val.startsWith('FORM-');

        // 如果提供了 targetAppId，临时挂载到 global.info 供 downstream 方法使用
        const prevAppId = global.info.appId;
        if (targetAppId && typeof targetAppId === 'string') {
            global.info.appId = targetAppId;
        }

        try {

            let payload = null;
            let viewJson = null;

            // 解析输入数据
            let rawData = inputData;
            if (typeof inputData === 'string') {
                try {
                    rawData = JSON.parse(inputData);
                } catch (e) {
                    throw new Error('Payload 格式错误，请确保是合法的 JSON');
                }
            }

            // 统一预处理：如果 rawData 包含 json 和 viewJson 字符串，先将它们解析为对象，以便 ConvertModule 能处理
            if (rawData && rawData.json && typeof rawData.json === 'string') {
                try { rawData.json = JSON.parse(rawData.json); } catch (e) { }
            }
            if (rawData && rawData.viewJson && typeof rawData.viewJson === 'string') {
                try { rawData.viewJson = JSON.parse(rawData.viewJson); } catch (e) { }
            } else if (rawData && rawData.json && !rawData.viewJson) {
                // 如果只有 json 没有 viewJson，为了保持一致性，克隆一份
                rawData.viewJson = JSON.parse(JSON.stringify(rawData.json));
            }

            // 提前加载 B 组织全量应用结构，供 findTargetFormByName 使用（避免在节点循环中重复拉取）
            const cachedAppStructure = Array.isArray(global.info.appStructure) ? global.info.appStructure : [];
            if (!cachedAppStructure.length) {
                try {
                    const fullRes = await global.services.getFullAppStructure();
                    global.info.appStructure = Utils.getFullStructureApps(fullRes) || [];
                    console.log("[ProcessService] 已加载目标组织全量应用结构，共", global.info.appStructure.length, "个应用");
                } catch (e) {
                    console.warn("[ProcessService] 加载目标组织全量应用结构失败", e);
                }
            }

            // 调用 ConvertModule 进行转换（跨组织 Payload 转换：根据名称映射 ID）
            // 优先使用页面上下文的目标 formUuid；若缺失则根据导出时的源映射名称自动反查
            const detectedFormUuid = global.services.getFormUuid() || StateModule.currentFormUuid || '';
            let targetFormUuid = isValidFormUuid(detectedFormUuid) ? detectedFormUuid : '';
            if (!targetFormUuid) {
                console.warn(`[ProcessService] 未识别到有效目标 formUuid, 当前值: ${detectedFormUuid}`);
                const sourceMeta = rawData && rawData.__migrationMeta && rawData.__migrationMeta.source ? rawData.__migrationMeta.source : null;
                const sourceAppName = sourceMeta && sourceMeta.appName ? String(sourceMeta.appName).trim() : '';
                const sourceAppMacroName = sourceMeta && sourceMeta.appMacroName ? String(sourceMeta.appMacroName).trim() : '';
                const sourceFormName = sourceMeta && sourceMeta.formName ? String(sourceMeta.formName).trim() : '';
                if ((sourceAppName || sourceAppMacroName) && sourceFormName) {
                    const lookupAppName = sourceAppName || sourceAppMacroName;
                    const targetInfo = await ConvertModule.findTargetFormByName(lookupAppName, sourceFormName);
                    if (targetInfo && isValidFormUuid(targetInfo.formUuid)) {
                        targetFormUuid = targetInfo.formUuid;
                        console.log(`[ProcessService] 根据源映射名称反查目标表单成功: ${lookupAppName}/${sourceFormName} -> ${targetFormUuid}`);
                    } else {
                        console.warn(`[ProcessService] 根据源映射名称反查目标表单失败: ${lookupAppName}/${sourceFormName}`);
                    }
                }
            }
            rawData = await ConvertModule.convertPayloadByNames(rawData, targetFormUuid);

            if (rawData && rawData.viewJson && typeof rawData.viewJson === 'object' && rawData.viewJson !== rawData.json) {
                await ConvertModule.convertPayloadByNames({ json: rawData.viewJson }, targetFormUuid);
            }

            // 处理不同来源的数据结构
            if (rawData.json && (typeof rawData.json === 'object' || typeof rawData.json === 'string')) {
                // 来源 1: 拦截到的完整请求包 (含有 json 字段)
                payload = typeof rawData.json === 'string' ? JSON.parse(rawData.json) : rawData.json;
                // 如果请求包里有 viewJson，优先使用；否则使用 json 内容作为 viewJson
                viewJson = rawData.viewJson ? (typeof rawData.viewJson === 'string' ? JSON.parse(rawData.viewJson) : rawData.viewJson) : payload;
            } else if (rawData.content && typeof rawData.content === 'string') {
                // 来源 2: getProcess.json 的响应结果 (含有 content 字符串)
                try {
                    payload = JSON.parse(rawData.content);
                    viewJson = payload; // 对于 getProcess 结果，viewJson 通常就是 content 解析后的对象
                } catch (e) {
                    payload = rawData.content;
                    viewJson = rawData.content;
                }
            } else {
                // 来源 3: 直接的流程定义对象 (schema 模式或 nodes 模式)
                payload = rawData;
                viewJson = rawData;
            }

            // 检查是否是官方运行时 Payload (含有 nodes 数组)
            const isRuntimePayload = payload && Array.isArray(payload.nodes) && payload.props;

            // 根据 eventType 确定 createLogicflow 的 type 参数
            const sourceEventType = (rawData?.__migrationMeta?.source?.eventType != null)
                ? Number(rawData.__migrationMeta.source.eventType)
                : null;
            const flowCreateType = sourceEventType || 1;

            // 根据 payload 结构判断 isLogic
            // - CanvasEngine 中 StartNode 有 props.start → 审批流程 → isLogic='false'
            // - 其他 → 集成自动化 → isLogic='true'
            let isLogicFlag = 'true';
            if (payload?.schema?.componentName === 'CanvasEngine') {
                const children = payload.schema.children || [];
                if (children.some(n => n?.componentName === 'StartNode' && n?.props?.start)) {
                    isLogicFlag = 'false';
                }
            }

            let formUuidParam = '';

            // 1. 优先使用 Payload 顶层已转换后的 formUuid (代表了集成自动化定义的业务表单目标)
            if (rawData && typeof rawData === 'object' && rawData.formUuid && typeof rawData.formUuid === 'string' && rawData.formUuid.startsWith('FORM-')) {
                formUuidParam = rawData.formUuid;
                console.log(`[ProcessService] 使用 Payload 置换后的业务目标 ID: ${formUuidParam}`);
            } else if (payload && payload.formUuid && typeof payload.formUuid === 'string' && payload.formUuid.startsWith('FORM-')) {
                formUuidParam = payload.formUuid;
                console.log(`[ProcessService] 使用 payload 内部置换后的业务目标 ID: ${formUuidParam}`);
            }

            // 2. 兜底方案：从 Payload 内容中提取
            if (!formUuidParam) {
                if (isRuntimePayload) {
                    const triggerNode = payload.nodes.find(n => n.type === 'trigger');
                    formUuidParam = triggerNode && triggerNode.props && triggerNode.props.inputs ? triggerNode.props.inputs.formUuid : '';
                } else {
                    const children = payload && payload.schema && Array.isArray(payload.schema.children) ? payload.schema.children : [];
                    // 在 schema.children 中寻找 TriggerNode 或者事件节点
                    const startNode = children.find(n => n && (n.type === 'TriggerNode' || (n.props && n.props.start)));
                    if (startNode && startNode.props && startNode.props.start) {
                        formUuidParam = startNode.props.start.formUuid;
                    } else if (startNode && startNode.props && startNode.props.inputs) {
                        formUuidParam = startNode.props.inputs.formUuid;
                    }
                }
                if (formUuidParam) console.log(`[ProcessService] 从 Payload 内部节点提取目标 ID: ${formUuidParam}`);
            }

            // 3. 二次兜底：如果提取到的值非法，优先回退到当前页面可识别的合法 FORM-UUID
            if (!isValidFormUuid(formUuidParam) && isValidFormUuid(targetFormUuid)) {
                formUuidParam = targetFormUuid;
                console.log(`[ProcessService] 使用当前页面目标 ID 作为最终 formUuid: ${formUuidParam}`);
            }
            if (!isValidFormUuid(formUuidParam)) {
                // 如果还找不到，弹出详细提示，告诉用户为什么找不到以及如何解决
                Utils.toast({ title: '导入失败：无法获取当前表单 formUuid', type: 'error' });
                throw new Error(`未识别到有效 formUuid，当前值为: ${formUuidParam || '空'}。原因：可能是当前页面不是有效的表单页面，或者导出的源数据没有包含完整的应用映射信息。请在目标表单的集成自动化页面重新执行导入。`);
            }

            // 4. 最终校验：目标 formUuid 必须属于当前应用，防止“导入成功但刷新看不到”
            const appId = global.services.getAppId();
            const listRes = await global.services.getListFieldInApp(appId).catch(() => null);
            const appForms = listRes && Array.isArray(listRes.content) ? listRes.content : [];
            const isFormInCurrentApp = (candidateId) => appForms.some((f) => {
                const itemId = f.formUuid || f.id || f.formId;
                return String(itemId || '') === String(candidateId || '');
            });
            let formInCurrentApp = isFormInCurrentApp(formUuidParam);

            // 4.1 兼容旧迁移包（没有 __migrationMeta）：从 payload 节点中提取 appName/formName 再反查
            if (!formInCurrentApp) {
                const sourceMeta = rawData && rawData.__migrationMeta && rawData.__migrationMeta.source ? rawData.__migrationMeta.source : null;
                let sourceAppName = sourceMeta && sourceMeta.appName ? String(sourceMeta.appName).trim() : '';
                let sourceFormName = sourceMeta && sourceMeta.formName ? String(sourceMeta.formName).trim() : '';
                const sourceFormUuid = formUuidParam;

                if ((!sourceAppName || !sourceFormName) && payload && payload.schema && Array.isArray(payload.schema.children)) {
                    const actionKeys = ['getData', 'addData', 'updateData', 'deleteData', 'upsertData', 'getMultipleData', 'getMultiData'];
                    for (const node of payload.schema.children) {
                        for (const key of actionKeys) {
                            const actionData = node && node.props ? node.props[key] : null;
                            const targetItem = actionData && actionData.targetItem ? actionData.targetItem : null;
                            if (!targetItem || !targetItem.appName || !targetItem.formItem) continue;
                            const title = targetItem.formItem.title || targetItem.formItem.formName || targetItem.formItem.tableName || '';
                            const targetItemSourceUuid = actionData.sourceId || targetItem.formItem.formUuid || '';
                            // 优先匹配“与当前源 formUuid 同一来源”的数据节点，避免拿错业务表名
                            if (sourceFormUuid && targetItemSourceUuid && String(targetItemSourceUuid) !== String(sourceFormUuid)) {
                                continue;
                            }
                            sourceAppName = sourceAppName || String(targetItem.appName).trim();
                            sourceFormName = sourceFormName || String(title).trim();
                            if (sourceAppName && sourceFormName) break;
                        }
                        if (sourceAppName && sourceFormName) break;
                    }
                }

                if ((!sourceAppName || !sourceFormName) && payload && Array.isArray(payload.nodes)) {
                    for (const node of payload.nodes) {
                        const opts = node && node.props && node.props.inputs && node.props.inputs.dataSource && node.props.inputs.dataSource.options
                            ? node.props.inputs.dataSource.options
                            : null;
                        if (opts && opts.appName && (opts.formName || opts.tableName)) {
                            sourceAppName = sourceAppName || String(opts.appName).trim();
                            sourceFormName = sourceFormName || String(opts.formName || opts.tableName).trim();
                            break;
                        }
                    }
                }

                if (sourceAppName && sourceFormName) {
                    console.log(`[ProcessService] 尝试名称反查目标表单: ${sourceAppName}/${sourceFormName}`);
                    const targetInfo = await ConvertModule.findTargetFormByName(sourceAppName, sourceFormName);
                    if (targetInfo && isValidFormUuid(targetInfo.formUuid) && isFormInCurrentApp(targetInfo.formUuid)) {
                        formUuidParam = targetInfo.formUuid;
                        formInCurrentApp = true;
                        console.log(`[ProcessService] 旧迁移包名称反查命中: ${sourceAppName}/${sourceFormName} -> ${formUuidParam}`);
                    } else {
                        console.warn(`[ProcessService] 旧迁移包名称反查未命中或命中结果不在当前应用: ${sourceAppName}/${sourceFormName}`, targetInfo);
                    }
                }

                // 4.2 回退到 live appForms 列表按名称匹配（场景：应用刚创建 + 表单刚迁移，global.info.appStructure 未刷新）
                if (!formInCurrentApp && sourceFormName) {
                    const getFormText = (f) => {
                        const name = f.formName;
                        if (!name) return '';
                        if (typeof name === 'string') return name;
                        return name.zh_CN || name.en_US || name.name || '';
                    };
                    const liveMatch = appForms.find(f => {
                        const text = getFormText(f);
                        return text && String(text).trim() === String(sourceFormName).trim();
                    });
                    if (liveMatch) {
                        const liveFormUuid = liveMatch.formUuid || liveMatch.id || liveMatch.formId;
                        if (isValidFormUuid(liveFormUuid)) {
                            formUuidParam = liveFormUuid;
                            formInCurrentApp = true;
                            console.log(`[ProcessService] live appForms 按名称命中: ${sourceFormName} -> ${formUuidParam}`);
                        }
                    }
                }
            }

            if (!formInCurrentApp) {
                throw new Error(`目标 formUuid(${formUuidParam}) 不属于当前应用(${appId})。该迁移代码可能是旧格式，请重新点击“迁移”获取新版代码（包含源映射信息）后再导入。`);
            }

            // 4.3 在拿到最终目标 formUuid 后，再执行一次精确替换，确保 startNode/trigger 指向目标表
            await ConvertModule.convertPayloadByNames(payload, formUuidParam);
            if (viewJson && typeof viewJson === 'object' && viewJson !== payload) {
                await ConvertModule.convertPayloadByNames({ json: viewJson }, formUuidParam);
            }

            const customProcessName = rawData && typeof rawData.__customProcessName === 'string' ? rawData.__customProcessName.trim() : '';
            const sourceFormName = ProcessService.resolveSourceFormName(rawData, payload) || '迁移流程';
            let processName = customProcessName || `${sourceFormName}_${ProcessService.formatTimeForName()}`;
            if (processName.length > 30) {
                processName = processName.substring(0, 30);
            }
            const res = await global.services.createLogicflow(processName, formUuidParam, flowCreateType);
            if (!res || !res.content || !res.content.processCode) {
                throw new Error(`创建流程失败: ${res ? (res.errorMsg || res.message) : '未知错误'}`);
            }
            const processCode = res.content.processCode;

            console.log(`[ProcessService] 流程创建成功(${processCode})，开始执行最终 ID 修正...`);

            // --- 核心修复：同步新流程 ID 到所有角落 ---
            // 查找旧的 processCode
            let oldProcessCode = '';
            if (payload && payload.props && payload.props.processCode) {
                oldProcessCode = payload.props.processCode;
            } else if (viewJson && viewJson.props && viewJson.props.processCode) {
                oldProcessCode = viewJson.props.processCode;
            }

            const replaceFinalIds = (obj) => {
                if (!obj || typeof obj !== 'object') return;
                if (Array.isArray(obj)) {
                    obj.forEach(item => replaceFinalIds(item));
                    return;
                }
                for (const key in obj) {
                    const val = obj[key];
                    if (typeof val === 'string') {
                        // 1. 替换旧流程 ID (LPROC-xxx)
                        if (oldProcessCode && val.includes(oldProcessCode)) {
                            const escapedOldId = oldProcessCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            obj[key] = val.replace(new RegExp(escapedOldId, 'g'), processCode);
                        }
                    } else if (val && typeof val === 'object') {
                        replaceFinalIds(val);
                    }

                    // 2. 强制同步 processCode 字段
                    if (key === 'processCode') {
                        obj[key] = processCode;
                    }
                }
            };

            // 执行深度替换
            replaceFinalIds(payload);
            if (viewJson && viewJson !== payload) replaceFinalIds(viewJson);

            // 如果是包装格式，还需要同步回原始 rawData 的字段中
            if (rawData.json) {
                rawData.json = typeof rawData.json === 'string' ? JSON.stringify(payload) : payload;
            }
            if (rawData.viewJson) {
                rawData.viewJson = typeof rawData.viewJson === 'string' ? JSON.stringify(viewJson) : viewJson;
            }

            // 确保外层字段也是最新的
            if (rawData.processCode) rawData.processCode = processCode;
            if (rawData.formUuid) rawData.formUuid = formUuidParam;

            console.log("【最终导入负载 payload】", payload);
            console.log("【最终导入负载 viewJson】", viewJson);

            // 最终校验：扫描 payload 中是否还有源组织的 FORM_UUID / APP_ID 未被替换
            const bEnvFormIds = new Set(appForms.map(f => String(f.formUuid || f.id || f.formId || '')).filter(Boolean));
            const bEnvAppIds = new Set();
            bEnvAppIds.add(String(appId || ''));
            const bEnvStructure = global.info.appStructure || [];
            bEnvStructure.forEach(app => {
                bEnvAppIds.add(String(app.appId || app.appType || ''));
                (app.forms || []).forEach(f => {
                    bEnvFormIds.add(String(f.formUuid || f.formId || f.id || ''));
                });
            });

            const isForeignFormId = (val) => typeof val === 'string' && val.startsWith('FORM-') && !bEnvFormIds.has(val);
            const isForeignAppId = (val) => typeof val === 'string' && val.startsWith('APP_') && !bEnvAppIds.has(val);

            // 抽取节点中的 appName + formTitle 上下文
            const extractContext = (obj) => {
                let appName = '';
                let formTitle = '';
                if (!obj || typeof obj !== 'object') return { appName, formTitle };
                if (obj.appName && typeof obj.appName === 'string') appName = obj.appName;
                if (obj.targetItem && obj.targetItem.appName) appName = obj.targetItem.appName;
                if (obj.formItem && obj.formItem.title) {
                    const t = obj.formItem.title;
                    formTitle = typeof t === 'string' ? t : (t.zh_CN || t.en_US || '');
                }
                return { appName, formTitle };
            };

            const fixIdsRecursive = async (obj, depth = 0) => {
                if (!obj || typeof obj !== 'object' || depth > 20) return;
                if (Array.isArray(obj)) {
                    for (const item of obj) await fixIdsRecursive(item, depth + 1);
                    return;
                }
                const { appName, formTitle } = extractContext(obj);
                for (const key in obj) {
                    const val = obj[key];
                    if (typeof val === 'string') {
                        if ((isForeignFormId(val) || isForeignAppId(val)) && appName && formTitle) {
                            try {
                                const targetInfo = await ConvertModule.findTargetFormByName(appName, formTitle);
                                if (targetInfo && isForeignFormId(val) && targetInfo.formUuid) {
                                    console.log(`[ProcessService] 延迟修复 formUuid: ${val} → ${targetInfo.formUuid} (${appName}/${formTitle})`);
                                    obj[key] = targetInfo.formUuid;
                                } else if (targetInfo && isForeignAppId(val) && targetInfo.appId) {
                                    console.log(`[ProcessService] 延迟修复 appId: ${val} → ${targetInfo.appId} (${appName}/${formTitle})`);
                                    obj[key] = targetInfo.appId;
                                }
                            } catch (e) { }
                        }
                    } else if (val && typeof val === 'object') {
                        await fixIdsRecursive(val, depth + 1);
                    }
                }
            };

            await fixIdsRecursive(payload);
            if (viewJson && viewJson !== payload) await fixIdsRecursive(viewJson);

            // 修复后再扫描一次，收集仍未匹配的
            const stillUnmapped = [];
            const collectUnmapped = (obj, path = 'root', depth = 0) => {
                if (!obj || typeof obj !== 'object' || depth > 20) return;
                if (Array.isArray(obj)) {
                    obj.forEach((item, i) => collectUnmapped(item, `${path}[${i}]`, depth + 1));
                    return;
                }
                const { appName, formTitle } = extractContext(obj);
                for (const key in obj) {
                    const val = obj[key];
                    if (isForeignFormId(val) || isForeignAppId(val)) {
                        const context = appName && formTitle ? `${appName}/${formTitle}` : '';
                        stillUnmapped.push({ path: `${path}.${key}`, value: val, context });
                    }
                    if (val && typeof val === 'object') collectUnmapped(val, `${path}.${key}`, depth + 1);
                }
            };
            collectUnmapped(payload);
            if (viewJson && viewJson !== payload) collectUnmapped(viewJson);

            if (stillUnmapped.length > 0) {
                const preview = stillUnmapped.slice(0, 5).map(u => `${u.path}=${u.value}${u.context ? ` (${u.context})` : ''}`).join('\n');
                console.warn(`[ProcessService] 以下 ${stillUnmapped.length} 处引用在目标组织中无法匹配，将保留源组织 ID:\n${preview}`);
                Utils.toast({ title: `警告：${stillUnmapped.length} 处应用/表单引用无法匹配，已保留原始值，请手动修复`, type: 'warn' });
            }

            const finalPayloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
            const finalViewJsonStr = typeof viewJson === 'string' ? viewJson : JSON.stringify(viewJson);

            // 对 isLogic='false' 增加兜底：有些环境下宜搭仍然强校验 processCode
            const extraParams = { processCode: processCode };

            const saveRes = await ProcessService.saveProcess(formUuidParam, processCode, finalPayloadStr, finalViewJsonStr, isLogicFlag, extraParams);

            if (saveRes && saveRes.success === false) {
                const errorDetail = saveRes.errorMsg || saveRes.message || saveRes.raw || JSON.stringify(saveRes);
                throw new Error(`保存流程失败: ${errorDetail}`);
            }

            return { success: true, syncSuccess: true, processCode, message: '导入并同步成功' };
        } finally {
            if (targetAppId) {
                global.info.appId = prevAppId;
            }
        }
    }

    static extractFieldListFromFormSchema(formSchema) {
        if (!formSchema || !Array.isArray(formSchema.pages) || !formSchema.pages[0] || !Array.isArray(formSchema.pages[0].componentsTree)) {
            return [];
        }
        const containerNames = new Set(['Page', 'FormContainer', 'PageSection', 'Column', 'ColumnsLayout', 'RootHeader', 'TableField']);
        const result = [];
        const walk = (nodes) => {
            if (!Array.isArray(nodes)) return;
            for (const node of nodes) {
                if (!node || typeof node !== 'object') continue;
                const componentName = node.componentName || 'TextField';
                const fieldId = node.props && node.props.fieldId ? node.props.fieldId : '';
                if (fieldId && !containerNames.has(componentName)) {
                    const labelObj = node.props && node.props.label ? node.props.label : null;
                    const label = (labelObj && (labelObj.zh_CN || labelObj.en_US)) || fieldId;
                    result.push({
                        fieldId,
                        label,
                        name: fieldId,
                        required: false,
                        componentName,
                        componentOption: '[]',
                        props: node.props || {}
                    });
                }
                if (Array.isArray(node.children)) walk(node.children);
            }
        };
        walk(formSchema.pages[0].componentsTree);
        return result;
    }

    static extractSubTableFieldsFromFormSchema(formSchema, subFormFieldId) {
        if (!formSchema || !Array.isArray(formSchema.pages) || !formSchema.pages[0] || !Array.isArray(formSchema.pages[0].componentsTree)) {
            return [];
        }
        let foundTable = null;
        const walk = (nodes) => {
            if (!Array.isArray(nodes) || foundTable) return;
            for (const node of nodes) {
                if (node && node.componentName === 'TableField' && node.props && node.props.fieldId === subFormFieldId) {
                    foundTable = node;
                    return;
                }
                if (node && Array.isArray(node.children)) walk(node.children);
            }
        };
        walk(formSchema.pages[0].componentsTree);
        if (!foundTable || !Array.isArray(foundTable.children)) return [];

        return foundTable.children.map((child) => {
            const fieldId = child && child.props && child.props.fieldId ? child.props.fieldId : '';
            const labelObj = child && child.props && child.props.label ? child.props.label : null;
            const label = (labelObj && (labelObj.zh_CN || labelObj.en_US)) || child && child.title || fieldId;
            return {
                value: fieldId,
                text: label,
                componentName: child.componentName || 'TextField',
                props: child.props || {},
                supportSort: true
            };
        }).filter(item => !!item.value);
    }

    static buildDetailSyncPayload(options) {
        const {
            appId,
            appName,
            masterFormName,
            masterFormUuid,
            subFormFieldId,
            subFormLabel,
            detailFormUuid,
            detailFormName,
            detailFields,
            subTableFields,
            masterFields,
            fieldMapping,
            detailFieldDefinitions
        } = options;

        const startId = `node_${Date.now().toString(36)}_start`;
        const getSingleId = `node_${Date.now().toString(36)}_single`;
        const getBatchId = `node_${Date.now().toString(36)}_batch`;
        const addId = `node_${Date.now().toString(36)}_add`;
        const endId = `node_${Date.now().toString(36)}_end`;
        const batchVarPrefix = `batch_${getBatchId}`;

        const rulesFilter = subTableFields.map((f) => ({
            id: f.value,
            name: f.text,
            componentType: f.componentName,
            placeholder: '请输入',
            operators: ['包含', '等于', '不等于', '有值', '没有值'],
            props: {
                emptyInputOperators: ['有值', '没有值'],
                defaultDataSource: {},
                relateAppType: '',
                relateOrderEnable: false,
                relateOrderConfig: []
            },
            values: [],
            supportSort: true
        }));

        const outputs = subTableFields;
        const singleOutputs = (masterFields || []).map((f) => ({
            value: f.fieldId,
            text: f.label || f.fieldId,
            componentName: f.componentName || 'TextField',
            props: f.props || {},
            supportSort: true
        }));
        const finalDetailFields = Array.isArray(detailFieldDefinitions) && detailFieldDefinitions.length
            ? detailFieldDefinitions
            : detailFields;
        const componentOptionMap = {};
        finalDetailFields.forEach((f) => { componentOptionMap[f.fieldId] = '[]'; });

        const subFieldSet = new Set(outputs.map(o => String(o.value || '')));
        const masterFieldSet = new Set((masterFields || []).map(f => String(f.fieldId || '')));

        // 规则生成策略：
        // 1) 子表字段：使用 GetBatchDataNode 的批量变量进行匹配赋值
        // 2) 主表字段：使用 GetSingleDataNode 的主表变量进行公式/变量赋值
        // 3) 其他字段：默认空值（literal）
        const mappingMap = new Map();
        (fieldMapping || []).forEach((m) => {
            if (m && m.targetFieldId) mappingMap.set(String(m.targetFieldId), m);
        });

        const mappingRules = finalDetailFields.map((df) => {
            const fieldId = String(df.fieldId || '');
            let valueType = 'literal';
            let value = '';
            let sourceMeta = null;
            const mapped = mappingMap.get(fieldId);
            if (mapped && mapped.sourceType === 'sub' && mapped.sourceFieldId) {
                valueType = 'processVar';
                value = `\${${batchVarPrefix}}.${mapped.sourceFieldId}`;
            } else if (mapped && mapped.sourceType === 'master' && mapped.sourceFieldId) {
                // 对齐成功模板：主表字段使用 column（界面显示为“公式”），并携带来源描述
                valueType = 'column';
                value = `\${${getSingleId}}.${mapped.sourceFieldId}`;
                sourceMeta = {
                    source: `#{${getSingleId}//${mapped.sourceFieldId}}`,
                    display: `获取主表数据.${mapped.sourceLabel || df.label || mapped.sourceFieldId}`
                };
            } else if (subFieldSet.has(fieldId)) {
                valueType = 'processVar';
                value = `\${${batchVarPrefix}}.${fieldId}`;
            } else if (masterFieldSet.has(fieldId)) {
                valueType = 'column';
                value = `\${${getSingleId}}.${fieldId}`;
                sourceMeta = {
                    source: `#{${getSingleId}//${fieldId}}`,
                    display: `获取主表数据.${df.label || fieldId}`
                };
            }

            const rule = {
                id: fieldId,
                name: df.label || fieldId,
                componentType: df.componentName || 'TextField',
                valueType,
                value,
                componentOption: componentOptionMap[fieldId] || '[]'
            };
            if (sourceMeta) {
                rule.source = sourceMeta.source;
                rule.display = sourceMeta.display;
            }
            return rule;
        });

        const payload = {
            schema: {
                name: { type: "i18n", zh_CN: "root", en_US: "root" },
                type: "root",
                children: [
                    {
                        name: { type: "i18n", zh_CN: "start", en_US: "start" },
                        type: "TriggerNode",
                        props: {
                            id: startId,
                            title: { type: "i18n", zh_CN: "表单事件触发", en_US: "Form event trigger" },
                            version: "1.0.0",
                            description: { type: "i18n", zh_CN: "表单事件触发", en_US: "Form event trigger" },
                            start: {
                                isMultiple: false,
                                isDataModel: true,
                                formUuid: masterFormUuid,
                                ruleConfig: [{ "id": "1", "event": "CREATE" }, { "id": "2", "event": "UPDATE" }],
                                outputs: []
                            }
                        }
                    },
                    {
                        name: { type: "i18n", zh_CN: "获取单条数据", en_US: "Get single data" },
                        type: "GetSingleDataNode",
                        props: {
                            id: getSingleId,
                            title: { type: "i18n", zh_CN: "获取主表数据", en_US: "Get single data" },
                            version: "1.0.0",
                            description: { type: "i18n", zh_CN: "获取主表数据", en_US: "Get single data" },
                            getData: {
                                targetItem: {
                                    appId,
                                    appName,
                                    formItem: { formUuid: masterFormUuid, formName: masterFormName }
                                },
                                conditionConfig: {
                                    conditionType: "meetAll",
                                    conditionList: [{
                                        id: "1",
                                        field: { id: "formInstId", name: "实例 ID", componentType: "TextField" },
                                        operator: "等于",
                                        valueConfig: {
                                            valueType: "processVar",
                                            value: `\${${startId}}.formInstId`
                                        }
                                    }]
                                },
                                outputs: singleOutputs
                            }
                        }
                    },
                    {
                        name: { type: "i18n", zh_CN: "获取多条数据", en_US: "Get multiple data" },
                        type: "GetBatchDataNode",
                        props: {
                            id: getBatchId,
                            title: { type: "i18n", zh_CN: "获取明细表数据", en_US: "Get multiple data" },
                            version: "1.0.0",
                            description: { type: "i18n", zh_CN: "获取明细表数据", en_US: "Get multiple data" },
                            getMultipleData: {
                                targetItem: {
                                    appId,
                                    appName,
                                    formItem: { formUuid: masterFormUuid, formName: masterFormName }
                                },
                                targetType: "SubForm",
                                tableFieldId: subFormFieldId,
                                conditionConfig: {
                                    conditionType: "meetAll",
                                    conditionList: [{
                                        id: "1",
                                        field: { id: "formInstId", name: "实例 ID", componentType: "TextField" },
                                        operator: "等于",
                                        valueConfig: {
                                            valueType: "processVar",
                                            value: `\${${startId}}.formInstId`
                                        }
                                    }]
                                },
                                rulesFilter,
                                rulesFilterType: "all",
                                outputs
                            },
                            children: [
                                {
                                    name: { type: "i18n", zh_CN: "新增数据", en_US: "Add data" },
                                    type: "AddDataNode",
                                    props: {
                                        id: addId,
                                        title: { type: "i18n", zh_CN: "写入明细表", en_US: "Add data" },
                                        version: "1.0.0",
                                        description: { type: "i18n", zh_CN: "写入明细表", en_US: "Add data" },
                                        addData: {
                                            targetItem: {
                                                appId,
                                                appName,
                                                formItem: { formUuid: detailFormUuid, formName: detailFormName }
                                            },
                                            isEnableSystemField: false,
                                            rules: mappingRules,
                                            outputs: [{
                                                value: "formInstId",
                                                text: "实例 ID",
                                                componentName: "TextField",
                                                props: {},
                                                supportSort: true
                                            }]
                                        }
                                    }
                                }
                            ]
                        }
                    },
                    {
                        name: { type: "i18n", zh_CN: "end", en_US: "end" },
                        type: "EndNode",
                        props: { id: endId }
                    }
                ]
            }
        };

        const processCode = `PROC_${Date.now().toString(36).toUpperCase()}_SYNC`;
        payload.schema.processCode = processCode;
        payload.schema.bindingForm = masterFormUuid;

        return { payload, processCode };
    }

    /**
     * 一键生成明细同步集成自动化
     */
    static async createDetailSyncAutomation(options) {
        const {
            appId,
            appName,
            masterFormName,
            masterFormUuid,
            subFormFieldId,
            subFormLabel,
            detailFormUuid,
            detailFormName,
            detailFields,
            subTableFields,
            masterFields,
            fieldMapping
        } = options;

        try {
            console.log("[ProcessService] 开始生成明细表同步集成自动化，源表单：", masterFormName, "目标明细表：", detailFormName);

            // 获取目标表单的完整 schema，以获取字段组件配置
            let detailFieldDefinitions = detailFields;
            try {
                const schemaRes = await global.services.getFormSchemaByUuid(detailFormUuid, appId);
                if (schemaRes && schemaRes.content) {
                    const parsed = typeof schemaRes.content === 'string' ? JSON.parse(schemaRes.content) : schemaRes.content;
                    const extracted = ProcessService.extractFieldListFromFormSchema(parsed);
                    if (extracted.length) {
                        detailFieldDefinitions = extracted;
                    }
                }
            } catch (err) {
                console.warn("[ProcessService] 获取目标表单详细 schema 失败，使用简略版字段列表", err);
            }

            const { payload, processCode } = ProcessService.buildDetailSyncPayload({
                appId,
                appName,
                masterFormName,
                masterFormUuid,
                subFormFieldId,
                subFormLabel,
                detailFormUuid,
                detailFormName,
                detailFields,
                subTableFields,
                masterFields,
                fieldMapping,
                detailFieldDefinitions
            });

            console.log("[ProcessService] 构造的集成自动化 payload:", payload);

            // 【关键修改点】：使用 { json: ..., viewJson: ... } 结构包装，以支持 isLogic=false 模式
            const finalPayload = {
                json: payload,
                viewJson: payload
            };

            // 为了跨组织导入方法正常工作，附加 meta 信息
            finalPayload.__migrationMeta = {
                source: {
                    appName: appName,
                    formName: masterFormName,
                }
            };
            finalPayload.__customProcessName = `同步明细-${masterFormName}-${subFormLabel}`;

            const importRes = await ProcessService.importPayload(finalPayload);

            if (importRes && importRes.success) {
                return { success: true, message: '集成自动化流程生成成功！', processCode: importRes.processCode };
            } else {
                return { success: false, message: '集成自动化流程生成失败' };
            }

        } catch (error) {
            console.error("[ProcessService] 生成集成自动化流程失败:", error);
            return { success: false, message: `生成集成自动化流程异常: ${error.message}` };
        }
    }

    /**
     * 获取所有流程列表
     */
    static async getAllFlows(appIdParam) {
        try {
            const appId = appIdParam || global.services.getAppId();
            const pageSize = 50;
            let pageIndex = 1;
            let allFlows = [];
            let hasMore = true;

            while (hasMore) {
                const res = await global.services.getListFlow(appId, pageIndex, pageSize);
                if (!res || !res.content || !res.content.data) {
                    break;
                }
                const items = res.content.data;
                if (!Array.isArray(items) || items.length === 0) break;

                // 兼容两种返回结构：
                // - 分组结构（审批类 type=1 等）: [{ flowList: [...] }]
                // - 平铺结构（集成自动化 type=5,6）: [{ processCode, name, eventType, ... }]
                if (items[0].processCode !== undefined) {
                    allFlows = allFlows.concat(items);
                } else {
                    items.forEach(group => {
                        const flowList = Array.isArray(group.flowList) ? group.flowList : [];
                        allFlows = allFlows.concat(flowList);
                    });
                }
                hasMore = items.length === pageSize;
                pageIndex++;
            }

            return allFlows;
        } catch (err) {
            console.error('[ProcessService] getAllFlows error:', err);
            throw err;
        }
    }

    /**
     * 批量导入 Payload (支持数组格式)
     */
    static async importBatchPayload(payloads, onProgress, targetAppId) {
        if (!Array.isArray(payloads)) {
            throw new Error('批量导入需要传入数组格式的 Payload');
        }

        const results = {
            total: payloads.length,
            successCount: 0,
            failedCount: 0,
            errors: []
        };

        for (let i = 0; i < payloads.length; i++) {
            const item = payloads[i];
            const sourceProcessCode = item.processCode || item.props?.processCode || '';
            const flowName = item.__customProcessName || ProcessService.resolveSourceFormName(item, item.json || item) || `未命名流程${i + 1}`;

            try {
                const res = await ProcessService.importPayload(item, targetAppId);
                if (res && res.success) {
                    results.successCount++;
                    console.log(`[ProcessService] 批量导入进度 ${i + 1}/${payloads.length}: ${flowName} 成功`);
                } else {
                    results.failedCount++;
                    results.errors.push({ index: i, sourceProcessCode, flowName, message: res?.message || '未知错误' });
                }
            } catch (err) {
                results.failedCount++;
                results.errors.push({ index: i, sourceProcessCode, flowName, message: err.message });
                console.error(`[ProcessService] 批量导入进度 ${i + 1}/${payloads.length}: ${flowName} 失败`, err);
            }

            if (onProgress) {
                onProgress({ current: i + 1, total: payloads.length, flowName });
            }

            await Utils.sleep(500);
        }

        return results;
    }

    /**
     * 批量导出流程 Payload
     */
    static async exportBatchPayload(options = {}) {
        try {
            const appId = options.appId || global.services.getAppId();

            let codesToExport = options.processCodes || [];
            if (!codesToExport.length) {
                const allFlows = await ProcessService.getAllFlows(appId);
                codesToExport = allFlows.map(f => f.processCode).filter(Boolean);
            }

            if (!codesToExport.length) {
                throw new Error('没有可导出的流程');
            }

            const exportedData = [];
            const appNameRes = await global.services.getAppList();
            let appName = '';
            if (appNameRes && appNameRes.content && appNameRes.content.data) {
                const app = appNameRes.content.data.find(a => a.appType === appId);
                appName = app ? app.appName.zh_CN : '';
            }

            // 获取当前应用下所有表单列表，用于按 formUuid 反查 formName
            let allAppForms = [];
            try {
                const listRes = await global.services.getListFieldInApp(appId);
                allAppForms = listRes && Array.isArray(listRes.content) ? listRes.content : [];
            } catch (e) { console.warn('获取表单列表失败', e); }

            const resolveFormName = (targetFormUuid) => {
                if (!targetFormUuid) return '';
                const formItem = allAppForms.find(f => (f.formUuid || f.id || f.formId) === targetFormUuid);
                if (formItem) {
                    return typeof formItem.formName === 'string' ? formItem.formName :
                        (formItem.title?.zh_CN || formItem.title || '');
                }
                return '';
            };

            // 补充应用名称宏 (如 丹羽ERP-财务管理 -> 财务管理)
            const appMacroName = ProcessService.getMacroName(appName);

            for (let i = 0; i < codesToExport.length; i++) {
                const processCode = codesToExport[i];
                console.log(`[ProcessService] 正在导出流程 ${i + 1}/${codesToExport.length}: ${processCode}`);

                if (options.onProgress) {
                    options.onProgress({ current: i + 1, total: codesToExport.length, processCode });
                }

                const processRes = await global.services.getProcess(processCode, appId);
                if (!processRes || !processRes.content) {
                    console.warn(`流程 ${processCode} 获取失败`);
                    continue;
                }

                const rawContent = typeof processRes.content === 'string' ? processRes.content : JSON.stringify(processRes.content);
                let parsedContent;
                try {
                    parsedContent = JSON.parse(rawContent);
                } catch (e) {
                    console.warn(`流程 ${processCode} 解析失败`);
                    continue;
                }

                // 尝试获取该流程的名称（从列表中查）和它所属的表单
                let flowName = processCode;
                let currentFlowFormUuid = '';
                let currentFlowEventType = null;
                try {
                    const allFlows = await ProcessService.getAllFlows(appId);
                    const flowItem = allFlows.find(f => f.processCode === processCode);
                    if (flowItem) {
                        const rawName = flowItem.name;
                        if (rawName) {
                            if (typeof rawName === 'string') {
                                flowName = rawName;
                            } else if (rawName.zh_CN) {
                                flowName = rawName.zh_CN;
                            }
                        }
                        if (flowItem.formUuid) currentFlowFormUuid = flowItem.formUuid;
                        if (flowItem.eventType != null) currentFlowEventType = flowItem.eventType;
                    }
                } catch (e) { }

                const flowFormName = resolveFormName(currentFlowFormUuid);

                const exportItem = {
                    json: parsedContent,
                    viewJson: parsedContent,
                    formUuid: currentFlowFormUuid,
                    processCode: processCode,
                    __customProcessName: flowName,
                    __migrationMeta: {
                        source: {
                            appId,
                            appName,
                            appMacroName,
                            formUuid: currentFlowFormUuid,
                            formName: flowFormName,
                            eventType: currentFlowEventType
                        },
                        exportedAt: new Date().toISOString()
                    }
                };
                exportedData.push(exportItem);

                await Utils.sleep(300); // 防限流
            }

            if (!exportedData.length) {
                throw new Error('所有流程均导出失败');
            }

            return {
                success: true,
                count: exportedData.length,
                data: exportedData,
                jsonString: JSON.stringify(exportedData, null, 2)
            };

        } catch (err) {
            console.error('[ProcessService] exportBatchPayload error:', err);
            throw err;
        }
    }


    /**
     * 从 JSON 字符串中提取所有 appId 的值（格式如 APP_xxx）
     * @param {string} jsonStr - 合法的 JSON 字符串
     * @returns {Set<string>} 包含所有 appId 值的 Set
     */
    static getAppIdsFromJsonString(jsonStr) {
        const regex = /"(?:appId|appType)"\s*:\s*"(APP_[A-Z0-9]+)"/g;
        const ids = new Set();
        let match;
        while ((match = regex.exec(jsonStr)) !== null) {
            ids.add(match[1]);
        }
        return ids;
    }

    /**
     * 从 JSON 字符串中提取所有 formUuid 的值（格式如 FORM-xxxx）
     * @param {string} jsonStr - 合法的 JSON 字符串
     * @returns {Set<string>} 包含所有 formUuid 值的 Set
     */
    static getFormUuidsFromJsonString(jsonStr) {
        // 匹配 "formUuid": "FORM-XXX" 其中 XXX 由大写字母、数字、连字符组成（可根据实际格式调整）
        const regex = /"formUuid"\s*:\s*"(FORM-[A-Z0-9-]+)"/g;
        const uuids = new Set();
        let match;
        while ((match = regex.exec(jsonStr)) !== null) {
            uuids.add(match[1]);
        }
        return uuids;
    }

    /**
     * 从解析后的 JSON 数据中提取依赖关系对
     * @param {Object} parsed - 解析后的 JSON 数据
     * @param {Object} form - 表单数据
     * @returns {Array} 依赖关系对数组
     */
    static extractDependencyPairs(parsed, form){
        console.log("parsed", parsed);
    }
}
