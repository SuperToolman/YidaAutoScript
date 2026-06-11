import React, { useEffect, useRef } from 'react';
import MonacoModule from '@/services/ui/MonacoEditorService';
import Utils from '@/services/shared/BrowserUtilsService';
import global from '@/global';

const BatchModifyFormJs = () => {
    const matchEditorRef = useRef(null);
    const replaceEditorRef = useRef(null);
    const matchEditorInstance = useRef(null);
    const replaceEditorInstance = useRef(null);

    // 筛选条件状态
    const [selectedFormTypes, setSelectedFormTypes] = React.useState({
        receipt: true,   // 普通表单
        process: false,  // 流程表单
        customPage: true // 自定义页面
    });
    const [onlyCurrentApp, setOnlyCurrentApp] = React.useState(true); // 仅匹配当前应用
    const [formNameFilter, setFormNameFilter] = React.useState(''); // 表单名称模糊匹配

    // 弹窗和执行状态
    const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);
    const [matchedFormList, setMatchedFormList] = React.useState([]);
    const [selectedFormIds, setSelectedFormIds] = React.useState([]);
    const [searchKeyword, setSearchKeyword] = React.useState('');
    const [isExecuting, setIsExecuting] = React.useState(false);
    const [executeProgress, setExecuteProgress] = React.useState({ current: 0, total: 0, success: 0, fail: 0 });
    const [replaceConfig, setReplaceConfig] = React.useState(null); // 保存当前的匹配和替换配置

    const [isScanning, setIsScanning] = React.useState(false);
    const [scanProgress, setScanProgress] = React.useState({ current: 0, total: 0, currentFormName: '' });
    const abortActionRef = useRef(false);

    const toggleFormType = (type) => {
        setSelectedFormTypes(prev => ({
            ...prev,
            [type]: !prev[type]
        }));
    };

    useEffect(() => {
        let isMounted = true;

        const initEditors = async () => {
            if (matchEditorRef.current && !matchEditorInstance.current) {
                matchEditorInstance.current = await MonacoModule.createIsolatedMonacoEditor(matchEditorRef.current, {
                    value: '// 在此处输入需要匹配的代码片段（支持多行）\n',
                    language: 'javascript',
                    theme: 'vs',
                    minimap: { enabled: false },
                    fontSize: 13
                });
            }

            if (replaceEditorRef.current && !replaceEditorInstance.current) {
                replaceEditorInstance.current = await MonacoModule.createIsolatedMonacoEditor(replaceEditorRef.current, {
                    value: '// 在此处输入替换后的代码片段\n',
                    language: 'javascript',
                    theme: 'vs',
                    minimap: { enabled: false },
                    fontSize: 13
                });
            }
        };

        // 稍微延迟以确保外层容器已完全挂载并且具有尺寸
        setTimeout(initEditors, 100);

        return () => {
            isMounted = false;
        };
    }, []);

    const toggleFormSelection = (formId) => {
        setSelectedFormIds(prev => {
            if (prev.includes(formId)) {
                return prev.filter(id => id !== formId);
            } else {
                return [...prev, formId];
            }
        });
    };

    // 计算过滤后的表单列表
    const filteredFormList = matchedFormList.filter(form =>
        form.formName.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        form.formId.toLowerCase().includes(searchKeyword.toLowerCase())
    );

    const toggleAllSelection = () => {
        const filteredIds = filteredFormList.map(f => f.formId);
        const isAllFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selectedFormIds.includes(id));

        if (isAllFilteredSelected) {
            setSelectedFormIds(prev => prev.filter(id => !filteredIds.includes(id)));
        } else {
            setSelectedFormIds(prev => Array.from(new Set([...prev, ...filteredIds])));
        }
    };

    const getFinalSubmitCount = () => {
        if (searchKeyword.trim() !== '') {
            const filteredIds = filteredFormList.map(f => f.formId);
            return selectedFormIds.filter(id => filteredIds.includes(id)).length;
        }
        return selectedFormIds.length;
    };

    // 统一换行符：将 \r\n 和 \r 都转为 \n
    const normalizeNewlines = (str) => {
        if (!str) return '';
        return str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    };

    // 提取 Schema 中所有 actions 的 source / compiled，兼容 actions 为对象或数组
    // 只做换行符统一，不做任何其他处理，保持和 test.js 中 String.includes() 一致的行为
    const extractActionSources = (fullSchema) => {
        if (!fullSchema || !fullSchema.actions) return [];
        const actionList = Array.isArray(fullSchema.actions) ? fullSchema.actions : [fullSchema.actions];
        return actionList
            .filter(a => a && a.module)
            .map(a => ({
                source: normalizeNewlines(a.module.source || ''),
                compiled: normalizeNewlines(a.module.compiled || '')
            }));
    };

    const handleCancel = () => {
        if (isScanning || isExecuting) {
            abortActionRef.current = true;
        }
        setShowConfirmDialog(false);
        setIsScanning(false);
        setIsExecuting(false);
    };

    const handleExecuteReplace = async () => {
        let finalTargetIds = [];
        if (searchKeyword.trim() !== '') {
            const filteredIds = filteredFormList.map(f => f.formId);
            finalTargetIds = selectedFormIds.filter(id => filteredIds.includes(id));
        } else {
            finalTargetIds = selectedFormIds;
        }

        if (finalTargetIds.length === 0) {
            Utils.toast({ title: '当前视图下未选择任何表单', type: 'warn' });
            return;
        }

        if (!replaceConfig) {
            Utils.toast({ title: '替换配置丢失，请重新扫描', type: 'error' });
            return;
        }

        abortActionRef.current = false;
        setIsExecuting(true);
        setExecuteProgress({ current: 0, total: finalTargetIds.length, success: 0, fail: 0 });

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < finalTargetIds.length; i++) {
            if (abortActionRef.current) {
                console.log('替换操作已中止');
                break;
            }

            const formId = finalTargetIds[i];
            const matchedForm = matchedFormList.find(f => f.formId === formId);
            const targetAppId = matchedForm ? matchedForm.appId : global.info.appId;

            try {
                // 1. 获取最新全量 Schema
                const schemaRes = await global.services.getFormSchema(formId, targetAppId);
                let fullSchema = null;

                try {
                    fullSchema = typeof schemaRes === 'string' ? JSON.parse(schemaRes) : schemaRes;
                } catch (e) {
                    throw new Error('Schema 解析失败');
                }

                if (!fullSchema || !fullSchema.actions) {
                    throw new Error('Schema 缺少 actions 字段');
                }

                const actionSources = extractActionSources(fullSchema);
                if (actionSources.length === 0) {
                    throw new Error('Schema 缺少 actions.module 字段');
                }

                // 2. 执行字符串替换（仅统一换行符，与 test.js 一致）
                const { matchRaw, replaceRaw } = replaceConfig;
                const normalizedMatch = normalizeNewlines(matchRaw);
                const normalizedReplace = normalizeNewlines(replaceRaw);
                let isModified = false;

                const actionList = Array.isArray(fullSchema.actions) ? fullSchema.actions : [fullSchema.actions];
                for (const action of actionList) {
                    if (!action || !action.module) continue;
                    if (action.module.source) {
                        const normSource = normalizeNewlines(action.module.source);
                        if (normSource.includes(normalizedMatch)) {
                            action.module.source = normSource.split(normalizedMatch).join(normalizedReplace);
                            isModified = true;
                        }
                    }
                    if (action.module.compiled) {
                        const normCompiled = normalizeNewlines(action.module.compiled);
                        if (normCompiled.includes(normalizedMatch)) {
                            action.module.compiled = normCompiled.split(normalizedMatch).join(normalizedReplace);
                            isModified = true;
                        }
                    }
                }

                if (isModified) {
                    // 3. 保存修改后的 Schema
                    const saveRes = await global.services.saveFormSchema(JSON.stringify(fullSchema), formId, targetAppId);
                    if (saveRes && saveRes.success !== false) {
                        successCount++;
                    } else {
                        throw new Error(saveRes?.errorMsg || '保存接口返回失败');
                    }
                } else {
                    console.warn(`表单 ${formId} 未实际发生修改（可能已被修改过或匹配失效）`);
                    successCount++; // 没修改也不算失败
                }

            } catch (error) {
                console.error(`表单 ${formId} 修改失败:`, error);
                failCount++;
            }

            // 更新进度
            setExecuteProgress({ current: i + 1, total: finalTargetIds.length, success: successCount, fail: failCount });
        }

        setIsExecuting(false);

        if (!abortActionRef.current) {
            Utils.toast({ title: `批量替换完成！成功: ${successCount}, 失败: ${failCount}`, type: successCount > 0 ? 'success' : 'error' });
            if (failCount === 0) {
                setTimeout(() => setShowConfirmDialog(false), 1500);
            }
        }
    };

    const handleReplace = async () => {
        if (!matchEditorInstance.current || !replaceEditorInstance.current) {
            Utils.toast({ title: '编辑器尚未初始化完成', type: 'error' });
            return;
        }

        const matchCode = matchEditorInstance.current.getValue();
        const replaceCode = replaceEditorInstance.current.getValue();
        console.log('[BatchModifyFormJs] 匹配代码:', JSON.stringify(matchCode.slice(0, 120)));
        if (!matchCode.trim()) {
            Utils.toast({ title: '匹配代码不能为空', type: 'warn' });
            return;
        }

        // 保存配置供后续执行使用
        setReplaceConfig({
            matchRaw: matchCode,
            replaceRaw: replaceCode
        });

        // 初始化状态并立即打开弹窗
        abortActionRef.current = false;
        setMatchedFormList([]);
        setSelectedFormIds([]);
        setSearchKeyword('');
        setIsScanning(true);
        setScanProgress({ current: 0, total: 0, currentFormName: '准备获取应用结构...' });
        setShowConfirmDialog(true);

        try {
            // 获取应用与表单结构
            const currentAppId = global.info.appId;
            let appsToScan = global.info.appStructure || [];

            if (appsToScan.length === 0) {
                appsToScan = await global.services.getFullAppStructure() || [];
            }

            if (onlyCurrentApp) {
                appsToScan = appsToScan.filter(app => app.appId === currentAppId);
            }

            if (appsToScan.length === 0) {
                Utils.toast({ title: '未找到应用结构数据', type: 'error' });
                setIsScanning(false);
                setShowConfirmDialog(false);
                return;
            }

            // 扁平化需要扫描的表单列表，以便计算总进度
            let targetFormsAll = [];
            // 收集所有原始 formType 用于诊断
            const allFormTypes = new Set();
            for (const app of appsToScan) {
                if (!app.forms) continue;
                // 先收集 formType
                app.forms.forEach(f => {
                    allFormTypes.add(`${f.formType || 'undefined'} (${f.formName || '?'})`);
                });
                const targetForms = app.forms.filter(f => {
                    const name = (f.formName || f.name || '').toLowerCase();
                    if (formNameFilter.trim() && !name.includes(formNameFilter.trim().toLowerCase())) return false;
                    const ft = f.formType;
                    // receipt 和 process 明确匹配
                    if (ft === 'receipt' && selectedFormTypes.receipt) return true;
                    if (ft === 'process' && selectedFormTypes.process) return true;
                    // 自定义页面没有 formType，也没有 ft === 'receipt'/'process'，统一归为自定义页面
                    if (ft !== 'receipt' && ft !== 'process' && selectedFormTypes.customPage) return true;
                    return false;
                });
                targetForms.forEach(f => {
                    targetFormsAll.push({
                        ...f,
                        targetAppId: app.appId || app.appType,
                        appName: app.appName || app.appOriginalName || '未知应用'
                    });
                });
            }

            // 诊断：打印所有原始 formType
            console.log('%c[诊断] API 中出现的所有 formType 值:', 'font-weight:bold;color:#e67e22');
            allFormTypes.forEach(v => console.log(`  formType=${v}`));

            setScanProgress({ current: 0, total: targetFormsAll.length, currentFormName: '准备扫描表单...' });

            // 打印所有参与扫描的表单
            const filterSummary = [
                selectedFormTypes.receipt ? '普通表单' : '',
                selectedFormTypes.process ? '流程表单' : '',
                selectedFormTypes.customPage ? '自定义页面' : '',
                onlyCurrentApp ? '仅当前应用' : '全部应用',
                formNameFilter.trim() ? `名称包含"${formNameFilter.trim()}"` : ''
            ].filter(Boolean).join(' + ');
            console.log(`%c[扫描] 筛选条件: ${filterSummary}`, 'font-weight:bold;color:#2563eb');
            console.log(`%c[扫描] 共 ${targetFormsAll.length} 个表单参与匹配:`, 'font-weight:bold;color:#2563eb');
            targetFormsAll.forEach((f, idx) => {
                const name = f.formName || f.name || '未命名表单';
                console.log(`  ${idx + 1}. ${name} (${f.appName}) [formType=${f.formType || 'undefined'}]`);
            });

            const matchedForms = [];

            // 遍历扫描
            for (let i = 0; i < targetFormsAll.length; i++) {
                if (abortActionRef.current) {
                    console.log('扫描已中止');
                    break;
                }

                const form = targetFormsAll[i];
                const formId = form.formUuid || form.id || form.formId;
                const formName = form.formName || form.name || '未命名表单';

                setScanProgress({ current: i + 1, total: targetFormsAll.length, currentFormName: formName });

                try {
                    // 获取表单 schema
                    const schemaRes = await global.services.getFormSchema(formId, form.targetAppId);
                    let fullSchema = null;
                    try {
                        fullSchema = typeof schemaRes === 'string' ? JSON.parse(schemaRes) : schemaRes;
                    } catch (e) {
                        continue; // 解析失败直接跳过
                    }

                    // 检查 actions 字段（兼容数组和对象）
                    const actionSources = extractActionSources(fullSchema);
                    if (actionSources.length === 0) continue;

                    // 检查所有 action 的 source 是否包含匹配代码
                    const normalizedMatch = normalizeNewlines(matchCode);
                    let matched = false;
                    for (const { source } of actionSources) {
                        if (source && source.includes(normalizedMatch)) {
                            matchedForms.push({
                                formName: formName,
                                formId: formId,
                                appId: form.targetAppId,
                                appName: form.appName
                            });
                            matched = true;
                            break;
                        }
                    }
                    // 单行日志：每个表单的匹配结果
                    console.log(`[扫描] ${matched ? '✅ 命中' : '⬜ 未命中'} #${i + 1} ${formName}`);
                    if (!matched && i < 3) {
                        // 前3个未命中时额外输出源码前100字方便排查
                        console.log(`  源码预览: ${JSON.stringify(actionSources[0].source.slice(0, 100))}`);
                    }
                } catch (err) {
                    console.error(`读取表单 [${formName}] Schema 失败:`, err);
                }
            }

            if (!abortActionRef.current) {
                setMatchedFormList(matchedForms);
                setSelectedFormIds(matchedForms.map(f => f.formId));
                setIsScanning(false);

                // 输出扫描结果摘要
                console.log(`%c[扫描完成] 共扫描 ${targetFormsAll.length} 个表单，命中 ${matchedForms.length} 个`, 'font-weight:bold;color:#2563eb');
                if (matchedForms.length > 0) {
                    console.log('命中表单:', matchedForms.map(f => `${f.formName} (${f.appName})`));
                } else {
                    Utils.toast({ title: '扫描完成，未找到包含该代码片段的表单', type: 'info' });
                }
            }

        } catch (error) {
            console.error('扫描执行异常:', error);
            Utils.toast({ title: '扫描过程中发生异常，请查看控制台', type: 'error' });
            setIsScanning(false);
            setShowConfirmDialog(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '14px', color: '#1f2937' }}>
            {/* 筛选条件区域 */}
            <div style={{
                background: '#fff',
                border: '1px solid #ebebeb',
                borderRadius: '6px',
                padding: '16px 20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                }}>
                    <h3 style={{ padding: 0, fontSize: '15px', margin: 0, color: '#1f2d3d', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                        <span style={{ color: '#005fb8', fontSize: '18px' }}>🎯</span> 目标表单筛选
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', borderRight: '1px solid #e5e7eb', paddingRight: '12px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '13px', color: '#555', whiteSpace: 'nowrap' }}>
                                <input
                                    type="checkbox"
                                    checked={selectedFormTypes.receipt}
                                    onChange={() => toggleFormType('receipt')}
                                    style={{ marginRight: '6px', accentColor: '#005fb8' }}
                                />
                                普通表单
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '13px', color: '#555', whiteSpace: 'nowrap' }}>
                                <input
                                    type="checkbox"
                                    checked={selectedFormTypes.process}
                                    onChange={() => toggleFormType('process')}
                                    style={{ marginRight: '6px', accentColor: '#005fb8' }}
                                />
                                流程表单
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '13px', color: '#555', whiteSpace: 'nowrap' }}>
                                <input
                                    type="checkbox"
                                    checked={selectedFormTypes.customPage}
                                    onChange={() => toggleFormType('customPage')}
                                    style={{ marginRight: '6px', accentColor: '#005fb8' }}
                                />
                                自定义页面
                            </label>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '13px', color: '#555', transition: 'color 0.2s', whiteSpace: 'nowrap' }}>
                            <input
                                type="checkbox"
                                checked={onlyCurrentApp}
                                onChange={(e) => setOnlyCurrentApp(e.target.checked)}
                                style={{ marginRight: '6px', accentColor: '#005fb8' }}
                            />
                            仅匹配当前应用
                        </label>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', color: '#555', whiteSpace: 'nowrap', fontWeight: 500 }}>表单名称:</span>
                        <input
                            type="text"
                            placeholder="输入表单名称模糊匹配，为空则不过滤..."
                            value={formNameFilter}
                            onChange={(e) => setFormNameFilter(e.target.value)}
                            style={{ flex: 1, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', outline: 'none', maxWidth: '320px' }}
                            onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                        />
                    </div>
                </div>
            </div>

            {/* 匹配代码编辑器 */}
            <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#ffffff', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', height: '300px' }}>
                <div style={{ backgroundColor: '#f9fafb', padding: '10px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 500, color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg style={{ width: '16px', height: '16px', color: '#3b82f6' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                    匹配代码 (Search)
                </div>
                <div style={{ flex: '1 1 0%', width: '100%', height: '100%', position: 'relative' }} ref={matchEditorRef}></div>
            </div>

            {/* 替换代码编辑器 */}
            <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#ffffff', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', height: '300px' }}>
                <div style={{ backgroundColor: '#f9fafb', padding: '10px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 500, color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg style={{ width: '16px', height: '16px', color: '#22c55e' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
                    </svg>
                    替换代码 (Replace)
                </div>
                <div style={{ flex: '1 1 0%', width: '100%', height: '100%', position: 'relative' }} ref={replaceEditorRef}></div>
            </div>

            {/* 底部操作按钮 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px', flexShrink: 0 }}>
                <button
                    onClick={handleReplace}
                    style={{ padding: '8px 20px', backgroundColor: '#2563eb', border: '1px solid transparent', borderRadius: '6px', color: '#ffffff', cursor: 'pointer', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s' }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                >
                    <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    批量执行替换
                </button>
            </div>

            {/* 确认执行弹窗 */}
            {showConfirmDialog && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', width: '700px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {isScanning ? (
                                    <>
                                        <svg style={{ animation: 'spin 1s linear infinite', width: '20px', height: '20px', color: '#3b82f6' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25"></circle>
                                            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        正在扫描匹配表单...
                                    </>
                                ) : (
                                    <>
                                        <svg style={{ width: '20px', height: '20px', color: '#2563eb' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
                                        </svg>
                                        命中表单列表 (共 {matchedFormList.length} 个)
                                    </>
                                )}
                            </h3>
                            {(!isExecuting && !isScanning) && (
                                <button onClick={handleCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }} onMouseOver={(e) => e.currentTarget.style.color = '#4b5563'} onMouseOut={(e) => e.currentTarget.style.color = '#9ca3af'}>
                                    <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                    </svg>
                                </button>
                            )}
                        </div>

                        {isScanning ? (
                            <div style={{ padding: '60px 40px', textAlign: 'center', flex: '1 1 auto' }}>
                                <div style={{ marginBottom: '16px', fontSize: '15px', color: '#4b5563' }}>
                                    正在扫描: <span style={{ fontWeight: 500, color: '#111827' }}>{scanProgress.currentFormName}</span>
                                </div>
                                <div style={{ height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                                    <div style={{ height: '100%', backgroundColor: '#3b82f6', width: `${scanProgress.total === 0 ? 0 : (scanProgress.current / scanProgress.total) * 100}%`, transition: 'width 0.2s' }}></div>
                                </div>
                                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                    进度: {scanProgress.current} / {scanProgress.total}
                                </div>
                            </div>
                        ) : (
                            <>
                                <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="text"
                                            placeholder="搜索表单名称或 ID..."
                                            value={searchKeyword}
                                            onChange={(e) => setSearchKeyword(e.target.value)}
                                            disabled={isExecuting}
                                            style={{ width: '100%', padding: '10px 16px 10px 40px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                                        />
                                        <svg style={{ position: 'absolute', left: '14px', top: '11px', width: '18px', height: '18px', color: '#9ca3af' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                        </svg>
                                    </div>
                                </div>

                                <div style={{ flex: '1 1 auto', overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {filteredFormList.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#6b7280' }}>
                                            未找到匹配的表单
                                        </div>
                                    ) : (
                                        filteredFormList.map((form, index) => {
                                            const isSelected = selectedFormIds.includes(form.formId);
                                            return (
                                                <div
                                                    key={form.formId}
                                                    onClick={() => !isExecuting && toggleFormSelection(form.formId)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', padding: '12px 16px', borderRadius: '8px', cursor: isExecuting ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                                                        border: `1px solid ${isSelected ? '#bfdbfe' : '#e5e7eb'}`,
                                                        backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                                                        opacity: isExecuting && !isSelected ? 0.5 : 1
                                                    }}
                                                >
                                                    <div style={{ marginRight: '16px', display: 'flex', alignItems: 'center' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => { }} // 受控组件由 onClick 触发
                                                            disabled={isExecuting}
                                                            style={{ width: '18px', height: '18px', accentColor: '#2563eb', cursor: isExecuting ? 'not-allowed' : 'pointer' }}
                                                        />
                                                    </div>
                                                    <div style={{ flex: '1 1 auto', overflow: 'hidden' }}>
                                                        <div style={{ fontWeight: 600, color: isSelected ? '#1e3a8a' : '#111827', fontSize: '15px', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {index + 1}. {form.formName}
                                                        </div>
                                                        <div style={{ fontSize: '13px', color: '#6b7280', display: 'flex', gap: '12px' }}>
                                                            <span title={form.formId}>ID: {form.formId.slice(0, 15)}...</span>
                                                            <span>应用: {form.appName}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* 执行进度条 */}
                                {isExecuting && (
                                    <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', backgroundColor: '#f0fdf4' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#166534' }}>
                                            <span>替换进度 ({executeProgress.current}/{executeProgress.total})</span>
                                            <span>成功: {executeProgress.success} | 失败: {executeProgress.fail}</span>
                                        </div>
                                        <div style={{ height: '8px', backgroundColor: '#dcfce7', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', backgroundColor: '#22c55e', width: `${executeProgress.total === 0 ? 0 : (executeProgress.current / executeProgress.total) * 100}%`, transition: 'width 0.3s' }}></div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: '0 0 12px 12px' }}>
                            {isScanning ? (
                                <div style={{ flex: 1 }}></div> // 占位以保持右对齐
                            ) : (
                                <label style={{ display: 'flex', alignItems: 'center', cursor: isExecuting ? 'not-allowed' : 'pointer', color: '#4b5563', fontSize: '14px' }}>
                                    <input
                                        type="checkbox"
                                        checked={filteredFormList.length > 0 && filteredFormList.every(f => selectedFormIds.includes(f.formId))}
                                        onChange={toggleAllSelection}
                                        disabled={isExecuting}
                                        style={{ marginRight: '8px', width: '16px', height: '16px', accentColor: '#2563eb' }}
                                    />
                                    全选 (当前视图)
                                </label>
                            )}

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={handleCancel}
                                    style={{ padding: '8px 20px', backgroundColor: '#ffffff', border: '1px solid #d1d5db', borderRadius: '6px', color: '#374151', cursor: 'pointer', fontWeight: 500 }}
                                >
                                    {isScanning || isExecuting ? '中止操作' : '取消'}
                                </button>
                                {!isScanning && (
                                    <button
                                        onClick={handleExecuteReplace}
                                        disabled={isExecuting || getFinalSubmitCount() === 0}
                                        style={{ padding: '8px 20px', backgroundColor: '#2563eb', border: 'none', borderRadius: '6px', color: '#ffffff', cursor: (isExecuting || getFinalSubmitCount() === 0) ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: (isExecuting || getFinalSubmitCount() === 0) ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                        {isExecuting ? (
                                            <>
                                                <svg style={{ animation: 'spin 1s linear infinite', width: '16px', height: '16px' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25"></circle>
                                                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                执行中...
                                            </>
                                        ) : (
                                            `确认替换 (${getFinalSubmitCount()}个)`
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BatchModifyFormJs;