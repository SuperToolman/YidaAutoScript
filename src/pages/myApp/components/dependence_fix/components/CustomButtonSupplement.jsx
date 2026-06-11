import React, { useState, useRef } from 'react';
import global from '@/global.js';
import Utils from '@/services/shared/BrowserUtilsService';

const CustomButtonSupplement = () => {
    const [fetchResult, setFetchResult] = useState('');
    const [isFetching, setIsFetching] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [fetchProgress, setFetchProgress] = useState('');
    const [importResult, setImportResult] = useState('');
    const [importProgress, setImportProgress] = useState('');
    const pausedRef = useRef(false);

    const currentAppId = global.info?.appId || '';
    const currentFormUuid = global.info?.formUuid || '';

    const handleFetch = async () => {
        setIsFetching(true);
        setFetchResult('');
        setFetchProgress('');

        try {
            // 1. 确保 appStructure 已初始化
            if (!global.info.appStructure || global.info.appStructure.length === 0) {
                setFetchProgress('正在拉取组织应用结构...');
                await global.services.getFullAppStructureByInitialization();
            }

            const apps = global.info.appStructure || [];
            if (!apps.length) {
                Utils.toast({ title: '未能获取到应用结构', type: 'error' });
                return;
            }

            // 2. 扁平化所有 (appId, formUuid, formName) 任务
            const tasks = [];
            apps.forEach(app => {
                const appId = app.appId || app.appType;
                const appName = app.appName || app.appOriginalName || appId;
                const forms = app.forms || [];
                forms.forEach(form => {
                    // 只有 receipt 类型的表单才支持自定义按钮
                    if (form.formType && form.formType !== 'receipt') return;
                    const formUuid = form.formId || form.formUuid || form.id;
                    if (!formUuid) return;
                    const formName = (() => {
                        const n = form.formName;
                        if (!n) return formUuid;
                        if (typeof n === 'string') return n;
                        return n.zh_CN || n.en_US || formUuid;
                    })();
                    tasks.push({ appId, appName, formUuid, formName });
                });
            });

            const totalForms = tasks.length;
            const allButtonConfigs = [];
            let processedCount = 0;
            const CONCURRENCY = 8; // 并发数
            const filterEmptyButtons = true; // 默认过滤掉 buttons 为空的结果项

            // 并发执行器
            const runConcurrently = async (concurrency) => {
                let index = 0;

                const progressTimer = setInterval(() => {
                    setFetchProgress(`正在获取 (${processedCount}/${totalForms}) - 并发:${concurrency}`);
                }, 300);

                const worker = async () => {
                    while (index < tasks.length) {
                        const i = index++;
                        const { appId, appName, formUuid, formName } = tasks[i];

                        try {
                            const res = await global.services.getButtonConfigs(appId, formUuid);
                            const hasButtons = res && res.content && 
                                (!Array.isArray(res.content) || res.content.length > 0);

                            if (!filterEmptyButtons || hasButtons) {
                                allButtonConfigs.push({
                                    appId,
                                    appName,
                                    formUuid,
                                    formName,
                                    buttons: res?.content,
                                });
                            }
                        } catch (err) {
                            console.warn(`[CustomButtonSupplement] 获取 ${appName}/${formName} 按钮配置失败:`, err);
                        }

                        processedCount++;
                    }
                };

                // 启动 concurrency 个 worker
                const workers = Array.from({ length: concurrency }, () => worker());
                await Promise.all(workers);
                clearInterval(progressTimer);
            };

            await runConcurrently(CONCURRENCY);

            const jsonStr = JSON.stringify(allButtonConfigs, null, 2);
            setFetchResult(jsonStr);
            setFetchProgress('');
            await Utils.setClipboard(jsonStr);
            Utils.toast({ title: `获取完成！共扫描 ${apps.length} 个应用、${totalForms} 个表单，已复制到剪贴板`, type: 'success' });
        } catch (err) {
            console.error('[CustomButtonSupplement] 获取自定义按钮失败:', err);
            Utils.toast({ title: `获取失败: ${err.message}`, type: 'error' });
        } finally {
            setIsFetching(false);
        }
    };

    const handleImport = async () => {
        setIsImporting(true);
        setIsPaused(false);
        pausedRef.current = false;
        setImportResult('');
        setImportProgress('');

        try {
            const clipboardText = await navigator.clipboard.readText();
            if (!clipboardText || !clipboardText.trim()) {
                Utils.toast({ title: '剪贴板中没有可用的自定义按钮 JSON', type: 'warn' });
                return;
            }

            const data = JSON.parse(clipboardText.trim());

            // 展开输入
            const items = Array.isArray(data) ? data : [data];

            // 确保当前组织结构已加载
            if (!global.info.appStructure || global.info.appStructure.length === 0) {
                setImportProgress('正在拉取当前组织应用结构...');
                await global.services.getFullAppStructureByInitialization();
            }
            const currentStructure = global.info.appStructure || [];

            // 构建 ID 解析辅助函数
            const resolveAppId = (sourceAppName) => {
                if (!sourceAppName) return null;
                const dashIdx = sourceAppName.indexOf('-');
                const shortName = dashIdx > -1 ? sourceAppName.substring(dashIdx + 1).trim() : sourceAppName.trim();
                if (!shortName) return null;
                const targetApp = currentStructure.find(app => {
                    const name = app.appName || '';
                    const original = app.appOriginalName || '';
                    return name.includes(shortName) || original.includes(shortName);
                });
                return targetApp ? { appId: targetApp.appId || targetApp.appType, forms: targetApp.forms || [] } : null;
            };

            const resolveFormId = (forms, sourceFormName) => {
                if (!sourceFormName || !forms || !forms.length) return null;
                return forms.find(f => {
                    const name = f.formName;
                    if (!name) return false;
                    if (typeof name === 'string') return name === sourceFormName;
                    return name.zh_CN === sourceFormName || name.en_US === sourceFormName;
                });
            };

            // 构建 importTasks
            const importTasks = [];
            let skippedCount = 0;

            for (const item of items) {
                if (item.buttons && Array.isArray(item.buttons)) {
                    const appInfo = resolveAppId(item.appName);
                    if (!appInfo) { skippedCount++; continue; }
                    const formMatch = resolveFormId(appInfo.forms, item.formName);
                    if (!formMatch) { skippedCount++; continue; }
                    const targetAppId = appInfo.appId;
                    const targetFormUuid = formMatch.formId || formMatch.formUuid || formMatch.id;
                    if (!targetFormUuid) { skippedCount++; continue; }
                    item.buttons.forEach(btn => {
                        importTasks.push({ appId: targetAppId, formUuid: targetFormUuid, btn });
                    });
                } else {
                    importTasks.push({ appId: currentAppId, formUuid: currentFormUuid, btn: item });
                }
            }

            if (!importTasks.length) {
                setImportResult(skippedCount ? `未解析到有效配置，跳过 ${skippedCount} 个不匹配项` : '未解析到有效的按钮配置');
                return;
            }

            const total = importTasks.length;
            let successCount = 0;
            let failCount = 0;
            let duplicateCount = 0;
            const existingButtonsCache = {};
            let currentIndex = 0;

            const getExistingButtonNames = async (appId, formUuid) => {
                const key = `${appId}|${formUuid}`;
                if (existingButtonsCache[key]) return existingButtonsCache[key];
                try {
                    const res = await global.services.getButtonConfigs(appId, formUuid);
                    const list = res?.content || [];
                    const names = list.map(btn => {
                        if (!btn.name) return '';
                        if (typeof btn.name === 'string') return btn.name;
                        return btn.name.zh_CN || btn.name.en_US || '';
                    }).filter(Boolean);
                    existingButtonsCache[key] = names;
                    return names;
                } catch (e) {
                    existingButtonsCache[key] = [];
                    return [];
                }
            };

            const getBtnName = (btn) => {
                if (!btn.name) return '';
                if (typeof btn.name === 'string') return btn.name;
                return btn.name.zh_CN || btn.name.en_US || '';
            };

            // 等待暂停恢复的辅助函数
            const waitIfPaused = () => {
                return new Promise(resolve => {
                    const check = () => {
                        if (!pausedRef.current) {
                            resolve();
                        } else {
                            setTimeout(check, 200);
                        }
                    };
                    check();
                });
            };

            while (currentIndex < total) {
                // 检查暂停
                if (pausedRef.current) {
                    await waitIfPaused();
                }

                const task = importTasks[currentIndex];
                const progressText = `正在导入 (${currentIndex + 1}/${total})`;
                setImportProgress(progressText);

                if (!task.appId || !task.formUuid) {
                    failCount++;
                    currentIndex++;
                    continue;
                }

                const btnName = getBtnName(task.btn);
                if (!btnName) {
                    failCount++;
                    currentIndex++;
                    continue;
                }

                const existingNames = await getExistingButtonNames(task.appId, task.formUuid);
                if (existingNames.includes(btnName)) {
                    duplicateCount++;
                    currentIndex++;
                    continue;
                }

                try {
                    const res = await global.services.saveButtonConfig(task.appId, task.formUuid, task.btn);
                    if (res && res.success !== false) {
                        successCount++;
                    } else {
                        failCount++;
                    }
                } catch (e) {
                    failCount++;
                }

                currentIndex++;
            }

            const parts = [];
            if (successCount) parts.push(`${successCount} 成功`);
            if (failCount) parts.push(`${failCount} 失败`);
            if (duplicateCount) parts.push(`${duplicateCount} 重复跳过`);
            if (skippedCount) parts.push(`${skippedCount} 未匹配跳过`);
            setImportResult(`导入完成: ${parts.join(', ')}`);
            setImportProgress('');
        } catch (err) {
            console.error('[CustomButtonSupplement] 导入失败:', err);
            setImportResult(`导入失败: ${err.message}`);
            setImportProgress('');
        } finally {
            setIsImporting(false);
            setIsPaused(false);
            pausedRef.current = false;
        }
    };

    const handleCopyResult = async () => {
        if (!fetchResult) return;
        await Utils.setClipboard(fetchResult);
        Utils.toast({ title: '已复制到剪贴板', type: 'success' });
    };

    const handlePause = () => {
        pausedRef.current = true;
        setIsPaused(true);
    };

    const handleResume = () => {
        pausedRef.current = false;
        setIsPaused(false);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* 获取自定义按钮 */}
            <div style={{
                background: '#fafafa',
                border: '1px solid #f0f0f0',
                borderRadius: '8px',
                padding: '16px',
            }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#333', marginBottom: '8px' }}>
                    获取自定义按钮
                </div>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
                    遍历当前组织所有应用下的所有表单，获取每个表单的自定义按钮配置，结果会自动复制到剪贴板。
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                        className="st-btn st-btn-primary"
                        onClick={handleFetch}
                        disabled={isFetching}
                        style={{
                            padding: '6px 16px',
                            border: 'none',
                            borderRadius: '4px',
                            background: isFetching ? '#d9d9d9' : '#1890ff',
                            color: '#fff',
                            cursor: isFetching ? 'not-allowed' : 'pointer',
                            fontSize: '13px',
                        }}
                    >
                        {isFetching ? '获取中...' : '获取全部自定义按钮'}
                    </button>
                    {fetchProgress && (
                        <span style={{ fontSize: '12px', color: '#1890ff' }}>{fetchProgress}</span>
                    )}
                    {fetchResult && !isFetching && (
                        <button
                            onClick={handleCopyResult}
                            style={{
                                padding: '6px 16px',
                                border: '1px solid #d9d9d9',
                                borderRadius: '4px',
                                background: '#fff',
                                cursor: 'pointer',
                                fontSize: '13px',
                                color: '#333',
                            }}
                        >
                            复制结果
                        </button>
                    )}
                </div>
            </div>

            {/* 导入自定义按钮 */}
            <div style={{
                background: '#fafafa',
                border: '1px solid #f0f0f0',
                borderRadius: '8px',
                padding: '16px',
            }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#333', marginBottom: '8px' }}>
                    导入自定义按钮
                </div>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
                    从剪贴板读取获取功能产出的自定义按钮 JSON，自动匹配当前组织后批量导入。
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                        className="st-btn"
                        onClick={handleImport}
                        disabled={isImporting && !isPaused}
                        style={{
                            padding: '6px 20px',
                            border: 'none',
                            borderRadius: '4px',
                            background: (isImporting && !isPaused) ? '#d9d9d9' : '#52c41a',
                            color: '#fff',
                            cursor: (isImporting && !isPaused) ? 'not-allowed' : 'pointer',
                            fontSize: '13px',
                        }}
                    >
                        {isImporting && !isPaused ? '导入中...' : '从剪贴板导入自定义按钮'}
                    </button>
                    {isImporting && !isPaused && (
                        <button
                            className="st-btn"
                            onClick={handlePause}
                            style={{
                                padding: '6px 16px',
                                border: '1px solid #faad14',
                                borderRadius: '4px',
                                background: '#fff',
                                color: '#faad14',
                                cursor: 'pointer',
                                fontSize: '13px',
                            }}
                        >
                            暂停
                        </button>
                    )}
                    {isPaused && (
                        <button
                            className="st-btn"
                            onClick={handleResume}
                            style={{
                                padding: '6px 16px',
                                border: '1px solid #52c41a',
                                borderRadius: '4px',
                                background: '#fff',
                                color: '#52c41a',
                                cursor: 'pointer',
                                fontSize: '13px',
                            }}
                        >
                            继续
                        </button>
                    )}
                    {importProgress && !isPaused && (
                        <span style={{ fontSize: '12px', color: '#1890ff' }}>{importProgress}</span>
                    )}
                    {isPaused && (
                        <span style={{ fontSize: '12px', color: '#faad14' }}>已暂停</span>
                    )}
                </div>
                {importResult && (
                    <div style={{
                        marginTop: '10px',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        background: '#f6ffed',
                        border: '1px solid #b7eb8f',
                        fontSize: '12px',
                        color: '#333',
                    }}>
                        {importResult}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomButtonSupplement;
