import React, { useState } from 'react';
import global from '@/global.js';
import Utils from '@/services/shared/BrowserUtilsService';

export default function AssociationFormFix() {
    const [fixFields, setFixFields] = useState([]);
    const [searching, setSearching] = useState(false);
    const [fixing, setFixing] = useState(false);
    const [fixProgress, setFixProgress] = useState({ current: 0, total: 0, fieldName: '', parentLabel: '' });
    const [fixSummary, setFixSummary] = useState({ total: 0, success: 0, failed: 0 });
    const [expandedPropsIdx, setExpandedPropsIdx] = useState(null);

    const findFieldRecursive = (fields, predicate) => {
        if (!Array.isArray(fields)) return null;
        for (const f of fields) {
            if (predicate(f)) return f;
            if (f.childrenFields && Array.isArray(f.childrenFields)) {
                const found = findFieldRecursive(f.childrenFields, predicate);
                if (found) return found;
            }
        }
        return null;
    };

    const getText = (value) => {
        if (!value) return '';
        if (typeof value === 'string') return value;
        return value.zh_CN || value.en_US || value.name || value.title || '';
    };

    const normalizeText = (value) => getText(value).replace(/\u00a0/g, ' ').replace(/\s+/g, '').trim();

    const getFieldKey = (field) => `${field?.parentInfo?.appId || ''}:${field?.parentInfo?.formId || ''}:${field?.fieldId || ''}`;

    const getAssociationForm = (field) => field?.props?.associationForm || {};

    const updateFieldState = (fieldKey, patch) => {
        setFixFields(prev => prev.map(item => getFieldKey(item) === fieldKey ? { ...item, ...patch } : item));
    };

    const buildStructureIndex = (fullStructure) => {
        const appById = new Map();
        const formById = new Map();

        fullStructure.forEach(app => {
            if (app?.appId) appById.set(app.appId, app);
            (app?.forms || []).forEach(form => {
                if (!form) return;
                const formId = form.formId || form.formUuid || form.id;
                const indexedForm = { ...form, formId, parentApp: app };
                if (formId) formById.set(formId, indexedForm);
            });
        });

        return { appById, formById };
    };

    const SearchDependenceItem = async (field, structureIndex) => {
        const associationForm = getAssociationForm(field);
        if (!structureIndex.appById.has(associationForm.appType))
            return { ...field, error: { type: 'NOT_APP', message: '应用不存在' } };
        if (!structureIndex.formById.has(associationForm.formUuid))
            return { ...field, error: { type: 'NOT_FORM', message: '表单不存在' } };
        const thisFormFields = structureIndex.formById.get(associationForm.formUuid)?.fields ?? [];
        if (!thisFormFields || thisFormFields.length === 0)
            return { ...field, error: { type: 'NOT_FORM_FIELD', message: `表单不存在关联字段 ${associationForm.mainFieldId}` } };
        if (!findFieldRecursive(thisFormFields, x => x.fieldId === associationForm.mainFieldId)) {
            if (!associationForm.tableFieldId) {
                return { ...field, error: { type: 'NOT_ASSOC_FIELD', message: '关联字段不存在，且不存在 tableFieldId' } };
            }
        }
        return null;
    };

    const updateAssociationFormInTree = (node, field, matchedApp, matchedForm, matchedField) => {
        if (!node) return false;
        if (node.componentName === 'AssociationFormField' && node.props && node.props.fieldId === field.fieldId) {
            node.props.associationForm = {
                ...node.props.associationForm,
                appName: getText(matchedApp.appName),
                appType: matchedApp.appId,
                formTitle: getText(matchedForm.formName || matchedForm.title),
                formUuid: matchedForm.formId || matchedForm.formUuid || matchedForm.id,
                mainFieldId: matchedField.fieldId
            };
            return true;
        }
        if (Array.isArray(node.children)) {
            return node.children.some(child => updateAssociationFormInTree(child, field, matchedApp, matchedForm, matchedField));
        }
        return false;
    };

    const handleSearchDependence = async () => {
        setSearching(true);
        setFixFields([]);
        setFixSummary({ total: 0, success: 0, failed: 0 });
        setFixProgress({ current: 0, total: 0, fieldName: '', parentLabel: '' });

        await global.services.getFullAppStructureByInitialization();
        const fullStructure = global.info.appStructure || [];

        if (!fullStructure.length) {
            Utils.toast({ title: '检索失败，应用结构为空，请先初始化应用结构', type: 'error' });
            setSearching(false);
            return;
        }
        const structureIndex = buildStructureIndex(fullStructure);
        const allAssociationFormFields = fullStructure.flatMap(app =>
            (app.forms ?? []).flatMap(form =>
                (form.fields ?? [])
                    .filter(field => field.componentName === 'AssociationFormField')
                    .map(field => ({
                        ...field,
                        parentInfo: {
                            appId: app.appId,
                            appName: getText(app.appName),
                            appOriginalName: app.appOriginalName,
                            formId: form.formId,
                            formName: getText(form.formName || form.title),
                        }
                    }))
            )
        );

        if (!allAssociationFormFields.length) {
            Utils.toast({ title: '未获取到关联组件，请检查应用结构是否包含关联组件', type: 'warning' });
            setSearching(false);
            return;
        }
        Utils.toast({ title: '已获取全部关联组件，准备开始检索', type: 'success' });

        const results = [];
        for (const field of allAssociationFormFields) {
            const searchResult = await SearchDependenceItem(field, structureIndex);
            if (searchResult) {
                results.push({
                    ...searchResult,
                    fixStatus: 'pending',
                    fixMessage: ''
                });
            }
        }

        setFixFields(results);
        setFixSummary({ total: results.length, success: 0, failed: 0 });
        setSearching(false);
        Utils.toast({ title: `检索完成，共发现 ${results.length} 个需要修复的关联组件`, type: results.length > 0 ? 'warn' : 'success' });
    };

    const handleFixDependence = async () => {
        if (fixing || fixFields.length === 0) return;

        const total = fixFields.length;
        let successCount = 0;
        let failedCount = 0;

        setFixing(true);
        setFixSummary({ total, success: 0, failed: 0 });
        setFixProgress({ current: 0, total, fieldName: '', parentLabel: '' });
        setFixFields(prev => prev.map(field => ({ ...field, fixStatus: 'pending', fixMessage: '' })));

        for (let index = 0; index < fixFields.length; index++) {
            const field = fixFields[index];
            const fieldKey = getFieldKey(field);
            const fieldName = getText(field.name);
            const parentLabel = `${field.parentInfo?.appName || ''} / ${field.parentInfo?.formName || ''}`.trim();

            setFixProgress({ current: index + 1, total, fieldName, parentLabel });
            updateFieldState(fieldKey, { fixStatus: 'running', fixMessage: '正在匹配目标应用、表单与字段...' });

            const associationForm = getAssociationForm(field);
            const appName = getText(associationForm.appName);
            const appMatchNameArry = appName.split('-');
            const appMatchName = appMatchNameArry.length > 1 ? appMatchNameArry[1] : appMatchNameArry[0];
            const normalizedAppMatchName = normalizeText(appMatchName);
            const matchedApp = (global.info.appStructure || []).find(app => normalizeText(app.appName).includes(normalizedAppMatchName));
            if (!matchedApp) {
                const message = `未找到应用 ${appName}，请检查应用结构`;
                failedCount++;
                updateFieldState(fieldKey, { fixStatus: 'failed', fixMessage: message });
                setFixSummary({ total, success: successCount, failed: failedCount });
                Utils.toast({ title: message, type: 'error' });
                continue;
            }

            const formTitle = getText(associationForm.formTitle);
            const matchedForm = (matchedApp.forms || []).find(form => normalizeText(form.formName || form.title) === normalizeText(formTitle));
            if (!matchedForm) {
                const message = `未找到表单 ${formTitle}，请检查应用结构`;
                failedCount++;
                updateFieldState(fieldKey, { fixStatus: 'failed', fixMessage: message });
                setFixSummary({ total, success: successCount, failed: failedCount });
                Utils.toast({ title: message, type: 'error' });
                continue;
            }

            let matchedField = findFieldRecursive(matchedForm.fields, item => item.fieldId === associationForm.mainFieldId);
            if (!matchedField) {
                matchedField = findFieldRecursive(matchedForm.fields, item => normalizeText(item.name) === normalizeText(field.name));
                if (!matchedField) {
                    const message = `未找到关联字段 ${getText(field.name)}，请检查应用结构`;
                    failedCount++;
                    updateFieldState(fieldKey, { fixStatus: 'failed', fixMessage: message });
                    setFixSummary({ total, success: successCount, failed: failedCount });
                    Utils.toast({ title: message, type: 'error' });
                    continue;
                }
            }

            associationForm.appName = getText(matchedApp.appName);
            associationForm.appType = matchedApp.appId;
            associationForm.formTitle = getText(matchedForm.formName || matchedForm.title);
            associationForm.formUuid = matchedForm.formId || matchedForm.formUuid || matchedForm.id;
            associationForm.mainFieldId = matchedField.fieldId;

            const schemaRaw = await global.services.getFormSchema(field.parentInfo.formId, field.parentInfo.appId);
            const thisFormSchema = typeof schemaRaw === 'string' ? JSON.parse(schemaRaw) : schemaRaw;
            if (!thisFormSchema || !Array.isArray(thisFormSchema.pages)) {
                const message = `获取表单 Schema 失败: ${field.parentInfo.formName}`;
                failedCount++;
                updateFieldState(fieldKey, { fixStatus: 'failed', fixMessage: message });
                setFixSummary({ total, success: successCount, failed: failedCount });
                Utils.toast({ title: message, type: 'error' });
                continue;
            }

            let found = false;
            for (const page of thisFormSchema.pages) {
                if (!page.componentsTree) continue;
                for (const root of page.componentsTree) {
                    if (updateAssociationFormInTree(root, field, matchedApp, matchedForm, matchedField)) {
                        found = true;
                    }
                }
            }

            if (!found) {
                const message = `在 Schema 中未找到字段 [${getText(field.name)}]，跳过`;
                failedCount++;
                updateFieldState(fieldKey, { fixStatus: 'failed', fixMessage: message });
                setFixSummary({ total, success: successCount, failed: failedCount });
                Utils.toast({ title: message, type: 'warn' });
                continue;
            }

            try {
                updateFieldState(fieldKey, { fixStatus: 'running', fixMessage: '正在保存修复后的表单 Schema...' });
                await global.services.saveFormSchema(thisFormSchema, field.parentInfo.formId, field.parentInfo.appId);
            } catch (e) {
                console.error(`保存 Schema 失败 [${field.parentInfo.formName}]:`, e);
                const message = `保存 Schema 失败: ${field.parentInfo.formName}`;
                failedCount++;
                updateFieldState(fieldKey, { fixStatus: 'failed', fixMessage: message });
                setFixSummary({ total, success: successCount, failed: failedCount });
                Utils.toast({ title: message, type: 'error' });
                continue;
            }

            successCount++;
            updateFieldState(fieldKey, {
                fixStatus: 'success',
                fixMessage: `已更新到 ${getText(matchedApp.appName)} / ${getText(matchedForm.formName || matchedForm.title)}`
            });
            setFixSummary({ total, success: successCount, failed: failedCount });
        }

        setFixing(false);
        setFixProgress(prev => ({ ...prev, current: total, fieldName: '', parentLabel: '' }));
        Utils.toast({ title: `修复完成: ${successCount}/${total} 个关联组件已修复`, type: successCount > 0 ? 'success' : 'warn' });
    };

    const statusStyleMap = {
        pending: { text: '待处理', color: '#999', bg: '#f5f5f5', border: '#d9d9d9' },
        running: { text: '修复中', color: '#1890ff', bg: '#f0f5ff', border: '#91d5ff' },
        success: { text: '已成功', color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f' },
        failed: { text: '修复失败', color: '#f04134', bg: '#fff1f0', border: '#ffa39e' }
    };

    return (
        <div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <button
                    onClick={handleSearchDependence}
                    disabled={searching || fixing}
                    style={{ padding: '8px 20px', background: (searching || fixing) ? '#d9d9d9' : '#005fb8', color: '#fff', border: 'none', borderRadius: '4px', cursor: (searching || fixing) ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                    {searching ? '检索中...' : '开始检索依赖内容'}
                </button>
                <button
                    onClick={handleFixDependence}
                    disabled={searching || fixing || fixFields.length === 0}
                    style={{ padding: '8px 20px', background: (searching || fixing || fixFields.length === 0) ? '#d9d9d9' : '#f04134', color: '#fff', border: 'none', borderRadius: '4px', cursor: (searching || fixing || fixFields.length === 0) ? 'not-allowed' : 'pointer', fontSize: '14px', minWidth: '110px' }}>
                    {fixing ? '修复中...' : '尝试修复'}
                </button>
            </div>

            {(fixing || fixSummary.total > 0) && (
                <div style={{ marginBottom: '16px', padding: '12px 14px', border: '1px solid #ebebeb', borderRadius: '6px', background: '#fafafa' }}>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: '#333', marginBottom: fixing ? '10px' : 0 }}>
                        <span>总数: <strong>{fixSummary.total}</strong></span>
                        <span style={{ color: '#52c41a' }}>成功: <strong>{fixSummary.success}</strong></span>
                        <span style={{ color: '#f04134' }}>失败: <strong>{fixSummary.failed}</strong></span>
                        {fixing && <span style={{ color: '#1890ff' }}>进度: <strong>{fixProgress.current}/{fixProgress.total}</strong></span>}
                    </div>
                    {fixing && (
                        <>
                            <div style={{ width: '100%', height: '6px', borderRadius: '999px', background: '#e8e8e8', overflow: 'hidden', marginBottom: '10px' }}>
                                <div style={{
                                    width: `${fixProgress.total ? Math.max((fixProgress.current / fixProgress.total) * 100, 6) : 0}%`,
                                    height: '100%',
                                    background: 'linear-gradient(90deg, #1890ff 0%, #40a9ff 100%)',
                                    transition: 'width 0.25s ease'
                                }} />
                            </div>
                            <div style={{ fontSize: '12px', color: '#666' }}>
                                正在修复：{fixProgress.fieldName || '-'}
                                {fixProgress.parentLabel ? `（所在位置：${fixProgress.parentLabel}）` : ''}
                            </div>
                        </>
                    )}
                </div>
            )}

            {fixFields.length > 0 && (
                <div>
                    <div style={{ marginBottom: '12px', fontSize: '13px', color: '#666' }}>
                        共发现 <strong style={{ color: '#f04134' }}>{fixFields.length}</strong> 个存在依赖问题的关联组件：
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                            <tr style={{ background: '#fafafa', borderBottom: '2px solid #ebebeb' }}>
                                <th style={{ padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>待修复字段</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>所在位置</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>关联到</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>问题</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>修复状态 / 结果</th>
                                <th style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap', width: '60px' }}>Props</th>
                            </tr>
                        </thead>
                        <tbody>
                            {fixFields.map((field, idx) => {
                                const name = getText(field.name);
                                const parentAppName = field.parentInfo?.appName || '';
                                const parentFormName = field.parentInfo?.formName || '';
                                const associationForm = getAssociationForm(field);
                                const assocAppName = getText(associationForm.appName);
                                const assocFormTitle = getText(associationForm.formTitle);
                                const errorType = field.error?.type || '';
                                const errorMsg = field.error?.message || '';
                                const fixStatus = field.fixStatus || 'pending';
                                const fixMessage = field.fixMessage || '';
                                const bgColor = idx % 2 === 0 ? '#fff' : '#fafafa';
                                const statusStyle = statusStyleMap[fixStatus] || statusStyleMap.pending;
                                return (
                                    <React.Fragment key={idx}>
                                        <tr style={{ borderBottom: '1px solid #ebebeb', background: bgColor }}>
                                            <td style={{ padding: '6px 12px', color: '#005fb8' }}>{name}</td>
                                            <td style={{ padding: '6px 12px' }}>{`${parentAppName} / ${parentFormName}`.trim()}</td>
                                            <td style={{ padding: '6px 12px' }}>{`${assocAppName} / ${assocFormTitle}`.trim()}</td>
                                            <td style={{ padding: '6px 12px' }}>
                                                <span style={{
                                                    display: 'inline-block', padding: '2px 8px', borderRadius: '3px', marginRight: '8px',
                                                    background: errorType === 'NOT_APP' ? '#fff1f0' : errorType === 'NOT_FORM' ? '#fff7e6' : '#f0f5ff',
                                                    color: errorType === 'NOT_APP' ? '#f04134' : errorType === 'NOT_FORM' ? '#fa8c16' : '#1890ff',
                                                    border: `1px solid ${errorType === 'NOT_APP' ? '#ffa39e' : errorType === 'NOT_FORM' ? '#ffd591' : '#91d5ff'}`,
                                                    fontSize: '11px'
                                                }}>{errorType}</span>
                                                <span style={{ color: '#f04134' }}>{errorMsg}</span>
                                            </td>
                                            <td style={{ padding: '6px 12px' }}>
                                                <div style={{ marginBottom: fixMessage ? '4px' : 0 }}>
                                                    <span style={{
                                                        display: 'inline-block',
                                                        padding: '2px 8px',
                                                        borderRadius: '3px',
                                                        background: statusStyle.bg,
                                                        color: statusStyle.color,
                                                        border: `1px solid ${statusStyle.border}`,
                                                        fontSize: '11px'
                                                    }}>{statusStyle.text}</span>
                                                </div>
                                                {fixMessage && (
                                                    <div style={{ color: fixStatus === 'failed' ? '#f04134' : '#666', fontSize: '12px', lineHeight: 1.5 }}>
                                                        {fixMessage}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => setExpandedPropsIdx(expandedPropsIdx === idx ? null : idx)}
                                                    style={{ padding: '2px 8px', background: '#f0f0f0', border: '1px solid #d9d9d9', borderRadius: '3px', cursor: 'pointer', fontSize: '11px', color: '#333' }}>
                                                    {expandedPropsIdx === idx ?
                                                        <svg t="1779241335104" style={{ width: '15px', height: '15px' }} className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3795" xmlnsXlink="http://www.w3.org/1999/xlink" width="200" height="200"><path d="M679.032471 724.510118l82.703058 82.703058 42.586353-42.586352L219.858824 180.103529l-42.586353 42.586353 72.884705 72.884706a475.919059 475.919059 0 0 0-152.756705 175.284706L90.352941 484.713412l7.04753 13.854117c80.956235 159.021176 240.037647 257.204706 414.900705 257.204706 58.066824 0 114.447059-10.842353 166.731295-31.322353z m-47.104-47.104a401.889882 401.889882 0 0 1-119.627295 18.130823c-147.877647 0-282.262588-80.112941-355.026823-210.823529a412.912941 412.912941 0 0 1 135.890823-146.070588l65.295059 65.295058a173.477647 173.477647 0 0 0 234.315294 234.315294l39.152942 39.152942z m-227.689412-227.689412l142.757647 142.757647a113.242353 113.242353 0 0 1-142.757647-142.757647zM926.599529 498.567529l7.04753-13.854117-7.04753-13.854118c-80.956235-158.418824-240.037647-257.204706-414.298353-257.204706-51.561412 0-101.797647 8.613647-149.022117 24.816941l48.188235 48.188236a403.456 403.456 0 0 1 100.833882-12.769883c147.275294 0 281.660235 80.112941 355.026824 210.82353a413.696 413.696 0 0 1-121.554824 136.192l42.646589 42.706823a475.497412 475.497412 0 0 0 138.179764-165.044706z" fill="#000000" fillOpacity=".4" p-id="3796"></path><path d="M685.477647 484.713412c0 22.528-4.336941 44.092235-12.107294 63.849412l-49.091765-49.091765a113.242353 113.242353 0 0 0-126.976-126.976l-49.091764-49.152a173.477647 173.477647 0 0 1 237.266823 161.370353z" fill="#000000" fillOpacity=".4" p-id="3797"></path></svg> :
                                                        <svg t="1779241283765" style={{ width: '12px', height: '12px' }} className="icon" viewBox="0 0 1113 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3643" xmlnsXlink="http://www.w3.org/1999/xlink" width="217.3828125" height="200"><path d="M11.670028 539.051977a40.654758 40.654758 0 0 1-0.301146-56.705859l0.301146-0.301146 278.771182-284.824223a38.787651 38.787651 0 0 1 54.838751-0.933554l0.933554 0.933554a40.955904 40.955904 0 0 1 0 57.007005l-250.915144 256.426122 250.915144 256.456237a40.955904 40.955904 0 0 1 0.210802 56.946775 39.179141 39.179141 0 0 1-55.380814 0.511949l-0.511949-0.511949L11.790487 539.20255 11.670028 539.051977zM634.260004 30.415782a39.69109 39.69109 0 0 1 47.9425-29.120853l0.632408 0.150574c21.441621 6.022927 34.059653 28.12707 28.367986 49.628919v0.361376l-246.940011 942.286947a39.69109 39.69109 0 0 1-48.544793 29.000394 40.745102 40.745102 0 0 1-28.367987-49.628919V972.70273L634.260004 30.415782zM1101.639149 539.051977l-278.771182 284.854338a39.149026 39.149026 0 0 1-55.380815 0.542064l-0.511948-0.542064a40.895675 40.895675 0 0 1 0-56.946776l250.885029-256.456236-250.885029-256.426122a40.955904 40.955904 0 0 1 0-57.007006 38.787651 38.787651 0 0 1 55.74219 0L1101.609034 481.83417c15.418693 15.71984 15.539152 40.835446 0.301147 56.705858l-0.301147 0.301147 0.030115 0.210802z" p-id="3644"></path></svg>
                                                    }
                                                </button>
                                            </td>
                                        </tr>
                                        {expandedPropsIdx === idx && (
                                            <tr key={`${idx}-props`}>
                                                <td colSpan={6} style={{ padding: '8px 12px', background: '#f5f5f5', fontSize: '11px', fontFamily: 'Consolas, Monaco, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxWidth: '0' }}>
                                                    {JSON.stringify(field.props, null, 2)}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {!searching && fixFields.length === 0 && (
                <div style={{ textAlign: 'center', color: '#999', paddingTop: '60px', fontSize: '13px' }}>
                    点击上方按钮开始检索
                </div>
            )}
        </div>
    );
}
