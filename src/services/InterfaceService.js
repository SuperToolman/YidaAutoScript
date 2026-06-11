import global from '../global.js';
import Utils from '@/services/shared/BrowserUtilsService';
import ConvertModule from '@/services/schema/SchemaConvertService';

export default class InterfaceService {


    // #region 应用结构与应用信?
    async getAppList() {
        const requestUrl = `${window.location.origin}/query/app/getAppList.json?pageSize=50`;
        return await Utils.fetchJson(requestUrl, { method: 'GET', headers: { 'Accept': 'application/json, text/json', 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include' });
    }

    /**
     * 获取完整的应?表单结构?
     * 作用：用于跨组织迁移时的名称匹配?ID 置换映射
     */
    async getFullAppStructure() {
        try {
            // 1. 获取当前用户权限下的所有应用列?
            const appListRes = await this.getAppList();

            if (!appListRes || !appListRes.content || !appListRes.content.data) {
                console.error("无法获取应用列表");
                return null;
            }
            const apps = appListRes.content.data;
            const fullStructure = [];

            // 2. 采用批处理方式拉取详情，防止瞬时请求过多触发宜搭风控
            const BATCH_SIZE = 10;
            for (let i = 0; i < apps.length; i += BATCH_SIZE) {
                const batch = apps.slice(i, i + BATCH_SIZE);
                const batchPromises = batch.map(async (app) => {
                    try {
                        // 3. 构造应用基础信息
                        const appInfo = {
                            appId: app.appType,
                            appName: app.appName.zh_CN,
                            systemToken: app.appToken || app.systemToken || '',                     // 存储应用 Token，用于后?API 模板自动替换 ##{systemToken}##
                            appOriginalName: app.appName.zh_CN.split("-")[1] || app.appName.zh_CN,  // 关键逻辑：提取横杠后的原始名称，用于跨组织（如“丹宇”到“卓越”）的模糊匹?
                            corpId: app.corpId,
                            systemLink: app.systemLink,
                            lastEditorName: app.lastEditorName,
                            forms: []
                        };

                        // 4. 获取该应用下的所有表单列?
                        const formsRes = await global.services.getListFieldInApp(app.appType);

                        if (formsRes && formsRes.content) {
                            appInfo.forms = formsRes.content.map(form => {
                                const getText = (val) => {
                                    if (typeof val === 'string') return val;
                                    if (val && typeof val === 'object') {
                                        return val.zh_CN || (val.name && val.name.zh_CN) || (val.title && val.title.zh_CN) || val.name || val.title || val.label || '';
                                    }
                                    return '';
                                };
                                // 5. 规范化表单元数据，确保不同接口返回的字段能统一处理
                                return {
                                    formId: form.formUuid || form.id,
                                    formName: getText(form.formName) || (form.title && form.title.zh_CN) || getText(form.title),
                                    formType: form.formType,
                                    fields: form.fields || []
                                };
                            });
                        }
                        return appInfo;
                    } catch (error) {
                        console.error(`获取应用 ${app.appName.zh_CN} 的表单数据失?`, error);
                        return { appId: app.appType, appName: app.appName.zh_CN, error: error.message, forms: [] };
                    }
                });

                // 并发执行当前批次的请?
                const batchResults = await Promise.all(batchPromises);
                fullStructure.push(...batchResults);
                // 依靠 BATCH_SIZE 控制并发压力，不再使用强?sleep
            }
            return fullStructure;
        } catch (error) {
            console.error('[InterfaceService.getFullAppStructure] 构建应用-表单结构失败:', error);
            return null;
        }
    }

    async getFullAppStructureByInitialization() {
        Utils.toast({ title: '正在拉取当前组织的应用结构以供匹?..', type: 'info' });
        try {
            const raw = await this.getFullAppStructure();
            const apps = Utils.getFullStructureApps(raw);
            global.info.appStructure = apps;
            console.log("global.info.appStructure已初始化", global.info.appStructure);
            // global.fullStructure = apps;
        } catch (e) {
            console.error('拉取应用列表失败', e);
        }
    }

    // 获取表单自定义按钮
    async getButtonConfigs(targetAppId, targetFormUuid) {
        const csrf_token = this.getCsrfToken();
        const requestUrl = `${window.location.origin}/dingtalk/web/${targetAppId}/query/customButtonManage/list.json?_api=nattyFetch&_mock=false&formUuid=${targetFormUuid}&_csrf_token=${csrf_token}&_stamp=${Date.now()}`;
        return await Utils.fetchJson(requestUrl, { method: 'GET', headers: { 'Accept': 'application/json, text/json', 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include' });
    }

    // 保存表单自定义按钮
    async saveButtonConfig(targetAppId, targetFormUuid, buttonConfig = null) {
        const requestUrl = `${window.location.origin}/dingtalk/web/${targetAppId}/query/customButtonManage/saveButtonConfig.json?_api=nattyFetch&_mock=false&_stamp=${Date.now()}`
        const csrfToken = this.getCsrfToken();

        const formData = new FormData();
        formData.append('_csrf_token', csrfToken);
        formData.append('formUuid', targetFormUuid);
        formData.append('name', JSON.stringify(buttonConfig.name));
        formData.append('actionType', buttonConfig.actionType);
        formData.append('icon', JSON.stringify(buttonConfig.icon));
        formData.append('permissionConfig', JSON.stringify(buttonConfig.permissionConfig));
        formData.append('actionConfig', JSON.stringify(buttonConfig.actionConfig));
        formData.append('tableViewUuids', buttonConfig.tableViewUuids);
        formData.append('detailId', buttonConfig.detailId);
        formData.append('relationId', buttonConfig.relationId);

        return await Utils.fetchJson(requestUrl, {
            method: 'POST',
            headers: { 'Accept': 'application/json, text/json', 'X-Requested-With': 'XMLHttpRequest', '_csrf_token': csrfToken },
            credentials: 'include',
            body: formData
        });
    }
    /**
     * 获取指定表单的应?表单结构数据
     * @param {string} formUuidParam - 表单的唯一标识?
     * @param {string} appIdParam - 可选的应用ID参数，默认从 global.info.appId 获取
     * @returns {Promise<Object>} - 包含表单和应用信息的对象
     */
    // #endregion

    // #region 表单与数据源读取
    async getFormSchema(formUuidParam, appIdParam) {
        const currentFormUuid = global.info && global.info.formUuid;
        const shouldUseCachedSchema = !!(global.info && global.info.formSchema) &&
            (!formUuidParam || (currentFormUuid && String(formUuidParam) === String(currentFormUuid)));
        if (shouldUseCachedSchema) {
            return global.info.formSchema;
        }

        const appId = appIdParam || (global.info && global.info.appId);
        const formUuid = formUuidParam || (global.info && global.info.formUuid);
        if (!formUuid) {
            Utils.log('[InterfaceService.getFormSchema] formUuid为空，禁止调?getFormSchema', 'error');
            return null;
        }
        const requestUrl = `${window.location.origin}/alibaba/web/${appId}/_view/query/formdesign/getFormSchema.json?_api=nattyFetch&_mock=false&formUuid=${encodeURIComponent(formUuid)}&schemaVersion=V5&_stamp=${Date.now()}`;
        const res = await Utils.fetchJson(requestUrl, { method: 'GET', headers: { 'Accept': 'application/json, text/json', 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include' });
        if (res.content) {
            Utils.log('[InterfaceService.getFormSchema] 成功获取表单Schema');
            return res.content;
        }
        Utils.log('[InterfaceService.getFormSchema] 获取表单Schema失败', 'error');
        return null;
    }

    /**
     * 获取指定表单的应?表单结构数据
     * @param {string} formUuid - 表单的唯一标识?
     * @param {string} appIdParam - 可选的应用ID参数，默认从 global.info.appId 获取
     * @returns {Promise<Object>} - 包含表单和应用信息的对象
     */
    async getFormAndAppInfo(formUuid, appIdParam) {
        const appId = appIdParam || (global.info && global.info.appId);
        const params = new URLSearchParams({
            _api: 'nattyFetch',
            _mock: 'false',
            _csrf_token: this.getCsrfToken(),
            _locale_time_zone_offset: new Date().getTimezoneOffset() * -60000,
            formTypes: 'process',
            appType: appId,
            formUuid: formUuid,
            _stamp: Date.now()
        });
        const requestUrl = `${window.location.origin}/dingtalk/web/${appId}/query/formdesign/getFormAndAppInfo.json?${params}`;
        return await Utils.fetchJson(requestUrl, { method: 'GET', headers: { 'Accept': 'application/json, text/json', 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include' });
    }

    /**
     * 根据appId来查询该应用下的所有数据源
     * @param {string} appIdParam - 叔用ID参数，默认从 global.info.appId 获取
     * @returns {Promise<Array>} - 包含所有数据源的数?
     */
    async searchCubeList(appIdParam) {
        const pageSize = 100;
        const pageIndex = 1;
        const _csrf_token = this.getCsrfToken();

        const appId = appIdParam || (global.info && global.info.appId);
        const requestUrl = `${window.location.origin}/${appId}/visual/datasetRpc/searchCubeList.json?_api=Permission.searchCubeList&_mock=false&_csrf_token=${_csrf_token}&_locale_time_zone_offset=28800000&pageIndex=${pageIndex}&pageSize=${pageSize}&_stamp=${Date.now()}`;
        return await Utils.fetchJson(requestUrl, { method: 'GET', headers: { 'Accept': 'application/json, text/json', 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include' });
    }

    /**
     * 添加跨应用数据源
     * @param {string} appIdParam - 叔用ID参数，默认从 global.info.appId 获取
     * @param {string} targetAppId - 目标应用ID参数
     * @param {string} targetFormUuid - 目标表单UUID参数
     * @param {string} tableComment - 完整的数据源表单名称，例如结构为项目研发.项目立项，则传递项目立项即可，如果包含子表则传递项目立?子表名称
     * @returns {Promise<Object>} - 包含添加结果的对?
     */
    async addDataSourceTable(appIdParam, targetAppId, targetFormUuid, tableComment) {
        const appId = appIdParam || (global.info && global.info.appId);
        if (!appId) throw new Error("无法获取 appId，请确认当前处于宜搭环境");
        const csrfToken = this.getCsrfToken();

        // 关键修复：完全匹配截图上的域名和路径，即 /dingtalk/web/...
        const requestUrl = `${window.location.origin}/dingtalk/web/${appId}/data/datasourceRpc/addDataSourceTable.json?_api=AcrossApp.saveForm&_mock=false&_stamp=${Date.now()}`;

        const formData = new FormData();
        if (csrfToken) formData.append('_csrf_token', csrfToken);
        formData.append('_locale_time_zone_offset', String(new Date().getTimezoneOffset() * -60000));
        formData.append('namespaceCode', appId);
        formData.append('tableList', JSON.stringify([{
            "schemaCode": targetAppId,
            "tableName": targetFormUuid,
            "tableComment": tableComment
        }]));

        return await Utils.fetchJson(requestUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/json, text/json',
                'X-Requested-With': 'XMLHttpRequest',
                '_csrf_token': csrfToken
            },
            credentials: 'include',
            body: formData
        });
    }

    /**
     * 获取指定表单的变量数?
     * @param {string} formUuidParam - 表单的唯一标识?
     * @param {string} appIdParam - 可选的应用ID参数，默认从 global.info.appId 获取
     * @returns {Promise<Array>} - 包含表单变量的数?
     */
    async getFormVariables(formUuidParam, appIdParam) {
        const appId = appIdParam || (global.info && global.info.appId);
        const formUuid = formUuidParam || (global.info && global.info.formUuid);
        if (!formUuid) {
            Utils.log('[InterfaceService.getFormVariables] formUuid为空，禁止调?getFormVariables', 'error');
            return null;
        }
        const requestUrl = `${window.location.origin}/alibaba/web/${appId}/query/formProcInstData/getFormVariables.json`;
        const data = await Utils.fetchJson(requestUrl, { method: 'GET', headers: { 'Accept': 'application/json, text/json', 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include' });
        if (!data || !data.content || !Array.isArray(data.content)) return null;
        const field_exclude_components = ['processInstanceTitle', 'originator', 'originatorCorp', 'createTime', 'modifiedTime', 'processInstanceId'];
        return data.content.filter(item => {
            const componentId = item.componentId || item.fieldId || item.id;
            if (!componentId) return true;
            return !field_exclude_components.includes(componentId);
        });
    }

    async fetchAllForms(appIdParam, options = {}) {
        const appId = appIdParam || (global.info && global.info.appId);
        const requestUrl = `${window.location.origin}/${appId}/query/formnav/getFormNavigationListByOrder.json?_api=Nav.queryList&_mock=false`;
        const data = await Utils.fetchJson(requestUrl, { method: 'GET', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }, credentials: 'include' });
        if (!data || !data.content || !Array.isArray(data.content)) return [];

        const excludeForms = ['\u5F85\u6211\u5904\u7406', '\u6211\u5DF2\u5904\u7406', '\u6211\u521B\u5EFA\u7684', '\u6284\u9001\u6211\u7684'];
        const includeNav = options.includeNav;
        const normalizeTitle = (item) => {
            const t = item.i18nTitle || item.title;
            if (!t) return '';
            if (typeof t === 'string') return t;
            return t.zh_CN || t.en_US || '';
        };

        if (includeNav) {
            return data.content
                .filter(item => !excludeForms.includes(normalizeTitle(item)))
                .map(item => ({
                    id: item.id,
                    navUuid: item.navUuid || '',
                    parentNavUuid: item.parentNavUuid || '',
                    navType: item.navType || '',
                    formUuid: item.formUuid || null,
                    relateFormUuid: item.relateFormUuid || null,
                    formType: item.formType || '',
                    title: normalizeTitle(item),
                    listOrder: item.listOrder != null ? item.listOrder : 0
                }));
        }

        return data.content.filter(item => {
            const formName = item.i18nTitle?.zh_CN;
            return item.formUuid && formName && !excludeForms.includes(formName);
        });
    }

    async getListFieldInApp(appIdParam) {
        const appId = appIdParam || (global.info && global.info.appId);
        const requestUrl = `${window.location.origin}/alibaba/web/${appId}/query/formdesign/listFieldInApp.json`;
        const result = await Utils.fetchJson(requestUrl, { method: 'GET', headers: { 'Accept': 'application/json, text/json', 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include' });
        // console.log("getListFieldInApp?, result)
        return result
    }

    // #endregion

    // #region 页面上下文与鉴权
    getAppId() {
        let appId = global.info && global.info.appId;
        if (!appId) {
            const urlObj = new URL(window.location.href);
            const pathSegments = urlObj.pathname.split('/').filter(seg => seg.length > 0);
            for (const segment of pathSegments) {
                if (segment.startsWith('APP_')) {
                    appId = segment;
                    break;
                }
            }
        }
        return appId;
    }

    getFormUuid() {
        const isValidFormUuid = (val) => typeof val === 'string' && val.startsWith('FORM-');
        let formUuid = global.info && global.info.formUuid;
        if (!isValidFormUuid(formUuid)) formUuid = '';
        if (!formUuid) {
            const urlObj = new URL(window.location.href);
            formUuid = urlObj.searchParams.get('formUuid');
            if (!isValidFormUuid(formUuid)) formUuid = '';
            if (!formUuid) {
                const pathSegments = urlObj.pathname.split('/').filter(seg => seg.length > 0);
                for (let i = pathSegments.length - 1; i >= 0; i--) {
                    if (pathSegments[i].startsWith('FORM-')) {
                        formUuid = pathSegments[i];
                        break;
                    }
                }
            }
        }
        return formUuid;
    }

    /**
     * 获取CSRF Token
     * @returns {string} CSRF Token?
     */
    getCsrfToken() {
        if (global.info.csrfToken) return global.info.csrfToken;

        const tokenDom = document.getElementsByName('_csrf_token');
        const csrfToken = tokenDom && tokenDom.length ? (tokenDom[0] || {}).value : '';
        global.info.csrfToken = csrfToken;
        return csrfToken;
    }
    // #endregion

    // #region 流程读取与保?
    async getListFlow(appIdParam, pageIndex = 1, pageSize = 10, formUuid = '') {
        const appId = appIdParam || (global.info && global.info.appId);
        const csrfToken = this.getCsrfToken();
        const params = new URLSearchParams({
            _api: 'Connector.getListflow',
            _mock: 'false',
            _csrf_token: csrfToken,
            _locale_time_zone_offset: String(new Date().getTimezoneOffset() * -60000),
            type: '1,2,3,4,5,6',
            key: '',
            appType: appId,
            formUuid: formUuid,
            status: '',
            pageIndex: String(pageIndex),
            pageSize: String(pageSize),
            _stamp: String(Date.now())
        });
        const requestUrl = `${window.location.origin}/alibaba/web/${appId}/query/appLogicflowBinding/listflow.json?${params}`;
        return await Utils.fetchJson(requestUrl, { method: 'GET', headers: { 'Accept': 'application/json, text/json', 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include' });
    }

    async getAllFlows(appIdParam) {
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

                // 兼容两种返回结构：分组结构（审批类）和平铺结构（集成自动化）
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
            console.error('[InterfaceService] getAllFlows error:', err);
            throw err;
        }
    }

    async getAllFlowsByFormUuid(appIdParam, formUuid) {
        if (!formUuid) return [];

        try {
            const appId = appIdParam || this.getAppId();
            const pageSize = 50;
            let pageIndex = 1;
            let allFlows = [];
            let hasMore = true;

            while (hasMore) {
                const res = await this.getListFlow(appId, pageIndex, pageSize, formUuid);
                const items = Array.isArray(res?.content?.data) ? res.content.data : [];
                if (!items.length) break;

                // 兼容两种返回结构：分组结构（审批类）和平铺结构（集成自动化）
                let pageFlows;
                if (items[0].processCode !== undefined) {
                    pageFlows = items;
                } else {
                    pageFlows = items.flatMap(group => Array.isArray(group.flowList) ? group.flowList : []);
                }

                allFlows = allFlows.concat(pageFlows);
                hasMore = pageFlows.length === pageSize;
                pageIndex++;
            }

            return allFlows;
        } catch (err) {
            console.error('[InterfaceService] getAllFlowsByFormUuid error:', err);
            throw err;
        }
    }

    async getProcess(processCodeParam, appIdParam, isLogic = true) {
        const appId = appIdParam || this.getAppId();
        const processCode = processCodeParam || (global.info && global.info.processCode);
        const requestUrl = `${window.location.origin}/alibaba/web/${appId}/query/simpleProcess/getProcess.json?processCode=${processCode}&isLogic=${isLogic}`;
        return await Utils.fetchJson(requestUrl, { method: 'GET', headers: { 'Accept': 'application/json, text/json', 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include' });
    }

    async createLogicflow(name, formUuidParam, eventType = 1) {
        const appId = this.getAppId();
        if (!appId) throw new Error("无法获取 appId，请确认当前处于宜搭环境");

        const requestUrl = `${window.location.origin}/alibaba/web/${appId}/query/formLogicflowBinding/createLogicflow.json?_api=Connector.createFlow&_mock=false&_stamp=${Date.now()}`;
        const csrfToken = this.getCsrfToken();
        const formData = new FormData();
        if (csrfToken) formData.append('_csrf_token', csrfToken);
        formData.append('_locale_time_zone_offset', String(new Date().getTimezoneOffset() * -60000));
        formData.append('name', String(name || ''));
        formData.append('type', String(eventType));
        formData.append('formUuid', String(formUuidParam || ''));
        return await Utils.fetchJson(requestUrl, {
            method: 'POST',
            headers: { 'Accept': 'application/json, text/json', 'X-Requested-With': 'XMLHttpRequest', '_csrf_token': csrfToken },
            credentials: 'include',
            body: formData
        });
    }

    async saveProcess(formUuid, processCode, processJson, viewJson, isLogic = 'true', extraParams = {}) {
        const appId = this.getAppId();

        if (!appId) {
            console.error("未找到appId，无法保存流");
            return { success: false, errorMsg: "未找到appId" };
        }
        if (!processCode || !processJson) {
            console.error("processCode或processJson为空");
            return { success: false, errorMsg: "processCode或processJson为空" };
        }

        const csrfToken = this.getCsrfToken();

        // 对齐 yida_script.js 的稳定保存链路：统一调用 simpleProcess/saveProcess.json
        const requestUrl = `${window.location.origin}/alibaba/web/${appId}/query/simpleProcess/saveProcess.json`;
        const formData = new FormData();
        formData.append('_csrf_token', csrfToken);
        formData.append('formUuid', formUuid);

        // 关键修复：允许调用方动态传?isLogic 参数（如 false），以前被硬编码覆盖?'true' 了！
        const finalIsLogic = isLogic !== undefined ? String(isLogic) : 'true';
        formData.append('isLogic', finalIsLogic);
        formData.append('isOnline', 'false');

        const jsonStr = typeof processJson === 'string' ? processJson : JSON.stringify(processJson);
        const viewJsonStr = viewJson ? (typeof viewJson === 'string' ? viewJson : JSON.stringify(viewJson)) : jsonStr;

        formData.append('json', jsonStr);
        formData.append('viewJson', viewJsonStr);

        formData.append('needReportLine', extraParams.needReportLine || 'y');
        formData.append('processCode', extraParams.processCode || processCode);

        try {
            const response = await fetch(requestUrl, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json, text/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'include',
                body: formData
            });

            // 兼容性处理：如果返回的不是JSON，先拿到文本再尝试解?
            const responseText = await response.text();
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                // 如果后端返回?HTML 或纯文本错误信息
                console.error("保存流程接口返回了非 JSON 格式:", responseText);
                return { success: false, errorMsg: `接口响应异常: ${response.status} ${response.statusText}`, raw: responseText };
            }

            return data;
        } catch (error) {
            console.error("保存流程请求异常:", error);
            return { success: false, errorMsg: error.message };
        }
    }

    async getProcessVersion(appId, processCode) {
        if (!appId || !processCode) {
            console.error("appId或processCode为空");
            return { success: false, errorMsg: "appId或processCode为空" };
        }
        const csrfToken = this.getCsrfToken();
        const requestUrl = `${window.location.origin}/alibaba/web/${appId}/query/simpleProcess/pageProcessVersion.json`;
        const formData = new FormData();
        formData.append('_csrf_token', csrfToken);
        formData.append('processCode', processCode);
        formData.append('currentPage', '1');
        formData.append('pageSize', '10');

        try {
            const response = await fetch(requestUrl, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error("获取流程版本请求异常:", error);
            return { success: false, errorMsg: error.message };
        }
    }

    // #endregion

    // #region 表单写入与导航管?
    /**
         * 创建新的审批表单
         * @param {string} newTitle - 审批表单的标?
         * @param {string} type - 审批表单的类型，默认?'process'
         * @param {string} targetAppId - 目标应用ID（可选，默认使用当前环境 appId?
         * @returns {Promise} - 返回创建审批表单的结?
         */
    async createNewForm(newTitle, type, targetAppId) {
        const appId = targetAppId || global.info?.appId;
        if (!appId) throw new Error("无法获取目标 appId，请确认已选择目标应用");
        // 生成随机的表单UUID
        const requestUrl = `${window.location.origin}/dingtalk/web/${appId}/query/formdesign/saveFormSchemaInfo.json?_api=Form.save&_mock=false&_stamp=${Date.now()}`

        const formData = new FormData();
        formData.append('_csrf_token', this.getCsrfToken());
        formData.append('_locale_time_zone_offset', '28800000');
        formData.append('formType', type || 'process') // 创建流程表单
        formData.append('parentNavUuid', "");
        formData.append('relateFormType', 'receipt');
        formData.append('relateFormUuid', "");
        formData.append('title', JSON.stringify({
            "zh_CN": newTitle,
            "en_US": "UnNamed+Process+Form",
            "type": "i18n"
        }));

        const res = await Utils.fetchJson(requestUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/json, text/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'include',
            body: formData
        });
        console.log(`[InterfaceService.createNewForm] 接口返回:`, res);
        return res;
    }

    async saveFormSchema(schemaValue, formUuidParam, appIdParam, options = {}) {
        const appId = appIdParam || (global.info && global.info.appId);
        const formUuid = formUuidParam || (global.info && global.info.formUuid);
        const csrfToken = this.getCsrfToken();

        // 关键更新：使用最新的接口参数名和 API 名称
        const requestUrl = `${window.location.origin}/alibaba/web/${appId}/_view/query/formdesign/saveFormSchema.json?_api=uipaasSchema.save&_mock=false&_stamp=${Date.now()}`;

        const formData = new FormData();
        formData.append('formUuid', formUuid);
        formData.append('schemaVersion', 'V5');
        formData.append('domainCode', 'tEXDRG'); // 增加缺失?domainCode

        // 关键逻辑：根?newTest2 的特征，参数名应?'content'
        const finalSchema = typeof schemaValue === 'object' ? JSON.stringify(schemaValue) : schemaValue;
        formData.append('content', finalSchema);

        if (csrfToken) formData.append('_csrf_token', csrfToken);

        const res = await Utils.fetchJson(requestUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/json, text/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'include',
            body: formData
        });
        console.log(`[InterfaceService.saveFormSchema] 接口返回:`, res);
        return res;
    }

    async getFormNameByFormUuid(formUuid) {
        const uuid = String(formUuid || '').trim();
        if (!uuid) return null;
        const appId = (global.info && global.info.appId) || '';

        const apps = await this.ensureFullStructure();
        const getText = (val) => {
            if (typeof val === 'string') return val;
            if (val && typeof val === 'object') {
                return val.zh_CN || (val.name && val.name.zh_CN) || (val.title && val.title.zh_CN) || val.name || val.title || val.label || '';
            }
            return '';
        };

        if (Array.isArray(apps) && apps.length) {
            const appInfo = apps.find(a => a && (a.appId === appId || a.appType === appId));
            if (appInfo) {
                const forms = appInfo.forms || appInfo.formList || appInfo.children || appInfo.items || appInfo.pages || [];
                if (Array.isArray(forms)) {
                    const hit = forms.find(f => {
                        const fid = f.formId || f.formUuid || f.id;
                        return String(fid || '') === uuid;
                    });
                    if (hit) {
                        return getText(hit.formName) || (hit.title && hit.title.zh_CN) || getText(hit.title) || null;
                    }
                }
            }
        }

        // 如果全量结构没找到，尝试针对性查询当前应用（保底?
        const listRes = await global.services.getListFieldInApp(appId).catch(() => null);
        if (listRes && Array.isArray(listRes.content)) {
            const hit = listRes.content.find(f => {
                const fid = f.formUuid || f.id || f.formId;
                return String(fid || '') === uuid;
            });
            if (hit) {
                return getText(hit.formName) || (hit.title && hit.title.zh_CN) || getText(hit.title) || null;
            }
        }
        return null;
    }

    /**
     * 创建表单分组导航
     * @param {string} title - 分组名称
     * @param {string} appIdParam - 应用ID（可选）
     * @returns {Promise<object|null>} - 创建结果
     */
    async saveFormNavigation(title, appIdParam = "") {
        const appId = appIdParam || this.getAppId();
        const csrfToken = this.getCsrfToken();
        const requestUrl = `${window.location.origin}/dingtalk/web/${appId}/query/formnav/saveFormNavigation.json?_api=Nav.save&_mock=false&_stamp=${Date.now()}`;
        const formData = new FormData();
        formData.append('_csrf_token', csrfToken);
        formData.append('_locale_time_zone_offset', String(new Date().getTimezoneOffset() * -60000));
        formData.append('title', JSON.stringify({ "en_US": "Group", "zh_CN": title, "type": "i18n" }));
        try {
            const response = await fetch(requestUrl, {
                method: 'POST',
                headers: { 'Accept': 'application/json, text/json', 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'include',
                body: formData
            });
            const responseText = await response.text();
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                // 如果后端返回?HTML 或纯文本错误信息
                console.error("创建表单分组接口返回了非 JSON 格式:", responseText);
                return { success: false, errorMsg: `接口响应异常: ${response.status} ${response.statusText}`, raw: responseText };
            }

            return data;
        } catch (error) {
            console.error("创建表单分组请求异常:", error);
            return { success: false, errorMsg: error.message };
        }
    }

    /**
     * 更新表单分组导航顺序
     * @param {string} currentId - 当前_navId
     * @param {string} parentNavUuid - 父_navUuid
     * @param {string} navType - 导航类型
     * @param {string} ids - 导航ID列表字符串，逗号分隔
     * @param {string} appIdParam - 应用ID（可选）
     * @returns {Promise<object|null>} - 更新结果
     */
    async updateFormNavigationOrderNew(currentId, parentNavUuid, navType, ids, appIdParam = "") {
        const csrfToken = this.getCsrfToken();
        const appId = appIdParam || this.getAppId();
        const requestUrl = `${window.location.origin}/dingtalk/web/${appId}/query/formnav/updateFormNavigationOrderNew.json?_api=Nav.updateOrderNew&_mock=false&_stamp=${Date.now()}`;

        const formData = new FormData();
        formData.append('_csrf_token', csrfToken);
        formData.append('_locale_time_zone_offset', String(new Date().getTimezoneOffset() * -60000));
        formData.append('currentId', currentId);
        formData.append('parentNavUuid', parentNavUuid);
        formData.append('navType', navType);
        formData.append('ids', ids);

        try {
            const response = await fetch(requestUrl, {
                method: 'POST',
                headers: { 'Accept': 'application/json, text/json', 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'include',
                body: formData
            });
            const responseText = await response.text();
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                // 如果后端返回?HTML 或纯文本错误信息
                console.error("创建表单分组接口返回了非 JSON 格式:", responseText);
                return { success: false, errorMsg: `接口响应异常: ${response.status} ${response.statusText}`, raw: responseText };
            }

            return data;
        } catch (error) {
            console.error("创建表单分组请求异常:", error);
            return { success: false, errorMsg: error.message };
        }
    }

    /**
     * 根据 Schema 自动创建表单并保?
     * @param {Object} schema 表单 Schema
     * @param {string} targetAppId 目标应用ID（可选）
     * @returns {Promise<string>} 新表单的 UUID
     */
    async createAndSaveFormFromSchema(schema, targetAppId) {
        // 1. 获取原表单标题（优先使用复制时嵌入的 _copyFormName，其次多路径探测?
        let originTitle = schema._copyFormName || '';
        if (!originTitle && schema?.pages?.[0]?.componentsTree?.[0]?.props?.title) {
            originTitle = schema.pages[0].componentsTree[0].props.title;
        }
        if (!originTitle && schema?.pages?.[0]?.componentsTree?.[0]?.props?.label) {
            originTitle = schema.pages[0].componentsTree[0].props.label;
        }
        if (!originTitle && schema?.title) {
            if (typeof schema.title === 'string') {
                originTitle = schema.title;
            } else if (schema.title && schema.title.zh_CN) {
                originTitle = schema.title.zh_CN;
            }
        }
        if (!originTitle && schema?.formName) {
            if (typeof schema.formName === 'string') {
                originTitle = schema.formName;
            } else if (schema.formName && schema.formName.zh_CN) {
                originTitle = schema.formName.zh_CN;
            }
        }
        if (!originTitle) originTitle = '\u672A\u547D\u540D\u8868\u5355';
        Utils.toast({ title: `\u6B63\u5728\u521B\u5EFA\u65B0\u8868\u5355 ${originTitle}`, type: 'info' });

        // 2. 创建新表单（根据原表单类型）
        const formType = schema._copyFormType || schema.formType || 'receipt';
        let res;
        try {
            res = await global.services.createNewForm(originTitle, formType, targetAppId);
        } catch (e) {
            console.error(`[UIModule] createNewForm 调用异常:`, e);
            throw new Error(`创建表单 [${originTitle}] 发生异常: ${e.message}`);
        }

        if (!res) {
            throw new Error(`创建表单 [${originTitle}] 失败，接口返回空`);
        }
        if (!res.success) {
            throw new Error(`创建表单 [${originTitle}] 失败: ${res.errorMsg || res.errorMessage || JSON.stringify(res)}`);
        }
        if (!res.content || !res.content.formUuid) {
            throw new Error(`创建表单 [${originTitle}] 失败，未返回 formUuid`);
        }

        const newFormUuid = res.content.formUuid;
        console.log('[UIModule] 新表单创建成? formUuid:', newFormUuid);

        // 3. Schema 映射转换 (处理关联表单和跨应用数据?
        Utils.toast({ title: `[${originTitle}] 正在执行 Schema 映射转换...`, type: 'info' });
        const pages = Array.isArray(schema.pages) ? schema.pages : [];
        let totalResults = 0;

        const globalJsInfo = await ConvertModule.getConvertInfo({
            actions: schema.actions,
            _idNameMapping: schema._idNameMapping
        });

        if (globalJsInfo && globalJsInfo.resultList && globalJsInfo.resultList.length) {
            if (!schema._globalReplacements) schema._globalReplacements = [];
            schema._globalReplacements.push(...globalJsInfo.resultList);
            totalResults += globalJsInfo.resultList.length;
        }

        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            if (!page || !Array.isArray(page.componentsTree)) continue;
            const infoList = await ConvertModule.getConvertInfo(page);
            if (infoList && infoList.resultList && infoList.resultList.length > 0) {
                infoList.resultList.forEach(item => {
                    if (item.type === 'component') {
                        ConvertModule.replaceAssociationFormInTree(page.componentsTree, item);
                    } else if (item.type === 'datasource') {
                        if (item.ds && item.ds.options) {
                            item.ds.options.appType = item.to.appId;
                            item.ds.options.formUuid = item.to.formUuid;
                            if (item.ds.options.appName) item.ds.options.appName = item.to.appName;
                            if (item.ds.options.tableName) item.ds.options.tableName = item.to.formName;
                        }
                    }
                });
                if (!page._replacements) page._replacements = [];
                page._replacements.push(...infoList.resultList);
                totalResults += infoList.resultList.length;
            }
        }

        // 应用 JS 替换：收集所?ID 映射并更?actions.module.source
        const allReplacements = [];
        pages.forEach(p => {
            if (p._replacements) {
                p._replacements.forEach(item => {
                    if (item.from && item.from.formUuid && item.to && item.to.formUuid) allReplacements.push({ from: item.from.formUuid, to: item.to.formUuid });
                    if (item.from && item.from.appId && item.to && item.to.appId) allReplacements.push({ from: item.from.appId, to: item.to.appId });
                    if (item.from && item.from.fieldId && item.to && item.to.fieldId) allReplacements.push({ from: item.from.fieldId, to: item.to.fieldId });
                });
                delete p._replacements;
            }
        });
        if (schema._globalReplacements) {
            schema._globalReplacements.forEach(item => {
                if (item.type === 'js_app' && item.from && item.from.appId && item.to && item.to.appId) {
                    allReplacements.push({ from: item.from.appId, to: item.to.appId });
                } else if (item.type === 'js_form' && item.from && item.from.formUuid && item.to && item.to.formUuid) {
                    allReplacements.push({ from: item.from.formUuid, to: item.to.formUuid });
                }
            });
            delete schema._globalReplacements;
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

        if (uniqueReplacements.length > 0 && schema.actions) {
            const applyToAction = (action) => {
                if (action.module && typeof action.module.source === 'string') {
                    let code = action.module.source;
                    uniqueReplacements.forEach(({ from, to }) => {
                        code = code.split(from).join(to);
                    });
                    action.module.source = code;
                }
            };
            if (Array.isArray(schema.actions)) {
                schema.actions.forEach(applyToAction);
            } else {
                applyToAction(schema.actions);
            }
            console.log(`[UIModule] [${originTitle}] JS 代码中应用了 ${uniqueReplacements.length} ?ID 替换`);
        }

        console.log(`[UIModule] [${originTitle}] Schema 转换完成，共替换 ${totalResults} 项映射规则`);

        // delete schema._copyFormName;
        // delete schema._copyFormType;
        // if (schema._idNameMapping) delete schema._idNameMapping;

        // 更新顶级 UUID（如果有?
        if (schema.formUuid) schema.formUuid = newFormUuid;
        if (schema.appId) schema.appId = targetAppId || global.info?.appId;

        // 4. 保存新表?
        Utils.toast({ title: `[${originTitle}] 正在保存 Schema...`, type: 'info' });
        const saveRes = await global.services.saveFormSchema(schema, newFormUuid, targetAppId);
        if (saveRes && saveRes.success) {
            Utils.toast({ title: `表单 [${originTitle}] 创建成功！`, type: 'success' });
            return newFormUuid;
        } else {
            throw new Error(`保存 Schema 结构 [${originTitle}] 失败`);
        }
    }
    // #endregion

    // #region 应用级补充接?

    async getSystemToken(appIdParam) {
        const appId = appIdParam || (global.info && global.info.appId);

        // const requestUrl = `${window.location.origin}/alibaba/web/${appId}/query/appnav/getSystemToken.json?_api=Nav.getSystemToken&_mock=false`;
        const requestUrl = `${window.location.origin}/alibaba/web/${appId}/query/app/getSystemToken.json`;
        const csrfToken = this.getCsrfToken();
        Utils.log(`[InterfaceService.getSystemToken] 获取到的csrfToken?${csrfToken}`, 'info');

        const formData = new FormData();
        formData.append('appType', appId);
        formData.append('_csrf_token', csrfToken);
        formData.append('_stamp', Date.now());

        return await Utils.fetchJson(requestUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/json, text/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'include',
            body: formData
        });
    }

    async ensureFullStructure() {
        if (Array.isArray(global.info.appStructure) && global.info.appStructure.length) {
            return global.info.appStructure;
        }

        const res = await this.getFullAppStructure().catch(() => null);
        global.info.appStructure = Utils.getFullStructureApps(res);
        Utils.log('[InterfaceService.ensureFullStructure] 成功获取应用结构', 'info');
        return global.info.appStructure;
    }



    async getAppNameByAppId(appId) {
        const id = String(appId || '').trim();
        if (!id) return null;

        const apps = await this.ensureFullStructure();
        const getText = (val) => {
            if (typeof val === 'string') return val;
            if (val && typeof val === 'object') {
                return val.zh_CN || (val.name && val.name.zh_CN) || (val.title && val.title.zh_CN) || val.name || val.title || val.label || '';
            }
            return '';
        };

        if (Array.isArray(apps) && apps.length) {
            const appInfo = apps.find(a => a && (a.appId === id || a.appType === id));
            if (appInfo) {
                return appInfo.appName || appInfo.appOriginalName || getText(appInfo.title) || null;
            }
        }
        return null;
    }

    async getProcessById(appId, processCode, processId) {
        console.log(`[InterfaceService.getProcessById] 调用参数 - appId: ${appId}, processCode: ${processCode}, processId: ${processId}`);
        return null;
    }

    /**
     * 获取审批流程的版本列?
     * @param {string} appId - 应用ID
     * @param {string} processCode - 审批流程编码
     * @returns {Promise<object|null>} - 审批流程版本列表
     */
    async pageProcessVersion(appId, processCode) {
        console.log(`[InterfaceService.pageProcessVersion] 调用参数 - appId: ${appId}, processCode: ${processCode}`);
        const requestUrl = `${window.location.origin}/alibaba/web/${appId}/query/process/pageProcessVersion.json?processCode=${processCode}&appType=${appId}&status=&pageIndex=1&pageSize=1&orderByCreateTime=desc`
        return await Utils.fetchJson(requestUrl, { method: 'GET', headers: { 'Accept': 'application/json, text/json', 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include' });
    }



    /**
     * 注册应用
     * @param {string} appName - 应用名称
     * @param {Promise<object|null>} - 注册结果
     */
    async registerApp(appName) {
        const csrfToken = this.getCsrfToken();
        const requestUrl = `${window.location.origin}/query/app/registerApp.json?_api=App.createApp&_mock=false&_stamp=${Date.now()}`;

        const formData = new FormData();
        formData.append('_csrf_token', csrfToken);
        formData.append('_locale_time_zone_offset', String(new Date().getTimezoneOffset() * -60000));
        formData.append('appName', JSON.stringify({ "zh_CN": appName, "en_US": "UnNamed+Application", "type": "i18n" }));
        formData.append('icon', "xian-diqiu%%#FF7357");
        formData.append('iconUrl', "xian-diqiu%%#FF7357");
        formData.append('colour', "blue");
        formData.append('openExclusive', "n");
        formData.append('openExclusiveUnit', "n");
        formData.append('defaultLanguage', "zh_CN");

        try {
            const response = await fetch(requestUrl, {
                method: 'POST',
                headers: { 'Accept': 'application/json, text/json', 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'include',
                body: formData
            });
            const responseText = await response.text();
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                // 如果后端返回?HTML 或纯文本错误信息
                console.error("创建表单分组接口返回了非 JSON 格式:", responseText);
                return { success: false, errorMsg: `接口响应异常: ${response.status} ${response.statusText}`, raw: responseText };
            }

            return data;
        } catch (error) {
            console.error("创建表单分组请求异常:", error);
            return { success: false, errorMsg: error.message };
        }


    }

    // #endregion
}

