import React, { useState } from 'react';
import Utils from '@/services/shared/BrowserUtilsService';
import global from '@/global';
import ProcessService from '@/services/ProcessService';

export default function FlowFix() {
    const [searching, setSearching] = useState(false);
    const [fixNodes, setFixNodes] = useState([]);

    const handleSearch = async () => {
        setSearching(true);
        setFixNodes([]);

        await global.services.getFullAppStructureByInitialization();
        const fullStructure = global.info.appStructure || [];
        if (!fullStructure.length) {
            Utils.toast({ title: '检索失败，应用结构为空', type: 'error' });
            setSearching(false);
            return;
        }

        const allForms = fullStructure.flatMap(app =>
            (app.forms || []).map(form => ({
                ...form,
                _parentAppId: app.appId,
                _parentAppName: app.appName,
                _parentMatchAppName: app.appName.split('-').length > 1 ? app.appName.split('-')[1] : app.appName, // 匹配名称
            }))
        );

        const results = [];

        // 通过表单获取流程简要信息
        console.log("开始获取流程简要信息");
        for (const form of allForms) {
            form._flows = await global.services.getAllFlowsByFormUuid(form._parentAppId, form.formId);
            // 没必要判读，因为flows确实可能为空
            // if (!form._flows || !form._flows.length) {
            //     console.warn({ title: `表单 [${form._parentAppName} / ${form.formName}] 没有集成自动化流程，或获取失败`, type: 'warning' })
            //     continue;
            // }
        }

        // 通过表单获取流程详细信息
        console.log("开始获取流程详细信息");
        for (const form of allForms) {
            for (const flow of form._flows) {
                if (!flow.processCode) continue;
                form._flowsInfoRes = await global.services.getProcess(flow.processCode, form._parentAppId);
                if (!form._flowsInfoRes) {
                    Utils.toast({ title: `流程 [${firstText(flow.name) || flow.processCode}] 失败`, type: 'warning' });
                    continue;
                }

                // 还是分析依赖关系
                let parsed = JSON.parse(form._flowsInfoRes.content); // 解析流程内容
                const pairs = ProcessService.extractDependencyPairs(parsed, form);
                // const issues = ProcessService.validateDependencies(pairs, fullStructure);

                // if (issues.length > 0) {
                //     const flowName = firstText(flow.name) || flow.processCode;
                //     const flowForm = allForms.find(form => form.formId === flow.formUuid || form.formUuid === flow.formUuid || form.id === flow.formUuid);
                //     const flowFormName = flowForm ? firstText(flowForm.formName, flowForm.title) : '';

                //     results.push({
                //         processCode: flow.processCode,
                //         processName: flowName,
                //         appId: form._parentAppId,
                //         appName: firstText(form._parentAppName),
                //         formUuid: flow.formUuid || '',
                //         flowFormName,
                //         content: parsed,
                //         issues
                //     });
                // }
            }
        }

        console.log("appForms", allForms);




        // for (const app of fullStructure) {
        //     let flows; // 该app下的所有集成自动化流程
        //     try {
        //         flows = await ProcessService.getAllFlows(app.appId);
        //     } catch (e) {
        //         console.warn(`获取应用 [${firstText(app.appName)}] 的集成自动化列表失败:`, e.message);
        //         continue;
        //     }

        //     if (!flows || !flows.length) continue;

        //     for (const flow of flows) {
        //         if (!flow.processCode) continue;

        //         let processInfoRes;
        //         try {
        //             processInfoRes = await global.services.getProcess(flow.processCode, app.appId);
        //         } catch (e) {
        //             console.warn(`获取流程 [${firstText(flow.name) || flow.processCode}] 失败:`, e.message);
        //             continue;
        //         }

        //         if (!processInfoRes || !processInfoRes.content) continue;

        //         let parsed;
        //         try {
        //             parsed = typeof processInfoRes.content === 'string'
        //                 ? JSON.parse(processInfoRes.content)
        //                 : processInfoRes.content;
        //         } catch (e) {
        //             console.warn(`解析流程 [${firstText(flow.name) || flow.processCode}] 失败:`, e.message);
        //             continue;
        //         }

        //         const pairs = extractDependencyPairs(parsed);
        //         const issues = validateDependencies(pairs, fullStructure);

        //         if (issues.length > 0) {
        //             const flowName = firstText(flow.name) || flow.processCode;
        //             const flowForm = allForms.find(form => form.formId === flow.formUuid || form.formUuid === flow.formUuid || form.id === flow.formUuid);
        //             const flowFormName = flowForm ? firstText(flowForm.formName, flowForm.title) : '';

        //             results.push({
        //                 processCode: flow.processCode,
        //                 processName: flowName,
        //                 appId: app.appId,
        //                 appName: firstText(app.appName),
        //                 formUuid: flow.formUuid || '',
        //                 flowFormName,
        //                 content: parsed,
        //                 issues
        //             });
        //         }
        //     }
        // }

        setFixNodes(results);
        setSearching(false);
        // console.log('需要修复的集成自动化:', results);
        // Utils.toast({
        //     title: `检索完成，共发现 ${results.length} 个存在依赖问题的集成自动化`,
        //     type: results.length > 0 ? 'warn' : 'success'
        // });
    };

    const handleFix = async () => {
        const fullStructure = global.info.appStructure || [];
        const fixNodesSuccess = [];

        for (const node of fixNodes) {
            const prevAppId = global.info.appId;
            const appMap = {};
            const formMap = {};

            for (const issue of node.issues) {
                const dependency = issue.dependency || {};
                const issueAppType = issue.appType || dependency.appType || '';
                const issueAppName = issue.appName || dependency.appName || '';
                const issueFormUuid = issue.formUuid || dependency.formUuid || '';
                const issueFormTitle = issue.formTitle || dependency.formTitle || '';

                let matchedApp = null;
                if (issueAppName) {
                    matchedApp = findAppByName(fullStructure, issueAppName);
                    if (issueAppType && matchedApp && !appMap[issueAppType]) {
                        appMap[issueAppType] = { newAppType: matchedApp.appId, newAppName: firstText(matchedApp.appName) };
                    }
                }

                if (!issueFormUuid || !issueFormTitle || formMap[issueFormUuid]) continue;

                const formMatches = findFormsByName(fullStructure, issueFormTitle, matchedApp);
                const fallbackMatches = formMatches.length > 0 ? formMatches : findFormsByName(fullStructure, issueFormTitle);

                if (fallbackMatches.length === 0) {
                    console.warn(`未找到目标表单: ${issueAppName || '-'} / ${issueFormTitle},matchedApp: ${firstText(matchedApp?.appName) || '-'}`);
                    continue;
                }

                if (!matchedApp && fallbackMatches.length > 1) {
                    console.warn(`表单名存在多个匹配，缺少应用名，已跳过以避免误修复: ${issueFormTitle}`, fallbackMatches);
                    continue;
                }

                const { app: targetApp, form: matchedForm } = fallbackMatches[0];
                if (issueAppType && !appMap[issueAppType]) {
                    appMap[issueAppType] = { newAppType: targetApp.appId, newAppName: firstText(targetApp.appName) };
                }
                formMap[issueFormUuid] = {
                    newFormUuid: matchedForm.formId || matchedForm.formUuid || matchedForm.id,
                    newFormTitle: firstText(matchedForm.formName, matchedForm.title)
                };
            }

            if (Object.keys(appMap).length === 0 && Object.keys(formMap).length === 0) {
                Utils.toast({ title: `流程 [${node.processName}] 无可匹配项，跳过`, type: 'warn' });
                continue;
            }

            fixIdsInPlace(node.content, appMap, formMap);

            global.info.appId = node.appId;
            try {
                const jsonStr = JSON.stringify(node.content);
                const res = await ProcessService.saveProcess(
                    node.formUuid,
                    node.processCode,
                    jsonStr,
                    jsonStr,
                    'true'
                );
                if (res && res.success) {
                    fixNodesSuccess.push(node);
                } else {
                    Utils.toast({ title: `保存流程 [${node.processName}] 失败: ${res?.errorMsg || '未知错误'}`, type: 'error' });
                }
            } catch (e) {
                console.error(`保存流程 [${node.processName}] 失败:`, e);
                Utils.toast({ title: `保存流程 [${node.processName}] 失败: ${e.message}`, type: 'error' });
            } finally {
                global.info.appId = prevAppId;
            }
        }

        if (fixNodesSuccess.length > 0) {
            const successCodes = new Set(fixNodesSuccess.map(node => node.processCode));
            setFixNodes(prev => prev.filter(node => !successCodes.has(node.processCode)));
        }

        Utils.toast({
            title: `修复完成: ${fixNodesSuccess.length}/${fixNodes.length}`,
            type: fixNodesSuccess.length > 0 ? 'success' : 'warn'
        });
    };

    return (
        <div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <button
                    onClick={handleSearch}
                    disabled={searching}
                    style={{ padding: '8px 20px', background: searching ? '#d9d9d9' : '#005fb8', color: '#fff', border: 'none', borderRadius: '4px', cursor: searching ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                    {searching ? '检索中...' : '开始检索依赖内容'}
                </button>
                <button
                    onClick={handleFix}
                    disabled={searching || fixNodes.length === 0}
                    style={{ padding: '8px 20px', background: (searching || fixNodes.length === 0) ? '#d9d9d9' : '#f04134', color: '#fff', border: 'none', borderRadius: '4px', cursor: (searching || fixNodes.length === 0) ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                    尝试修复
                </button>
            </div>

            {fixNodes.length > 0 && (
                <div>
                    <div style={{ marginBottom: '12px', fontSize: '13px', color: '#666' }}>
                        共发现 <strong style={{ color: '#f04134' }}>{fixNodes.length}</strong> 个存在依赖问题的集成自动化:
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                            <tr style={{ background: '#fafafa', borderBottom: '2px solid #ebebeb' }}>
                                <th style={{ padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>流程名称</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>所属应用&表单</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>节点名称</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>依赖应用&表单</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>指向</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>缺失项</th>
                            </tr>
                        </thead>
                        <tbody>
                            {fixNodes.flatMap((node, nodeIdx) =>
                                node.issues.map((issue, issueIdx) => {
                                    const flatIdx = `${nodeIdx}-${issueIdx}`;
                                    const bgColor = ((nodeIdx + issueIdx) % 2 === 0) ? '#fff' : '#fafafa';
                                    const isFirst = issueIdx === 0;
                                    const rowSpan = node.issues.length;
                                    const ownerLabel = node.flowFormName ? `${node.appName} / ${node.flowFormName}` : node.appName;
                                    const dependency = issue.dependency || {};
                                    const dependencyAppText = dependency.appName || '未记录应用';
                                    const dependencyFormText = dependency.formTitle || '未记录表单';
                                    const targetLabel = issue.appName
                                        ? `${issue.appName}${issue.formTitle ? ` / ${issue.formTitle}` : ''}`
                                        : (issue.formTitle || dependency.formTitle || '-');

                                    return (
                                        <tr key={flatIdx} style={{ borderBottom: '1px solid #ebebeb', background: bgColor }}>
                                            {isFirst && (
                                                <td rowSpan={rowSpan} style={{ padding: '6px 12px', color: '#005fb8', verticalAlign: 'top' }}>{node.processName}</td>
                                            )}
                                            {isFirst && (
                                                <td rowSpan={rowSpan} style={{ padding: '6px 12px', verticalAlign: 'top' }}>{ownerLabel}</td>
                                            )}
                                            <td style={{ padding: '6px 12px' }}>{issue.nodeName || '-'}</td>
                                            <td style={{ padding: '6px 12px' }}>
                                                <div>{`${dependencyAppText} / ${dependencyFormText}`}</div>
                                                {(dependency.appType || dependency.formUuid) && (
                                                    <div style={{ color: '#999', fontSize: '11px', marginTop: '2px' }}>
                                                        {`原始ID: ${dependency.appType || '-'} / ${dependency.formUuid || '-'}`}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: '6px 12px' }}>{targetLabel}</td>
                                            <td style={{ padding: '6px 12px' }}>
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '1px 6px',
                                                    borderRadius: '3px',
                                                    background: issue.type === 'NOT_APP' ? '#fff1f0' : issue.type === 'NOT_FORM' ? '#fff7e6' : '#fce4ec',
                                                    color: issue.type === 'NOT_APP' ? '#f04134' : issue.type === 'NOT_FORM' ? '#fa8c16' : '#c62828',
                                                    border: `1px solid ${issue.type === 'NOT_APP' ? '#ffa39e' : issue.type === 'NOT_FORM' ? '#ffd591' : '#ef9a9a'}`,
                                                    fontSize: '10px'
                                                }}>{issue.type}</span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {!searching && fixNodes.length === 0 && (
                <div style={{ textAlign: 'center', color: '#999', paddingTop: '60px', fontSize: '13px' }}>
                    点击上方按钮开始检索
                </div>
            )}
        </div>
    );
}
