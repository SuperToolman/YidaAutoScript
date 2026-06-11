import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import Utils from '@/services/shared/BrowserUtilsService';
import global from '@/global.js';
import Step1CreateApp from './components/Step1CreateApp.jsx';
import Step2DataSource from './components/Step2DataSource.jsx';
import Step3Migration from './components/Step3Migration.jsx';
import Step4CreateNav from './components/Step4CreateNav.jsx';

export default function ImportWizardDialog({ isOpen, onClose, initialTasks }) {
    const [importStep, setImportStep] = useState(1);
    const [importTasks, setImportTasks] = useState([]);
    const [isImporting, setIsImporting] = useState(false);
    const [navCreationDone, setNavCreationDone] = useState(false);
    const steps = [
        { label: '创建应用' },
        { label: '添加应用数据源' },
        { label: '表单&自动化迁移' },
        { label: '创建分组' }
    ];
    useEffect(() => {
        if (isOpen && initialTasks) {
            setImportTasks(initialTasks.map(t => ({
                ...t,
                successFlows: 0,
                failedFlows: 0,
                totalFlows: (t.logicFlowData || []).length,
                totalNavs: (t.navStructureData || []).length,
                successNavs: 0,
                failedNavs: 0,
                targetAppId: ''
            })));
            setImportStep(1);
            setIsImporting(false);
            setNavCreationDone(false);
        }
    }, [isOpen, initialTasks]);

    if (!isOpen) return null;

    const handleCreateNavGroups = async () => {
        setIsImporting(true);
        setNavCreationDone(false);

        for (let i = 0; i < importTasks.length; i++) {
            const task = importTasks[i];
            const targetAppId = task.targetAppId;
            const navData = task.navStructureData || [];

            if (!targetAppId || navData.length === 0) {
                setImportTasks(prev => {
                    const newTasks = [...prev];
                    const logs = [...(newTasks[i].logs || [])];
                    if (!targetAppId) logs.push({ type: 'warn', msg: `跳过分组创建: 无可用目标应用` });
                    if (navData.length === 0) logs.push({ type: 'info', msg: `无分组数据，跳过` });
                    newTasks[i] = { ...newTasks[i], logs, successNavs: 0, failedNavs: 0 };
                    return newTasks;
                });
                continue;
            }

            setImportTasks(prev => {
                const newTasks = [...prev];
                newTasks[i] = { ...newTasks[i], status: 'creatingNav' };
                return newTasks;
            });

            const logs = [...(task.logs || [])];
            let successNavs = 0;
            let failedNavs = 0;
            const oldNavUuidToNew = {}; // 源 navUuid → { newNavUuid }

            // 按拓扑排序：深度优先，先创建根分组再创建子分组
            const sortedNavGroups = [];
            const visitedUuids = new Set();
            const buildSortedOrder = (groups, depth) => {
                groups.forEach(g => {
                    if (visitedUuids.has(g.navUuid)) return;
                    const parentIsInList = g.parentNavUuid && navData.some(p => p.navUuid === g.parentNavUuid);
                    if (!parentIsInList || visitedUuids.has(g.parentNavUuid)) {
                        visitedUuids.add(g.navUuid);
                        sortedNavGroups.push(g);
                        const children = navData.filter(c => c.parentNavUuid === g.navUuid && !visitedUuids.has(c.navUuid));
                        if (children.length) buildSortedOrder(children, depth + 1);
                    }
                });
                // 处理剩余的
                const remaining = groups.filter(g => !visitedUuids.has(g.navUuid));
                if (remaining.length && remaining.length < groups.length) buildSortedOrder(remaining, depth + 1);
            };
            buildSortedOrder(navData, 0);

            // 1. 按拓扑顺序创建 NAV 分组
            for (const nav of sortedNavGroups) {
                try {
                    const res = await global.services.saveFormNavigation(nav.title, targetAppId);
                    if (res && res.content) {
                        oldNavUuidToNew[nav.navUuid] = { newNavUuid: res.content };
                        successNavs++;
                        logs.push({ type: 'success', msg: `分组 [${nav.title}] 创建成功 (${res.content})` });
                    } else {
                        failedNavs++;
                        logs.push({ type: 'error', msg: `分组 [${nav.title}] 创建失败: ${res?.errorMsg || '未知错误'}` });
                    }
                } catch (e) {
                    failedNavs++;
                    logs.push({ type: 'error', msg: `分组 [${nav.title}] 创建失败: ${e.message}` });
                }
                setImportTasks(prev => {
                    const newTasks = [...prev];
                    newTasks[i] = { ...newTasks[i], successNavs, failedNavs, logs: [...logs] };
                    return newTasks;
                });
            }

            // 2. 获取目标应用的完整导航结构，拿到新的 ID 和 navUuid
            let targetNavList = [];
            try {
                targetNavList = await global.services.fetchAllForms(targetAppId, { includeNav: true });
            } catch (e) {
                logs.push({ type: 'warn', msg: '获取目标应用导航列表失败，层级整理可能不完整' });
            }

            const targetNavMapByTitle = {};
            const targetNavById = {};
            targetNavList.forEach(n => {
                targetNavMapByTitle[n.title] = n;
                if (n.id) targetNavById[n.id] = n;
            });
            const allNewIds = targetNavList.map(n => n.id).filter(Boolean);
            const idsStr = allNewIds.join(',');

            // 3. 递归整理层级关系
            if (Object.keys(oldNavUuidToNew).length > 0 && idsStr) {
                logs.push({ type: 'info', msg: `正在整理分组层级关系...` });
                setImportTasks(prev => {
                    const newTasks = [...prev];
                    newTasks[i] = { ...newTasks[i], logs: [...logs] };
                    return newTasks;
                });

                // 3.1 整理 NAV 分组的父子关系
                for (const nav of navData) {
                    try {
                        // 在目标组织中按 title 匹配找到对应的 nav item
                        const targetItem = targetNavMapByTitle[nav.title];
                        if (!targetItem || !targetItem.id) {
                            console.warn(`未在目标组织找到分组 [${nav.title}]`);
                            continue;
                        }

                        let parentNewUuid = 'NAV-SYSTEM-PARENT-UUID';
                        if (nav.parentNavUuid && oldNavUuidToNew[nav.parentNavUuid]) {
                            parentNewUuid = oldNavUuidToNew[nav.parentNavUuid].newNavUuid;
                        }

                        await global.services.updateFormNavigationOrderNew(
                            String(targetItem.id),
                            parentNewUuid,
                            'NAV',
                            idsStr,
                            targetAppId
                        );
                    } catch (e) {
                        console.warn(`更新导航 [${nav.title}] 层级失败:`, e);
                    }
                }

                // 3.2 整理表单的父子关系（PAGE 项，按 _parentNavTitle 匹配）
                const formsData = task.formsData || [];
                for (const form of formsData) {
                    try {
                        // 过滤掉没有父分组的表单
                        if (!form._parentNavTitle) continue;

                        const parentNav = targetNavList.find(n => n.title === form._parentNavTitle);



                        if (!parentNav) {
                            Utils.toast({ title: `未在目标组织找到分组 [${form._parentNavTitle}]`, type: 'warn' });
                            continue;
                        } else {
                            const currentItem = targetNavList.find(x => x.title === form._copyFormName);

                            console.log("parentNav是", parentNav)
                            console.log("currentItem是", currentItem)
                            console.log("targetNavList", targetNavList)
                            console.log("form",form)
                            console.log("=============================")

                            if(!currentItem){
                                console.warn(`未在目标组织找到表单 [${form._copyFormName || form.title}]`);
                                continue;
                            }

                            // 找到父分组，整理层级关系
                            await global.services.updateFormNavigationOrderNew(
                                String(currentItem.id),
                                parentNav.navUuid,
                                'PAGE',
                                idsStr,
                                targetAppId
                            );
                        }

                    } catch (e) {
                        console.warn(`更新表单 [${form._copyFormName || form.title}] 层级失败:`, e);
                    }
                }

                successNavs++;
                logs.push({ type: 'success', msg: `分组层级关系整理完成` });
            } else if (Object.keys(oldNavUuidToNew).length > 0) {
                logs.push({ type: 'warn', msg: `无法获取目标应用导航 ID 列表，跳过分组层级整理` });
            }

            setImportTasks(prev => {
                const newTasks = [...prev];
                newTasks[i] = { ...newTasks[i], successNavs, failedNavs, logs, status: 'done' };
                return newTasks;
            });
        }

        setIsImporting(false);
        setNavCreationDone(true);
        Utils.toast({ title: '分组创建完毕', type: 'success' });
    };



    return ReactDOM.createPortal(
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 99999,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                background: '#fff', width: '700px', borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column',
                overflow: 'hidden'
            }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #ebebeb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#1f2d3d', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="#00a854" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        应用迁移导入向导
                    </h3>
                    {!isImporting && (
                        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#999', padding: 0, lineHeight: 1 }}>×</button>
                    )}
                </div>

                <div style={{ display: 'flex', padding: '16px 24px', borderBottom: '1px solid #ebebeb' }}>
                    {steps.map((step, idx) => (
                        <div key={idx} style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ fontWeight: importStep >= idx + 1 ? 600 : 400, color: importStep >= idx + 1 ? '#00a854' : '#999', fontSize: '14px' }}>
                                <span style={{ display: 'inline-block', width: '20px', height: '20px', lineHeight: '20px', borderRadius: '50%', background: importStep >= idx + 1 ? '#00a854' : '#eee', color: importStep >= idx + 1 ? '#fff' : '#999', marginRight: '6px', fontSize: '12px' }}>{idx + 1}</span>
                                {step.label}
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ padding: '24px', height: '400px', backgroundColor: '#fff', overflowY: 'auto' }}>
                    {importStep === 1 && <Step1CreateApp importTasks={importTasks} />}
                    {importStep === 2 && <Step2DataSource />}
                    {importStep === 3 && <Step3Migration
                        importTasks={importTasks}
                        setImportTasks={setImportTasks}
                        setIsImporting={setIsImporting} />}
                    {importStep === 4 && <Step4CreateNav importTasks={importTasks} navCreationDone={navCreationDone} />}
                </div>

                <div style={{ padding: '16px 24px', borderTop: '1px solid #ebebeb', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#fafafa' }}>
                    {!isImporting && (
                        <button onClick={onClose} style={{ padding: '8px 20px', background: '#fff', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', color: '#333' }}>关闭</button>
                    )}

                    {importStep > 1 && !isImporting && !navCreationDone && (
                        <button onClick={() => setImportStep(s => s - 1)} style={{ padding: '8px 20px', background: '#fff', border: '1px solid #005fb8', color: '#005fb8', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>上一步</button>
                    )}

                    {[1, 2].includes(importStep) && !isImporting && (
                        <button onClick={() => setImportStep(s => s + 1)} style={{ padding: '8px 20px', background: '#00a854', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>下一步</button>
                    )}

                    {importStep === 3 && !isImporting && importTasks.every(t => t.status === 'done' || t.status === 'error') && (
                        <button onClick={() => setImportStep(4)} style={{ padding: '8px 20px', background: '#00a854', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>下一步</button>
                    )}

                    {importStep === 4 && !isImporting && !navCreationDone && (
                        <button onClick={handleCreateNavGroups} style={{ padding: '8px 20px', background: '#00a854', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                                <polyline points="5 12 10 17 19 8"></polyline>
                            </svg>
                            开始创建分组
                        </button>
                    )}

                    {importStep === 4 && !isImporting && navCreationDone && (
                        <button onClick={onClose} style={{ padding: '8px 20px', background: '#00a854', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            结束
                        </button>
                    )}

                    {(importStep === 3 || importStep === 4) && isImporting && (
                        <button disabled style={{ padding: '8px 20px', background: '#999', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'not-allowed', fontSize: '14px' }}>执行中...</button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
