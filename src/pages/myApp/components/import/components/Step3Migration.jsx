import React, { useState } from 'react';
import ProcessService from '@/services/ProcessService.js';
import global from '@/global.js';
import Utils from '@/services/shared/BrowserUtilsService';

export default function Step3Migration({ importTasks, setImportTasks, setIsImporting }) {
    const [internalRunning, setInternalRunning] = useState(false);
    const running = internalRunning;

    const createAppByName = async (taskIndex, appName) => {
        const res = await global.services.registerApp(appName);
        if (res && res.content && typeof res.content === 'string' && res.content.startsWith('APP_')) {
            const newAppId = res.content;
            setImportTasks(prev => {
                const newTasks = [...prev];
                newTasks[taskIndex] = { ...newTasks[taskIndex], targetAppId: newAppId, logs: [...(newTasks[taskIndex].logs || []), { type: 'success', msg: `应用 [${appName}] 创建成功，AppId: ${newAppId}` }] };
                return newTasks;
            });
            return newAppId;
        }
        throw new Error(res?.errorMsg || res?.message || '未知错误');
    };

    const handleRun = async () => {
        setInternalRunning(true);
        setIsImporting(true);
        await global.services.getFullAppStructureByInitialization();

        for (let i = 0; i < importTasks.length; i++) {
            const task = importTasks[i];
            setImportTasks(prev => {
                const newTasks = [...prev];
                newTasks[i] = { ...newTasks[i], status: 'running' };
                return newTasks;
            });

            let successCount = 0;
            let failedCount = 0;
            const logs = [...(task.logs || [])];

            let targetAppId = task.targetAppId;
            if (!targetAppId) {
                try {
                    logs.push({ type: 'info', msg: `正在创建应用 [${task.appName}]...` });
                    targetAppId = await createAppByName(i, task.appName);
                } catch (e) {
                    logs.push({ type: 'error', msg: `应用 [${task.appName}] 创建失败: ${e.message}，已跳过迁移` });
                    setImportTasks(prev => {
                        const newTasks = [...prev];
                        newTasks[i] = { ...newTasks[i], targetAppId: '', logs };
                        return newTasks;
                    });
                    continue;
                }
            }

            const resolvedTargetAppId = targetAppId;

            for (let j = 0; j < task.formsData.length; j++) {
                const formSchema = task.formsData[j];
                const formName = formSchema._copyFormName ||
                    (formSchema.title && formSchema.title.zh_CN) || formSchema.title ||
                    (formSchema.formName && formSchema.formName.zh_CN) || formSchema.formName ||
                    '未命名表单';

                try {
                    if (!resolvedTargetAppId) {
                        logs.push({ type: 'warn', msg: `跳过表单 [${formName}]: 无可用目标应用` });
                        setImportTasks(prev => {
                            const newTasks = [...prev];
                            newTasks[i] = { ...newTasks[i], successForms: successCount, failedForms: failedCount, logs };
                            return newTasks;
                        });
                        continue;
                    }

                    await global.services.createAndSaveFormFromSchema(formSchema, resolvedTargetAppId);
                    successCount++;
                    logs.push({ type: 'success', msg: `表单 [${formName}] 迁移成功` });
                } catch (e) {
                    console.error(`迁移表单 [${formName}] 失败:`, e);
                    failedCount++;
                    logs.push({ type: 'error', msg: `表单 [${formName}] 失败: ${e.message}`, errorData: formSchema });
                }

                setImportTasks(prev => {
                    const newTasks = [...prev];
                    newTasks[i] = { ...newTasks[i], successForms: successCount, failedForms: failedCount, logs };
                    return newTasks;
                });
            }

            await global.services.getFullAppStructureByInitialization();

            const flowData = task.logicFlowData || [];
            let successFlows = 0;
            let failedFlows = 0;
            if (flowData.length > 0 && resolvedTargetAppId) {
                logs.push({ type: 'info', msg: `开始导入 ${flowData.length} 个集成自动化...` });
                setImportTasks(prev => {
                    const newTasks = [...prev];
                    newTasks[i] = { ...newTasks[i], logs: [...logs] };
                    return newTasks;
                });

                try {
                    const batchRes = await ProcessService.importBatchPayload(flowData, (p) => {
                        setImportTasks(prev => {
                            const newTasks = [...prev];
                            newTasks[i] = { ...newTasks[i], flowProgress: p };
                            return newTasks;
                        });
                    }, resolvedTargetAppId);
                    successFlows = batchRes.successCount;
                    failedFlows = batchRes.failedCount;
                    if (successFlows > 0) {
                        logs.push({ type: 'success', msg: `集成自动化: ${successFlows} 个导入成功` });
                    }
                    if (failedFlows > 0) {
                        batchRes.errors.forEach(e => {
                            logs.push({ type: 'error', msg: `集成自动化 [${e.flowName || e.sourceProcessCode}] 失败: ${e.message}` });
                        });
                    }
                } catch (e) {
                    failedFlows = flowData.length;
                    logs.push({ type: 'error', msg: `集成自动化批量导入异常: ${e.message}` });
                }
            } else if (flowData.length > 0) {
                logs.push({ type: 'warn', msg: `跳过 ${flowData.length} 个集成自动化: 无可用目标应用` });
                setImportTasks(prev => {
                    const newTasks = [...prev];
                    newTasks[i] = { ...newTasks[i], logs: [...logs] };
                    return newTasks;
                });
            } else {
                logs.push({ type: 'info', msg: '无集成自动化数据' });
            }

            setImportTasks(prev => {
                const newTasks = [...prev];
                newTasks[i] = {
                    ...newTasks[i],
                    successFlows,
                    failedFlows,
                    logs,
                    status: (failedCount > 0 || failedFlows > 0) ? 'error' : 'done'
                };
                return newTasks;
            });
        }

        setInternalRunning(false);
        setIsImporting(false);
        Utils.toast({ title: '表单&自动化迁移执行完毕', type: 'success' });
    };

    const allDone = importTasks.every(t => t.status === 'done' || t.status === 'error');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '13px', color: '#666' }}>
                    执行表单创建与集成自动化导入。{allDone && <span style={{ color: '#00a854', fontWeight: 500 }}>全部完成，可进入下一步。</span>}
                </div>
                {!allDone && !running && (
                    <button onClick={handleRun} style={{ padding: '6px 16px', background: '#00a854', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none">
                            <polyline points="5 12 10 17 19 8"></polyline>
                        </svg>
                        开始执行
                    </button>
                )}
                {running && (
                    <span style={{ fontSize: '12px', color: '#1890ff', flexShrink: 0 }}>迁移执行中...</span>
                )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {importTasks.map((task, idx) => {
                    const isRunning = task.status === 'running';
                    const isDone = task.status === 'done';
                    const isError = task.status === 'error';
                    const totalFlows = (task.logicFlowData || []).length;
                    const totalWork = task.totalForms + totalFlows;
                    const completedWork = task.successForms + task.failedForms + (task.successFlows || 0) + (task.failedFlows || 0);
                    const progressPercent = totalWork > 0 ? (completedWork / totalWork) * 100 : 0;
                    const formsAllDone = task.totalForms > 0 && (task.successForms + task.failedForms) >= task.totalForms;
                    const flowsRunning = formsAllDone && totalFlows > 0 && !isDone && !isError;
                    const flowsProcessed = (task.successFlows || 0) + (task.failedFlows || 0) > 0;

                    return (
                        <div key={idx} style={{ border: '1px solid #ebebeb', borderRadius: '6px', padding: '16px', background: isRunning ? '#f6ffed' : '#fff' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <div style={{ fontWeight: 500, fontSize: '14px', color: '#333' }}>
                                    {task.appName} <span style={{ color: '#999', fontSize: '12px', fontWeight: 'normal' }}>({task.targetAppId || task.appId})</span>
                                </div>
                                <div style={{ fontSize: '13px' }}>
                                    {isRunning && formsAllDone && !flowsProcessed && <span style={{ color: '#722ed1' }}>导入集成自动化中...</span>}
                                    {isRunning && !formsAllDone && <span style={{ color: '#1890ff' }}>迁移表单中...</span>}
                                    {isDone && <span style={{ color: '#00a854' }}>已完成</span>}
                                    {isError && <span style={{ color: '#f04134' }}>存在异常</span>}
                                    {task.status === 'pending' && <span style={{ color: '#999' }}>等待中</span>}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#666', marginBottom: '12px', flexWrap: 'wrap' }}>
                                <span>表单: <strong style={{ color: '#00a854' }}>{task.successForms}</strong>/{task.totalForms}</span>
                                <span>自动化: <strong style={{ color: totalFlows > 0 ? '#722ed1' : '#999' }}>{totalFlows}</strong> 个</span>
                                <span>成功: <strong style={{ color: '#00a854' }}>{(task.successForms || 0) + (task.successFlows || 0)}</strong></span>
                                <span>失败: <strong style={{ color: '#f04134' }}>{(task.failedForms || 0) + (task.failedFlows || 0)}</strong></span>
                            </div>

                            {task.flowProgress && flowsRunning && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#722ed1', marginBottom: '8px' }}>
                                    <span>导入集成自动化</span>
                                    <div style={{ flex: 1, height: '4px', background: '#f0f0f0', borderRadius: '2px', overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%',
                                            background: '#722ed1',
                                            width: `${totalFlows > 0 ? (task.flowProgress.current / task.flowProgress.total) * 100 : 0}%`,
                                            transition: 'width 0.3s'
                                        }} />
                                    </div>
                                    <span>{task.flowProgress.current}/{task.flowProgress.total}</span>
                                </div>
                            )}

                            <div style={{ width: '100%', height: '6px', background: '#f5f5f5', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    background: isError ? '#f04134' : '#00a854',
                                    width: `${progressPercent}%`,
                                    transition: 'width 0.3s'
                                }}></div>
                            </div>

                            {task.logs.length > 0 && (
                                <div style={{ marginTop: '12px', padding: '8px', background: '#fafafa', borderRadius: '4px', maxHeight: '100px', overflowY: 'auto', fontSize: '12px' }}>
                                    {task.logs.map((log, lIdx) => (
                                        <div key={lIdx} style={{ color: log.type === 'error' ? '#f04134' : log.type === 'success' ? '#00a854' : log.type === 'info' ? '#1890ff' : log.type === 'warn' ? '#fa8c16' : '#666', marginBottom: '4px' }}>
                                            {log.type === 'error' ? '❌' : log.type === 'info' ? 'ℹ️' : log.type === 'warn' ? '⚠️' : '✅'} {log.msg}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
