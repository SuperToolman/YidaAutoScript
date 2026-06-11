/**
 * 页面迁移面板组件
 * 显示页面迁移相关功能，如一键生成审批表单页面和明细表。
 */

import React, { useState, useEffect } from 'react';
import global from '../../../global';
import Utils from '@/services/shared/BrowserUtilsService';
import ConvertModule from '@/services/schema/SchemaConvertService';
import TemplateCodeModule from '@/services/schema/TemplateCodeService';
import ProcessService from '../../../services/ProcessService';

const Card = ({ title, description, loading, disabled, disabledText, onClick, btnText, extraTitle, children }) => (
    <div
        style={{
            background: '#fafafa',
            border: '1px solid #f0f0f0',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '16px' }}>✨</span>
            <span style={{ fontWeight: 600, fontSize: '14px', color: '#333' }}>{title}</span>
            {extraTitle && <div style={{ marginLeft: '4px' }}>{extraTitle}</div>}
        </div>
        <div style={{ fontSize: '12px', color: '#666', lineHeight: '1.5' }}>
            {description}
        </div>

        {children && (
            <div
                style={{
                    marginTop: '4px',
                    paddingTop: '12px',
                    borderTop: '1px dashed #e8e8e8',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}>
                {children}
            </div>
        )}

        <button
            className={`st-btn ${!disabled && !loading ? 'st-btn-primary' : ''}`}
            onClick={onClick}
            disabled={disabled || loading}
            style={{
                padding: '6px 16px',
                borderRadius: '6px',
                border: 'none',
                background: (disabled || loading) ? '#f5f5f5' : '#1890ff',
                color: (disabled || loading) ? '#b8b8b8' : '#fff',
                cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                transition: 'all 0.2s',
                marginTop: '8px',
                alignSelf: 'flex-start'
            }}
        >
            {loading ? '生成中...' : (disabled ? disabledText : btnText)}
        </button>
    </div>
);

const MigrationPanel = () => {
    const [loadingApproval, setLoadingApproval] = useState(false);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [appStructure, setAppStructure] = useState([]);
    const [currentFormName, setCurrentFormName] = useState('');

    const [fields, setFields] = useState([]);
    const [selectedRuleField, setSelectedRuleField] = useState('');
    const [checkedSummaryFields, setCheckedSummaryFields] = useState([]);
    const [summarySearch, setSummarySearch] = useState('');

    const [subForms, setSubForms] = useState([]);
    const [checkedSubForms, setCheckedSubForms] = useState([]);

    const [automationType, setAutomationType] = useState('approval');
    const [generateAutomation, setGenerateAutomation] = useState(false);

    // 每次渲染或组件挂载时，尝试获取最新的结构和当前信息
    useEffect(() => {
        const tryLoadData = () => {
            if (global.info?.appStructure) {
                setAppStructure([...global.info.appStructure]);
            }

            const getFormNameFromDOM = () => {
                const titleSpan = document.querySelector('.nav-brandPageTitle-container span');
                if (titleSpan && titleSpan.textContent.trim()) {
                    return titleSpan.textContent.trim();
                }
                const viewTitleSpan = document.querySelector('.BasicPane--Title--uhmlyuV span');
                if (viewTitleSpan && viewTitleSpan.textContent.trim()) {
                    return viewTitleSpan.textContent.trim();
                }
                return global.info?.formName || '';
            };

            setTimeout(() => {
                const formName = getFormNameFromDOM();
                if (formName) {
                    setCurrentFormName(prev => (prev !== formName ? formName : prev));
                }

                // 提取表单字段
                if (global.info?.formSchema?.pages?.[0]?.componentsTree) {
                    setFields(prev => {
                        if (prev.length > 0) return prev; // 已经加载过了就不重复加载
                        return Utils.getComponentsTreeKeyValue(global.info.formSchema.pages[0].componentsTree);
                    });

                    // 提取子表单 (TableField)
                    setSubForms(prev => {
                        if (prev.length > 0) return prev; // 已经加载过了就不重复加载
                        const extractedSubForms = [];
                        const traverseSubForms = (nodes) => {
                            if (!Array.isArray(nodes)) return;
                            for (const node of nodes) {
                                if (node.componentName === 'TableField') {
                                    const label = node.props?.label?.zh_CN || node.props?.label || '未知明细';
                                    extractedSubForms.push({ fieldId: node.props?.fieldId, label });
                                }
                                // 支持宜搭布局组件/分组组件的深层嵌套查找
                                const potentialChildren = [
                                    node.children, node.items, node.components, node.props?.children, node.props?.items
                                ];
                                for (const childList of potentialChildren) {
                                    if (Array.isArray(childList)) {
                                        traverseSubForms(childList);
                                    }
                                }
                            }
                        };
                        traverseSubForms(global.info.formSchema.pages[0].componentsTree);
                        setCheckedSubForms(extractedSubForms.map(sf => sf.fieldId));
                        return extractedSubForms;
                    });
                }
            }, 1000);
        };

        tryLoadData();
    }, []);

    const currentAppId = global.info?.appId;

    const isApprovalPage = currentFormName.includes('审批');
    const isDetailsPage = currentFormName.includes('明细记录');

    // 检查是否存在特定后缀的表单
    const checkFormExists = (suffix) => {
        if (!currentFormName) return false;
        // 如果是检查明细记录，由于现在命名规则变了，我们直接检查应用里有没有包含“明细记录”这几个字的表单即可（简化判断）
        // 或者精确匹配当前主表生成的所有可能的明细表
        if (suffix === '明细记录') {
            const apps = appStructure || [];
            for (const app of apps) {
                if (app.appId === currentAppId || app.appType === currentAppId) {
                    const forms = app.forms || app.formList || app.children || app.items || app.pages || [];
                    for (const form of forms) {
                        const title = (form.title && form.title.zh_CN) || form.title || form.formName || form.name || '';
                        // 如果有任何一个表单名是以 "当前表单名+某子表名+明细记录" 结尾的，或者简单点只要包含当前表单名和明细记录就认为是已存在
                        if (title.startsWith(currentFormName) && title.endsWith('明细记录')) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }

        const targetName = currentFormName + suffix;
        const apps = appStructure || [];

        for (const app of apps) {
            if (app.appId === currentAppId || app.appType === currentAppId) {
                const forms = app.forms || app.formList || app.children || app.items || app.pages || [];
                for (const form of forms) {
                    const title = (form.title && form.title.zh_CN) || form.title || form.formName || form.name || '';
                    if (title === targetName) return true;
                }
            }
        }
        return false;
    };

    const hasApprovalForm = checkFormExists('审批');
    const hasDetailsForm = checkFormExists('明细记录');

    const handleGenerateApproval = () => {
        if (isApprovalPage || hasApprovalForm) return;

        if (!selectedRuleField) {
            Utils.toast({ title: '请先选择审核状态依据字段（通过该字段匹配主表记录并更新状态）', type: 'warn' });
            return;
        }

        setLoadingApproval(true);

        const selectedRuleLabel = fields.find(f => f.fieldId === selectedRuleField)?.label || '';
        const checkedSummaryData = checkedSummaryFields.map(id => {
            const field = fields.find(f => f.fieldId === id);
            return {
                fieldId: field.fieldId,
                label: field.label,
                titleName: field.titleName
            };
        });
        // 测试
        console.log('Selected Submission Rule Field:', { fieldId: selectedRuleField, label: selectedRuleLabel });
        console.log('Checked Approval Summary Fields:', checkedSummaryData);

        if (!global.services || !global.services.createNewForm) {
            Utils.toast({ title: '未找到 global.services，可能当前环境不在宜搭设计器内，或接口挂载失败', type: 'error' });
            setLoadingApproval(false);
            return;
        }

        // 1. 先创建一个新表单
        global.services.createNewForm(`${currentFormName}审批`, 'process').then(res => {
            if (res.success && res.content) {
                console.log("[ConvertModule.convertApprovalForm] 创建表单成功，开始转换审批表单", res);
                const processCode = res.content.processCode;    // 审批流程的编码
                const formUuid = res.content.formUuid;          // 审批表单的UUID
                const transformedSchema = ConvertModule.convertApprovalForm(global.info.formSchema);

                // 2. 创建表单后让它保存转换后的Schema
                global.services.saveFormSchema(transformedSchema, formUuid).then(saveRes => {
                    if (saveRes.success) {
                        Utils.toast({ title: '生成成功，请刷新页面或到页面管理中查看新生成的审批表单', type: 'success' });
                        setLoadingApproval(false);
                    } else {
                        throw new Error('保存表单结构失败');
                    }
                }).catch(err => {
                    console.error(err);
                    Utils.toast({ title: '保存表单结构失败', type: 'error' });
                    setLoadingApproval(false);
                });

                // 3. 同时提交审批流程的全局设置
                if (processCode) {
                    // 找到当前表单的"审核状态"字段ID
                    const auditField = fields.find(f => f.label.includes('审核状态'));
                    const auditFieldId = auditField ? auditField.fieldId : null;

                    // 先通过 getProcess.json 拉取刚生成的审批表单的【真实流程数据】(包含真实节点的ID和viewJson)
                    global.services.getProcess(processCode, currentAppId, false).then(getProcRes => {
                        if (getProcRes.success && getProcRes.content) {
                            const originProcessJsonStr = getProcRes.content.json || "{}";
                            const originViewJson = getProcRes.content.viewJson || "{}";

                            // 将拉取到的真实 json 传入构造器，仅修改提交规则和摘要，不破坏原有节点结构
                            const updatedData = TemplateCodeModule.getGeneralApprovalSettingsJson(
                                originProcessJsonStr,
                                originViewJson, // 传入 viewJson 保持同步
                                global.info.formUuid, // 这里必须用原主表的UUID
                                currentFormName,
                                { fieldId: selectedRuleField, label: selectedRuleLabel },
                                checkedSummaryData,
                                auditFieldId,
                                processCode, // 传入新流程的 code
                                formUuid,    // 传入新流程的 bindingFormUuid
                                currentAppId // 传入 appId
                            );

                            if (!updatedData || !updatedData.json || !updatedData.viewJson) {
                                console.error('修改流程模板失败');
                                return;
                            }

                            // 发送保存流程设置的请求 (isLogic: false)
                            // 注意：根据之前解决导入问题的核心记忆，对于审批表单（非 LogicFlow 的新版集成自动化），必须传递正确的 isLogic 标识
                            global.services.saveProcess(formUuid, processCode, JSON.stringify(updatedData.json), JSON.stringify(updatedData.viewJson), false, {
                                needReportLine: 'y',
                                processCode: processCode
                            }).then(saveProcRes => {
                                if (saveProcRes.success) {
                                    console.log('流程节点提交规则与摘要设置已成功保存！');
                                } else {
                                    console.warn('流程设置保存可能失败：', saveProcRes);
                                }
                            });
                        } else {
                            console.error('获取初始流程数据失败', getProcRes);
                        }
                    }).catch(err => {
                        console.error('获取初始流程异常', err);
                    });
                }
            } else {
                throw new Error('创建表单失败');
            }
        }).catch(err => {
            console.error(err);
            Utils.toast({ title: '生成审批表单失败，请查看控制台', type: 'error' });
            setLoadingApproval(false);
        });
    };

    const handleGenerateDetails = async () => {
        if (isDetailsPage || hasDetailsForm || subForms.length === 0 || checkedSubForms.length === 0) return;

        setLoadingDetails(true);

        if (!global.services || !global.services.createNewForm) {
            Utils.toast({ title: '未找到 global.services，可能当前环境不在宜搭设计器内，或接口挂载失败', type: 'error' });
            setLoadingDetails(false);
            return;
        }

        try {
            let successCount = 0;
            let automationSuccessCount = 0;
            const automationErrors = [];

            // 遍历所有选中的子表单，逐个生成明细表
            for (const subFormId of checkedSubForms) {
                const subFormInfo = subForms.find(sf => sf.fieldId === subFormId);
                if (!subFormInfo) continue;

                const cleanLabel = subFormInfo.label.replace(/明细$/, '');
                const targetName = `${currentFormName}${cleanLabel}明细记录`;

                console.log(`[MigrationPanel] 开始生成明细表: ${targetName}`);

                // 1. 创建新表单（普通表单类型 'receipt' 或 'form'）
                const res = await global.services.createNewForm(targetName, 'receipt');
                if (res && res.success && res.content) {
                    const formUuid = res.content.formUuid;

                    // 2. 转换 Schema：提取主表+该子表的字段
                    const transformedSchema = ConvertModule.convertDetailsForm(global.info.formSchema, subFormId);

                    // 2.1 生成字段映射（主表字段用公式，子表字段用批量匹配）
                    const normalizeLabel = (t) => (t || '').replace(/\u00a0/g, ' ').replace(/\s+/g, '').trim();
                    const collectMasterFields = () => {
                        const all = Utils.getComponentsTreeKeyValue(global.info.formSchema.pages[0].componentsTree) || [];
                        return all.map((f) => ({ fieldId: f.fieldId, label: f.label || '' }));
                    };
                    const collectSubFields = () => {
                        const found = [];
                        const walk = (nodes) => {
                            if (!Array.isArray(nodes)) return;
                            for (const node of nodes) {
                                if (node && node.componentName === 'TableField' && node.props && node.props.fieldId === subFormId) {
                                    const children = Array.isArray(node.children) ? node.children : [];
                                    children.forEach((c) => {
                                        const fid = c && c.props && c.props.fieldId ? c.props.fieldId : '';
                                        const labelObj = c && c.props && c.props.label ? c.props.label : null;
                                        const label = (labelObj && (labelObj.zh_CN || labelObj.en_US)) || fid;
                                        if (fid) found.push({ fieldId: fid, label: label || '' });
                                    });
                                    return;
                                }
                                if (node && Array.isArray(node.children)) walk(node.children);
                            }
                        };
                        walk(global.info.formSchema.pages[0].componentsTree);
                        return found;
                    };
                    const collectTargetFields = () => {
                        const all = Utils.getComponentsTreeKeyValue(transformedSchema.pages[0].componentsTree) || [];
                        return all.map((f) => ({ fieldId: f.fieldId, label: f.label || '' }));
                    };
                    const collectDetailFieldDefinitions = () => {
                        const containerNames = new Set(['Page', 'FormContainer', 'PageSection', 'Column', 'ColumnsLayout', 'RootHeader', 'TableField']);
                        const list = [];
                        const walk = (nodes) => {
                            if (!Array.isArray(nodes)) return;
                            for (const node of nodes) {
                                if (!node || typeof node !== 'object') continue;
                                const componentName = node.componentName || 'TextField';
                                const fieldId = node.props && node.props.fieldId ? node.props.fieldId : '';
                                if (fieldId && !containerNames.has(componentName)) {
                                    const labelObj = node.props && node.props.label ? node.props.label : null;
                                    const label = (labelObj && (labelObj.zh_CN || labelObj.en_US)) || fieldId;
                                    list.push({
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
                        walk(transformedSchema.pages[0].componentsTree);
                        return list;
                    };
                    const collectSubFieldDefinitions = () => {
                        const found = [];
                        const walk = (nodes) => {
                            if (!Array.isArray(nodes)) return;
                            for (const node of nodes) {
                                if (node && node.componentName === 'TableField' && node.props && node.props.fieldId === subFormId) {
                                    const children = Array.isArray(node.children) ? node.children : [];
                                    children.forEach((c) => {
                                        const fid = c && c.props && c.props.fieldId ? c.props.fieldId : '';
                                        const labelObj = c && c.props && c.props.label ? c.props.label : null;
                                        const label = (labelObj && (labelObj.zh_CN || labelObj.en_US)) || fid;
                                        if (fid) {
                                            found.push({
                                                value: fid,
                                                text: label || fid,
                                                componentName: c.componentName || 'TextField',
                                                props: c.props || {},
                                                supportSort: true
                                            });
                                        }
                                    });
                                    return;
                                }
                                if (node && Array.isArray(node.children)) walk(node.children);
                            }
                        };
                        walk(global.info.formSchema.pages[0].componentsTree);
                        return found;
                    };
                    const masterFields = collectMasterFields();
                    const subFields = collectSubFields();
                    const targetFields = collectTargetFields();
                    const detailFieldDefinitions = collectDetailFieldDefinitions();
                    const subFieldDefinitions = collectSubFieldDefinitions();
                    const subIdSet = new Set(subFields.map(f => String(f.fieldId)));
                    const masterIdSet = new Set(masterFields.map(f => String(f.fieldId)));
                    const findByLabel = (arr, label) => arr.find((x) => normalizeLabel(x.label) === normalizeLabel(label));
                    const fieldMapping = targetFields.map((tf) => {
                        const targetId = String(tf.fieldId || '');
                        if (subIdSet.has(targetId)) return { targetFieldId: targetId, sourceType: 'sub', sourceFieldId: targetId };
                        if (masterIdSet.has(targetId)) return { targetFieldId: targetId, sourceType: 'master', sourceFieldId: targetId };
                        const subHit = findByLabel(subFields, tf.label);
                        if (subHit) return { targetFieldId: targetId, sourceType: 'sub', sourceFieldId: String(subHit.fieldId || '') };
                        const masterHit = findByLabel(masterFields, tf.label);
                        if (masterHit) return { targetFieldId: targetId, sourceType: 'master', sourceFieldId: String(masterHit.fieldId || '') };
                        return { targetFieldId: targetId, sourceType: 'literal', sourceFieldId: '' };
                    }).filter((m) => !!m.targetFieldId);

                    // 3. 保存 Schema
                    const saveRes = await global.services.saveFormSchema(transformedSchema, formUuid);
                    if (saveRes && saveRes.success) {
                        successCount++;
                        console.log(`[MigrationPanel] 成功生成明细表: ${targetName}`);

                        // 4. 可选：同步生成“主表新增 -> 明细表批量新增”的集成自动化
                        if (generateAutomation) {
                            try {
                                await ProcessService.createDetailSyncAutomation({
                                    masterFormUuid: global.info.formUuid,
                                    masterFormName: currentFormName,
                                    subFormFieldId: subFormId,
                                    subFormLabel: subFormInfo.label,
                                    detailFormUuid: formUuid,
                                    detailFormName: targetName,
                                    automationType,
                                    fieldMapping,
                                    detailFieldDefinitions,
                                    subFieldDefinitions
                                });
                                automationSuccessCount++;
                                console.log(`[MigrationPanel] 成功生成集成自动化: ${targetName}`);
                            } catch (e) {
                                const errMsg = e && e.message ? e.message : '未知错误';
                                automationErrors.push(`${targetName}: ${errMsg}`);
                                console.error(`[MigrationPanel] 生成集成自动化失败: ${targetName}`, e);
                            }
                        }
                    } else {
                        console.error(`[MigrationPanel] 保存明细表 ${targetName} 结构失败`);
                    }
                } else {
                    console.error(`[MigrationPanel] 创建明细表 ${targetName} 失败`);
                }
            }

            if (successCount === checkedSubForms.length) {
                if (generateAutomation) {
                    const failedCount = checkedSubForms.length - automationSuccessCount;
                    if (failedCount > 0) {
                        Utils.toast({ title: `成功生成 ${successCount} 个明细表单；集成自动化成功 ${automationSuccessCount}/${checkedSubForms.length}。失败详情请查看控制台。`, type: 'warn', duration: 5000 });
                        console.warn('[MigrationPanel] 集成自动化失败列表:', automationErrors);
                    } else {
                        Utils.toast({ title: `成功生成 ${successCount} 个明细表单，并同步生成 ${automationSuccessCount} 个集成自动化！请刷新页面查看。`, type: 'success', duration: 4000 });
                    }
                } else {
                    Utils.toast({ title: `成功生成 ${successCount} 个明细表单！请刷新页面或到页面管理中查看。`, type: 'success', duration: 4000 });
                }
            } else if (successCount > 0) {
                if (generateAutomation) {
                    Utils.toast({ title: `部分成功，明细表单成功生成 ${successCount}/${checkedSubForms.length}；集成自动化成功 ${automationSuccessCount}/${checkedSubForms.length}。请查看控制台日志。`, type: 'warn', duration: 5000 });
                    if (automationErrors.length) console.warn('[MigrationPanel] 集成自动化失败列表:', automationErrors);
                } else {
                    Utils.toast({ title: `部分成功，成功生成 ${successCount}/${checkedSubForms.length} 个明细表单。请查看控制台日志。`, type: 'warn', duration: 5000 });
                }
            } else {
                Utils.toast({ title: '生成失败，请查看控制台。', type: 'error' });
            }
        } catch (err) {
            console.error('生成明细表单时发生异常:', err);
            Utils.toast({ title: '生成明细表单时发生异常，请查看控制台日志', type: 'error' });
        } finally {
            setLoadingDetails(false);
        }
    };

    const [showPrinciple, setShowPrinciple] = useState(false);
    const [activeTab, setActiveTab] = useState('approval'); // 'approval' | 'details'

    return (
        <div
            style={{ padding: '16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}
        >
            <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.5' }}>
                    当前表单：<strong style={{ color: '#1890ff' }}>{currentFormName || '未知表单'}</strong>
                </div>
                <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                    页面迁移不仅可以一键生成审批表单，还支持生成对应的明细表，并自动建立关联关系。
                </div>
            </div>

            {/* Tab 切换栏 */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e8e8e8', marginBottom: '16px' }}>
                <div
                    onClick={() => setActiveTab('approval')}
                    style={{
                        padding: '8px 16px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: activeTab === 'approval' ? 600 : 400,
                        color: activeTab === 'approval' ? '#1890ff' : '#333',
                        borderBottom: activeTab === 'approval' ? '2px solid #1890ff' : '2px solid transparent',
                        transition: 'all 0.3s'
                    }}
                >
                    生成审批表单
                </div>
                <div
                    onClick={() => setActiveTab('details')}
                    style={{
                        padding: '8px 16px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: activeTab === 'details' ? 600 : 400,
                        color: activeTab === 'details' ? '#1890ff' : '#333',
                        borderBottom: activeTab === 'details' ? '2px solid #1890ff' : '2px solid transparent',
                        transition: 'all 0.3s'
                    }}
                >
                    生成明细表单
                </div>
            </div>

            {activeTab === 'approval' && (
                <Card
                    title="生成审批表单"
                extraTitle={
                    <div
                        onClick={() => setShowPrinciple(!showPrinciple)}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '16px', height: '16px', borderRadius: '50%',
                            background: showPrinciple ? '#1890ff' : '#e6f7ff',
                            color: showPrinciple ? '#fff' : '#1890ff',
                            fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                            border: `1px solid ${showPrinciple ? '#1890ff' : '#91d5ff'}`,
                            transition: 'all 0.2s'
                        }}
                        title="点击查看生成原理与逻辑机制"
                    >
                        !
                    </div>
                }
                description="基于当前普通表单，自动克隆并生成带有审批流程的表单页面，自动配置相关组件状态。"
                loading={loadingApproval}
                disabled={isApprovalPage || hasApprovalForm || !currentFormName}
                disabledText={!currentFormName ? '无法获取当前表单' : (isApprovalPage ? '当前已是审批页' : `已存在: ${currentFormName}审批`)}
                btnText="生成审批表单"
                onClick={handleGenerateApproval}
            >
                {showPrinciple && (
                    <div style={{
                        background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: '6px',
                        padding: '12px', fontSize: '12px', color: '#333', lineHeight: '1.6',
                        marginBottom: '8px'
                    }}>
                        <div style={{ fontWeight: 600, color: '#d46b08', marginBottom: '8px' }}>🚀 一键生成背后执行的 6 大硬核微操作：</div>
                        <ol style={{ paddingLeft: '16px', margin: 0, color: '#595959', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <li><strong>前置嗅探防呆</strong>：实时轮询应用内所有表单，若已存在目标审批表单或处于审批页，自动阻断防止灾难性覆盖。</li>
                            <li><strong>第一阶段造躯壳</strong>：调用宜搭底层 <code>createNewForm</code> 创建空壳审批表单。在前端提取原表单所有组件并篡改为 <code>READONLY</code> / <code>DISABLED</code>，剥离旧规则后重新压入新表单。</li>
                            <li><strong>第二阶段注灵魂</strong>：像爬虫一样绕过前端，调用 <code>getProcess</code> 强行拉取刚创建的新表单在后台真实的空流程基建（包括 JSON 与视图树）。</li>
                            <li><strong>第三阶段连神经</strong>：自动寻找触发节点，将选择的依据字段（如单据编号）注入宜搭 AST 底层。为您自动拼装三种执行形态（Content/Display/Source）的 <code>UPDATE</code> 跨表联动公式，绑定到同意和拒绝动作上。</li>
                            <li><strong>摘要同步防御</strong>：自动将您勾选的摘要字段转换为标准对象结构，并在 <code>viewJson</code> 和 <code>templateJson</code> 之间执行强制深拷贝对齐，彻底规避宜搭引擎白屏崩溃的暗坑。</li>
                            <li><strong>收尾封装上线</strong>：绕过可视化设计器，直接调用 <code>saveProcess</code> 将带自动状态回写的庞大模型推送回宜搭服务器，整个过程仅需数秒。</li>
                        </ol>
                    </div>
                )}
                {!(isApprovalPage || hasApprovalForm || !currentFormName) && fields.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                            <div style={{ fontSize: '12px', color: '#333', marginBottom: '6px' }}>审核状态依据字段 <span style={{ color: '#999' }}>(通过该字段匹配主表记录并更新状态)</span>：</div>
                            <select
                                className="st-select"
                                value={selectedRuleField}
                                onChange={e => setSelectedRuleField(e.target.value)}
                                onMouseDown={e => e.stopPropagation()}
                                onClick={e => e.stopPropagation()}
                                style={{ width: '100%' }}
                            >
                                <option value="">请选择校验字段</option>
                                {fields.filter(f => !f.label.includes('审核状态')).map(f => (
                                    <option key={f.fieldId} value={f.fieldId}>{f.label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <div style={{ fontSize: '12px', color: '#333', marginBottom: '6px' }}>审批摘要字段 <span style={{ color: '#999' }}>(最多选择5个)</span>：</div>
                            <input
                                type="text"
                                className="st-input"
                                placeholder="搜索摘要字段..."
                                value={summarySearch}
                                onChange={e => setSummarySearch(e.target.value)}
                                onMouseDown={e => e.stopPropagation()}
                                onClick={e => e.stopPropagation()}
                                style={{ width: '100%', marginBottom: '8px', padding: '4px 8px', fontSize: '12px', border: '1px solid #d9d9d9', borderRadius: '4px' }}
                            />
                            <div
                                onMouseDown={e => e.stopPropagation()}
                                onClick={e => e.stopPropagation()}
                                style={{
                                    maxHeight: '150px',
                                    overflowY: 'auto',
                                    border: '1px solid #e8e8e8',
                                    borderRadius: '4px',
                                    padding: '8px',
                                    background: '#fff'
                                }}>
                                {fields.filter(f => !summarySearch || f.label.toLowerCase().includes(summarySearch.toLowerCase())).map(f => {
                                    const isChecked = checkedSummaryFields.includes(f.fieldId);
                                    // 检查当前长度，如果没有包含当前字段，且长度 >= 5，则禁用
                                    const isDisabled = !isChecked && checkedSummaryFields.length >= 5;
                                    return (
                                        <label key={f.fieldId} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? 0.4 : 1 }}>
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                disabled={isDisabled}
                                                onMouseDown={e => e.stopPropagation()}
                                                onClick={e => e.stopPropagation()}
                                                onChange={e => {
                                                    if (e.target.checked) {
                                                        if (checkedSummaryFields.length >= 5) {
                                                            Utils.toast({ title: '最多只能选择 5 个摘要字段！', type: 'warn' });
                                                            return;
                                                        }
                                                        setCheckedSummaryFields([...checkedSummaryFields, f.fieldId]);
                                                    } else {
                                                        setCheckedSummaryFields(checkedSummaryFields.filter(id => id !== f.fieldId));
                                                    }
                                                }}
                                            />
                                            <span style={{ fontSize: '12px', color: '#333' }}>{f.label}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 摘要字段排序与效果预览 */}
                        {checkedSummaryFields.length > 0 && (
                            <div style={{
                                display: 'flex',
                                gap: '16px',
                                marginTop: '4px',
                                borderTop: '1px dashed #e8e8e8',
                                paddingTop: '12px',
                                flexWrap: 'wrap' // 保证在小屏幕下能自动换行
                            }}>
                                {/* 左侧：排序区 */}
                                <div style={{ flex: 1, minWidth: '200px' }}>
                                    <div style={{ fontSize: '12px', color: '#333', marginBottom: '6px' }}>已选字段排序 <span style={{ color: '#999' }}>(决定卡片展示顺序)</span>：</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {checkedSummaryFields.map((id, index) => {
                                            const f = fields.find(field => field.fieldId === id);
                                            return (
                                                <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f5f5f5', padding: '6px 8px', borderRadius: '4px' }}>
                                                    <span style={{ fontSize: '12px', color: '#333' }}>{index + 1}. {f?.label}</span>
                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                const newFields = [...checkedSummaryFields];
                                                                [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
                                                                setCheckedSummaryFields(newFields);
                                                            }}
                                                            disabled={index === 0}
                                                            style={{ border: 'none', background: 'transparent', cursor: index === 0 ? 'not-allowed' : 'pointer', opacity: index === 0 ? 0.3 : 1, padding: '0 4px', fontSize: '14px', color: '#1890ff', fontWeight: 'bold' }}
                                                            title="上移"
                                                        >↑</button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                const newFields = [...checkedSummaryFields];
                                                                [newFields[index + 1], newFields[index]] = [newFields[index], newFields[index + 1]];
                                                                setCheckedSummaryFields(newFields);
                                                            }}
                                                            disabled={index === checkedSummaryFields.length - 1}
                                                            style={{ border: 'none', background: 'transparent', cursor: index === checkedSummaryFields.length - 1 ? 'not-allowed' : 'pointer', opacity: index === checkedSummaryFields.length - 1 ? 0.3 : 1, padding: '0 4px', fontSize: '14px', color: '#1890ff', fontWeight: 'bold' }}
                                                            title="下移"
                                                        >↓</button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* 右侧：效果预览区 */}
                                <div style={{ flex: 1, minWidth: '260px' }}>
                                    <div style={{ fontSize: '12px', color: '#333', marginBottom: '6px' }}>钉钉卡片效果预览：</div>
                                    <div style={{ background: '#f0f2f5', padding: '16px', borderRadius: '6px', display: 'flex', justifyContent: 'center' }}>
                                        <div style={{ background: '#fff', borderRadius: '8px', padding: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', position: 'relative', overflow: 'hidden', width: '100%', maxWidth: '280px' }}>
                                            {/* 流程中印章水印 */}
                                            <div style={{ position: 'absolute', right: '12px', top: '12px', width: '56px', height: '56px', border: '2px solid rgba(24,144,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(24,144,255,0.4)', fontSize: '12px', fontWeight: 'bold', transform: 'rotate(-20deg)', pointerEvents: 'none' }}>
                                                流程中
                                            </div>

                                            {/* 卡片头部 */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                                                <div style={{ width: '16px', height: '16px', background: '#1890ff', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: 'bold' }}>宜</div>
                                                <span style={{ fontSize: '12px', color: '#1890ff', fontWeight: 500 }}>宜搭</span>
                                            </div>
                                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#333', marginBottom: '16px' }}>张三发起的审批流程表单</div>

                                            {/* 卡片内容摘要 */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {checkedSummaryFields.map(id => {
                                                    const f = fields.find(field => field.fieldId === id);
                                                    return (
                                                        <div key={id} style={{ display: 'flex', fontSize: '12px', lineHeight: '1.4' }}>
                                                            <span style={{ color: '#999', width: '76px', flexShrink: 0 }}>{f?.label}：</span>
                                                            <span style={{ color: '#333', background: '#f5f5f5', padding: '0 6px', borderRadius: '2px', wordBreak: 'break-all' }}>{f?.label}的值</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* 卡片底部操作栏 */}
                                            <div style={{ borderTop: '1px solid #f0f0f0', marginTop: '16px', paddingTop: '12px', display: 'flex', justifyContent: 'space-around', fontSize: '14px', fontWeight: 500 }}>
                                                <span style={{ color: '#ff4d4f', cursor: 'pointer' }}>拒绝</span>
                                                <span style={{ color: '#e8e8e8' }}>|</span>
                                                <span style={{ color: '#1890ff', cursor: 'pointer' }}>同意</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Card>
            )}

            {activeTab === 'details' && (
            <Card
                title="生成明细表单"
                description="基于当前主表单，自动提取子表单字段并生成对应的明细录入页面，方便管理 1对N 数据关系。"
                loading={loadingDetails}
                disabled={isDetailsPage || hasDetailsForm || !currentFormName || subForms.length === 0}
                disabledText={!currentFormName ? '无法获取当前表单' : (isDetailsPage ? '当前已是明细记录页' : (subForms.length === 0 ? '无子表单组件' : `已存在: ${currentFormName}明细记录`))}
                btnText="生成明细表单"
                onClick={handleGenerateDetails}
            >
                {!(isDetailsPage || hasDetailsForm || !currentFormName) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {subForms.length > 0 ? (
                            <>
                                <div style={{ fontSize: '12px', color: '#333', marginBottom: '4px' }}>选择需要提取的子表单组件：</div>
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    maxHeight: '200px',
                                    overflowY: 'auto'
                                }}>
                                    {subForms.map(sf => {
                                        // 如果子表单名称以"明细"结尾，则去掉这俩个字再拼接
                                        const cleanLabel = sf.label.replace(/明细$/, '');
                                        const targetName = `${currentFormName}${cleanLabel}明细记录`;
                                        const isChecked = checkedSubForms.includes(sf.fieldId);
                                        return (
                                            <label key={sf.fieldId} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                cursor: 'pointer',
                                                padding: '10px 12px',
                                                borderRadius: '6px',
                                                background: isChecked ? '#e6f7ff' : '#fafafa',
                                                border: `1px solid ${isChecked ? '#91d5ff' : '#e8e8e8'}`,
                                                transition: 'all 0.2s',
                                                margin: 0
                                            }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onMouseDown={e => e.stopPropagation()}
                                                    onClick={e => e.stopPropagation()}
                                                    onChange={e => {
                                                        if (e.target.checked) {
                                                            setCheckedSubForms([...checkedSubForms, sf.fieldId]);
                                                        } else {
                                                            setCheckedSubForms(checkedSubForms.filter(id => id !== sf.fieldId));
                                                        }
                                                    }}
                                                    style={{ margin: 0 }}
                                                />
                                                <div style={{ display: 'flex', alignItems: 'center', fontSize: '13px', flex: 1, gap: '6px' }}>
                                                    <span style={{ color: '#333', fontWeight: 500, flexShrink: 0 }}>{sf.label}</span>
                                                    <span style={{ color: '#bfbfbf', fontSize: '12px' }}>→</span>
                                                    <span style={{ color: '#1890ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={targetName}>{targetName}</span>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>

                                {/* 集成自动化选项嵌入到明细表单卡片内部 */}
                                <div style={{
                                    marginTop: '12px',
                                    paddingTop: '12px',
                                    borderTop: '1px dashed #e8e8e8',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            type="checkbox"
                                            id="generateAutomationCb"
                                            checked={generateAutomation}
                                            onMouseDown={e => e.stopPropagation()}
                                            onClick={e => e.stopPropagation()}
                                            onChange={e => setGenerateAutomation(e.target.checked)}
                                            style={{ margin: 0, cursor: 'pointer' }}
                                        />
                                        <label htmlFor="generateAutomationCb" style={{ fontSize: '13px', fontWeight: 500, color: '#333', cursor: 'pointer' }}>
                                            同步生成集成自动化生成明细表的逻辑
                                        </label>
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#999', paddingLeft: '21px', marginBottom: '4px' }}>
                                        勾选后，将在生成明细表单的同时，自动创建与之关联的集成自动化规则。
                                    </div>

                                    {/* 自动化生成类型选择 (带有前缀缩进以体现层级) */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '21px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: generateAutomation ? 'pointer' : 'not-allowed', opacity: generateAutomation ? 1 : 0.6 }}>
                                            <input
                                                type="radio"
                                                name="automationType"
                                                value="create"
                                                checked={automationType === 'create'}
                                                onMouseDown={e => e.stopPropagation()}
                                                onClick={e => e.stopPropagation()}
                                                onChange={() => setAutomationType('create')}
                                                disabled={!generateAutomation}
                                                style={{ margin: 0, cursor: generateAutomation ? 'pointer' : 'not-allowed' }}
                                            />
                                            <span style={{ fontSize: '12px', color: '#333' }}>
                                                <strong style={{ color: '#1890ff' }}>{currentFormName}</strong> 新建触发
                                                <span style={{ color: '#999', marginLeft: '4px' }}>(当普通表单提交创建成功时触发)</span>
                                            </span>
                                        </label>

                                        <label style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            cursor: (!generateAutomation || !(isApprovalPage || hasApprovalForm)) ? 'not-allowed' : 'pointer',
                                            opacity: (!generateAutomation || !(isApprovalPage || hasApprovalForm)) ? 0.6 : 1
                                        }}>
                                            <input
                                                type="radio"
                                                name="automationType"
                                                value="approval"
                                                checked={automationType === 'approval'}
                                                onMouseDown={e => e.stopPropagation()}
                                                onClick={e => e.stopPropagation()}
                                                onChange={() => setAutomationType('approval')}
                                                disabled={!generateAutomation || !(isApprovalPage || hasApprovalForm)}
                                                style={{ margin: 0, cursor: (!generateAutomation || !(isApprovalPage || hasApprovalForm)) ? 'not-allowed' : 'pointer' }}
                                            />
                                            <span style={{ fontSize: '12px', color: '#333' }}>
                                                审批通过触发
                                                <span style={{ color: '#999', marginLeft: '4px' }}>
                                                    {!(isApprovalPage || hasApprovalForm)
                                                        ? <span style={{ color: '#faad14' }}>(需先生成或处于审批表单)</span>
                                                        : '(当带有审批流程的表单同意时触发)'}
                                                </span>
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div style={{ fontSize: '12px', color: '#faad14', padding: '8px 12px', background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: '4px' }}>
                                当前表单中未检测到子表单（明细）组件，无法生成明细表。
                            </div>
                        )}
                    </div>
                )}
            </Card>
            )}
        </div>
    );
};

export default MigrationPanel;