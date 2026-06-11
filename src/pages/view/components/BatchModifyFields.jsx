import React, { useState, useEffect, useRef } from 'react';
import global from '../../../global';
import Utils from '@/services/shared/BrowserUtilsService';
import TextFieldConfig from './fieldConfigs/TextFieldConfig';
import NumberFieldConfig from './fieldConfigs/NumberFieldConfig';

// 常见的宜搭字段类型
const FIELD_TYPES = [
    { label: '单行文本', value: 'TextField' },
    { label: '多行文本', value: 'TextareaField' },
    { label: '数字', value: 'NumberField' },
    { label: '单选', value: 'RadioField' },
    { label: '多选', value: 'CheckboxField' },
    { label: '下拉选择', value: 'SelectField' },
    { label: '日期', value: 'DateField' },
    { label: '人员选择', value: 'EmployeeField' },
    { label: '部门选择', value: 'DepartmentField' },
    { label: '图片上传', value: 'ImageField' },
    { label: '附件上传', value: 'AttachmentField' },
    { label: '明细表', value: 'TableField' },
];

const BatchModifyFields = () => {
    const [fieldName, setFieldName] = useState('');
    const [fieldType, setFieldType] = useState('TextField');
    const [includeSubform, setIncludeSubform] = useState(false);        // 是否包含明细表子字段
    const [includeProcessForm, setIncludeProcessForm] = useState(false); // 是否包含流程表单
    const [onlyCurrentApp, setOnlyCurrentApp] = useState(true);
    const [availableFields, setAvailableFields] = useState([]);
    const [importJsonText, setImportJsonText] = useState('');

    // 二次确认对话框相关状态
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [matchedFormList, setMatchedFormList] = useState([]);
    const [selectedFormIds, setSelectedFormIds] = useState([]);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [isExecuting, setIsExecuting] = useState(false);
    const [executeProgress, setExecuteProgress] = useState({ current: 0, total: 0, success: 0, fail: 0 });

    // 用于给子组件传递和获取配置信息
    const configRef = useRef(null);

    const handleImportConfig = () => {
        try {
            if (!importJsonText.trim()) {
                Utils.toast({ title: '请输入配置 JSON', type: 'warn' });
                return;
            }
            const schema = JSON.parse(importJsonText);

            let componentSchema = schema;

            // 兼容 test.json 那种包裹了 componentsTree 的格式
            if (schema.componentsTree && Array.isArray(schema.componentsTree) && schema.componentsTree.length > 0) {
                componentSchema = schema.componentsTree[0];
            }

            // 自动推断类型
            if (componentSchema.componentName) {
                const typeExists = FIELD_TYPES.some(t => t.value === componentSchema.componentName);
                if (typeExists) {
                    setFieldType(componentSchema.componentName);
                } else {
                    Utils.toast({ title: `不支持导入类型：${componentSchema.componentName}`, type: 'warn' });
                    return;
                }
            } else {
                Utils.toast({ title: '无法识别 JSON 中的组件类型 (componentName)', type: 'warn' });
                return;
            }

            // 自动提取字段名称（标题）并回填
            if (componentSchema.props && componentSchema.props.label) {
                const labelObj = componentSchema.props.label;
                const extractedLabel = typeof labelObj === 'string' ? labelObj : (labelObj.zh_CN || labelObj.en_US || '');
                if (extractedLabel) {
                    setFieldName(extractedLabel);
                }
            }

            // 如果子组件实现了 importConfig，则调用它
            setTimeout(() => {
                if (configRef.current && typeof configRef.current.importConfig === 'function') {
                    configRef.current.importConfig(componentSchema);
                    Utils.toast({ title: '配置导入成功', type: 'success' });
                    setImportJsonText(''); // 导入成功后清空输入框
                } else {
                    Utils.toast({ title: '该类型暂不支持导入配置', type: 'warn' });
                }
            }, 100);

        } catch (err) {
            console.error('导入配置失败', err);
            Utils.toast({ title: '导入配置失败，请确保输入的是有效的 JSON', type: 'error' });
        }
    };

    const handleBatchModify = async () => {
        if (!fieldName) {
            Utils.toast({ title: '请先选择或输入要修改的字段名称', type: 'warn' });
            return;
        }

        if (configRef.current && typeof configRef.current.getConfig === 'function') {
            const finalConfig = configRef.current.getConfig();
            console.log('--- 批量修改字段配置 ---');
            console.log('目标字段名称:', fieldName);
            console.log('目标字段类型:', fieldType);
            console.log('要修改的属性:', finalConfig);

            if (!global.services) {
                Utils.toast({ title: 'Services 未加载', type: 'error' });
                return;
            }

            Utils.toast({ title: '正在获取表单信息，请稍候...', type: 'info' });

            // 将整个异步逻辑抽离出来不阻塞当前渲染
            const executeBatchMatch = async () => {
                console.log('开始执行批量修改匹配逻辑...');
                try {
                    // 1. 获取应用与表单结构
                    const currentAppId = global.info.appId;
                    console.log(`当前应用 appId: ${currentAppId}`);

                    let appsToScan = global.info.appStructure || [];

                    if (appsToScan.length === 0) {
                        console.log('未在缓存中找到应用结构，尝试主动拉取...');
                        appsToScan = await global.services.getFullAppStructure() || [];
                    }

                    if (onlyCurrentApp) {
                        appsToScan = appsToScan.filter(app => app.appId === currentAppId);
                    }

                    if (appsToScan.length === 0) {
                        Utils.toast({ title: '未找到应用结构数据，请先在左侧展开应用', type: 'error' });
                        return;
                    }

                    const matchedForms = [];
                    let totalFormsScanned = 0;

                    // 递归查找匹配指定 componentName 和 label 的节点
                    const findMatchedNodes = (componentsTree, formName) => {
                        // console.log("componentsTree是", componentsTree)

                        let hasMatch = false;
                        const checkNode = (node) => {
                            if (!node) return;

                            const nodeType = node.componentName || node.type || node.fieldType;
                            // 兼容多种方式提取 label
                            let nodeLabel = '';
                            if (node.props?.label) {
                                const labelObj = node.props.label;
                                nodeLabel = typeof labelObj === 'string' ? labelObj : (labelObj?.zh_CN || labelObj?.en_US || '');
                            } else if (node.name) {
                                // 兼容 test3.json 这种直接把国际化对象放在 name 里的结构
                                const nameObj = node.name;
                                nodeLabel = typeof nameObj === 'string' ? nameObj : (nameObj?.zh_CN || nameObj?.en_US || '');
                            } else if (node.description) {
                                const descObj = node.description;
                                nodeLabel = typeof descObj === 'string' ? descObj : (descObj?.zh_CN || descObj?.en_US || '');
                            } else if (node.label) {
                                const labelObj = node.label;
                                nodeLabel = typeof labelObj === 'string' ? labelObj : (labelObj?.zh_CN || labelObj?.en_US || '');
                            } else if (node.title) {
                                nodeLabel = node.title;
                            }

                            // 移除多余的换行符，防止匹配失败（如 "字典项\n"）
                            nodeLabel = nodeLabel ? nodeLabel.trim() : '';

                            if (nodeLabel === fieldName) {
                                // console.log(`[${formName}] 发现同名字段:`, nodeLabel, '类型:', nodeType, '目标类型:', fieldType);
                            }

                            if (nodeType === fieldType && nodeLabel === fieldName) {
                                hasMatch = true;
                            }

                            // 如果用户未勾选“包含明细表子字段”，且当前节点是明细表，则跳过子节点的遍历
                            if (!includeSubform && nodeType === 'TableField') {
                                return;
                            }

                            // 遍历子节点
                            const childrenLists = [
                                node.children, node.components, node.fields, node.fieldList,
                                node.columns, node.props?.columns, node.props?.components,
                                node.props?.fields, node.props?.fieldList, node.props?.children, node.props?.items
                            ];

                            childrenLists.forEach(subList => {
                                if (Array.isArray(subList)) {
                                    subList.forEach(child => checkNode(child));
                                }
                            });
                        };

                        if (Array.isArray(componentsTree)) {
                            componentsTree.forEach(rootNode => checkNode(rootNode));
                        }
                        return hasMatch;
                    };

                    // 2. 遍历应用和表单
                    appsToScan.forEach(app => {
                        if (!app.forms) return;

                        const targetForms = app.forms.filter(f =>
                            f.formType === 'receipt' || (f.formType === 'process' && includeProcessForm)
                        );
                        totalFormsScanned += targetForms.length;

                        targetForms.forEach(form => {
                            const formId = form.formUuid || form.id || form.formId;
                            const formName = form.formName || form.name || '未命名表单';
                            const fields = Array.isArray(form.fields) ? form.fields : (Array.isArray(form.fieldList) ? form.fieldList : []);

                            if (fields.length > 0) {
                                const hasMatch = findMatchedNodes(fields, formName);
                                if (hasMatch) {
                                    matchedForms.push({
                                        formName: formName,
                                        formId: formId,
                                        appId: app.appId || app.appType,
                                        appName: app.appName || app.appOriginalName || '未知应用'
                                    });
                                }
                            }
                        });
                    });

                    // 3. 打印匹配成功的表单信息
                    console.log(`共扫描了 ${appsToScan.length} 个应用，包含 ${totalFormsScanned} 个表单`);
                    console.log('--- 匹配成功的表单列表 ---');
                    console.log(`共找到 ${matchedForms.length} 个表单包含目标字段`);

                    if (matchedForms.length > 0) {
                        setMatchedFormList(matchedForms);
                        setSelectedFormIds(matchedForms.map(f => f.formId)); // 默认全选
                        setSearchKeyword(''); // 重置搜索词
                        setShowConfirmDialog(true);
                    } else {
                        Utils.toast({ title: '未找到任何匹配的表单', type: 'warn' });
                    }

                } catch (error) {
                    console.error('批量修改执行异常:', error);
                    Utils.toast({ title: '执行过程中发生异常，请查看控制台', type: 'error' });
                }
            };

            // 触发异步执行
            executeBatchMatch();

        } else {
            Utils.toast({ title: '获取配置失败', type: 'error' });
        }
    };

    useEffect(() => {
        // 从缓存的 appStructure 中提取当前应用下所有的唯一字段名与类型
        const loadFields = () => {
            const appId = global.info.appId;
            const appStructure = global.info.appStructure || [];
            const currentApp = appStructure.find(app => app.appId === appId);

            if (currentApp && currentApp.forms) {
                const fieldMap = new Map(); // key: "name-type", value: { name, type }

                currentApp.forms.forEach(form => {
                    const fields = Array.isArray(form.fields) ? form.fields : (Array.isArray(form.fieldList) ? form.fieldList : []);

                    // 递归提取所有嵌套的字段
                    const extractFields = (fList) => {
                        fList.forEach(f => {
                            const name = (f.label && f.label.zh_CN) || f.label || f.name || f.title || '';
                            const type = f.componentName || f.type || f.fieldType || '';

                            if (name && type) {
                                const key = `${name}-${type}`;
                                if (!fieldMap.has(key)) {
                                    fieldMap.set(key, { name, type });
                                }
                            }

                            // 探测子节点
                            const potentialLists = [
                                f.children, f.components, f.fields, f.fieldList,
                                f.columns, f.props?.columns, f.props?.components,
                                f.props?.fields, f.props?.fieldList, f.props?.children, f.props?.items
                            ];
                            potentialLists.forEach(sub => {
                                if (Array.isArray(sub)) extractFields(sub);
                            });
                        });
                    };

                    extractFields(fields);
                });

                setAvailableFields(Array.from(fieldMap.values()));
            }
        };

        loadFields();
    }, []);

    const handleSelectField = (e) => {
        const val = e.target.value;
        setFieldName(val);

        // 尝试自动匹配字段类型
        const matched = availableFields.find(f => f.name === val);
        if (matched && matched.type) {
            // 确保类型在我们的列表中，或者默认使用第一个
            const typeExists = FIELD_TYPES.some(t => t.value === matched.type);
            if (typeExists) {
                setFieldType(matched.type);
            }
        }
    };

    const handleExecuteModify = async () => {
        // 如果当前有搜索词，只提交“在搜索结果中被勾选的表单”
        // 如果没有搜索词，提交所有被勾选的表单
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

        const finalConfig = configRef.current?.getConfig() || {};
        if (Object.keys(finalConfig).length === 0) {
            Utils.toast({ title: '没有勾选任何需要修改的属性', type: 'warn' });
            return;
        }

        console.log('--- 开始执行最终修改 ---');
        console.log('目标表单列表:', finalTargetIds);
        console.log('修改属性:', finalConfig);

        setIsExecuting(true);
        setExecuteProgress({ current: 0, total: finalTargetIds.length, success: 0, fail: 0 });

        let successCount = 0;
        let failCount = 0;
        const currentAppId = global.info.appId;

        // 递归修改节点属性
        const applyModifications = (componentsTree, currentFormId) => {
            let modified = false;

            const traverseAndModify = (node) => {
                if (!node) return;

                const nodeType = node.componentName || node.type || node.fieldType;

                // 提取并清理 label
                let nodeLabel = '';
                if (node.props?.label) {
                    const labelObj = node.props.label;
                    nodeLabel = typeof labelObj === 'string' ? labelObj : (labelObj?.zh_CN || labelObj?.en_US || '');
                } else if (node.name) {
                    const nameObj = node.name;
                    nodeLabel = typeof nameObj === 'string' ? nameObj : (nameObj?.zh_CN || nameObj?.en_US || '');
                } else if (node.description) {
                    const descObj = node.description;
                    nodeLabel = typeof descObj === 'string' ? descObj : (descObj?.zh_CN || descObj?.en_US || '');
                } else if (node.label) {
                    const labelObj = node.label;
                    nodeLabel = typeof labelObj === 'string' ? labelObj : (labelObj?.zh_CN || labelObj?.en_US || '');
                } else if (node.title) {
                    nodeLabel = node.title;
                }
                nodeLabel = nodeLabel ? nodeLabel.trim() : '';

                // 如果匹配到目标字段，执行属性覆盖
                if (nodeType === fieldType && nodeLabel === fieldName) {
                    // 确保 props 对象存在
                    if (!node.props) node.props = {};

                    // 遍历 finalConfig，将勾选的属性覆盖上去
                    for (const [key, value] of Object.entries(finalConfig)) {
                        // 如果是 formula 相关的配置，将其中的特殊占位符替换为当前表单的 formId
                        if (key === 'formula' && typeof value === 'string') {
                            // 支持替换 {currentFormId} 占位符
                            node.props[key] = value.replace(/\{currentFormId\}/g, currentFormId);
                        } else if (key === 'complexValue' && value && value.complexType === 'formula' && typeof value.formula === 'string') {
                            const replacedFormula = value.formula.replace(/\{currentFormId\}/g, currentFormId);
                            node.props[key] = {
                                ...value,
                                formula: replacedFormula
                            };
                        } else {
                            node.props[key] = value;
                        }
                    }
                    modified = true;
                    console.log(`已修改字段 [${nodeLabel}] 的属性`, finalConfig);
                }

                // 如果用户未勾选“包含明细表子字段”，且当前节点是明细表，则跳过子节点的遍历
                if (!includeSubform && nodeType === 'TableField') {
                    return;
                }

                // 继续遍历子节点
                const childrenLists = [
                    node.children, node.components, node.fields, node.fieldList,
                    node.columns, node.props?.columns, node.props?.components,
                    node.props?.fields, node.props?.fieldList, node.props?.children, node.props?.items
                ];

                childrenLists.forEach(subList => {
                    if (Array.isArray(subList)) {
                        subList.forEach(child => traverseAndModify(child));
                    }
                });
            };

            if (Array.isArray(componentsTree)) {
                componentsTree.forEach(rootNode => traverseAndModify(rootNode));
            }

            return modified;
        };

        for (let i = 0; i < finalTargetIds.length; i++) {
            const formId = finalTargetIds[i];
            const matchedForm = matchedFormList.find(f => f.formId === formId);
            const targetAppId = matchedForm ? matchedForm.appId : currentAppId;

            try {
                // 1. 获取最新全量 Schema
                const schemaRes = await global.services.getFormSchema(formId, targetAppId);
                let fullSchema = null;

                try {
                    fullSchema = typeof schemaRes === 'string' ? JSON.parse(schemaRes) : schemaRes;
                } catch (e) {
                    throw new Error('Schema 解析失败');
                }

                // 兼容不同版本的 Schema 结构：
                // 1. V5/superform 结构: fullSchema.pages[0].componentsTree
                // 2. 旧版结构: fullSchema.componentsTree
                let targetComponentsTree = null;
                if (fullSchema && fullSchema.componentsTree) {
                    targetComponentsTree = fullSchema.componentsTree;
                } else if (fullSchema && fullSchema.pages && fullSchema.pages.length > 0 && fullSchema.pages[0].componentsTree) {
                    targetComponentsTree = fullSchema.pages[0].componentsTree;
                }

                if (!targetComponentsTree) {
                    throw new Error('未找到 componentsTree');
                }

                // 2. 修改 Schema
                const isModified = applyModifications(targetComponentsTree, formId);

                if (isModified) {
                    // 3. 保存修改后的 Schema
                    const saveRes = await global.services.saveFormSchema(JSON.stringify(fullSchema), formId, targetAppId);
                    if (saveRes && saveRes.success !== false) {
                        successCount++;
                    } else {
                        throw new Error(saveRes?.errorMsg || '保存接口返回失败');
                    }
                } else {
                    console.warn(`表单 ${formId} 未实际发生修改（可能结构异常）`);
                    // 虽然没修改，但不算报错，算跳过
                    successCount++;
                }

            } catch (error) {
                console.error(`表单 ${formId} 修改失败:`, error);
                failCount++;
            }

            // 更新进度
            setExecuteProgress({ current: i + 1, total: finalTargetIds.length, success: successCount, fail: failCount });
        }

        setIsExecuting(false);
        Utils.toast({ title: `批量修改完成！成功: ${successCount}, 失败: ${failCount}`, type: successCount > 0 ? 'success' : 'error' });

        // 成功后关闭 Dialog
        if (failCount === 0) {
            setTimeout(() => setShowConfirmDialog(false), 1500);
        }
    };

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
        // 全选/取消全选仅作用于当前搜索过滤出的列表
        const filteredIds = filteredFormList.map(f => f.formId);

        // 检查当前过滤列表中是否所有项都已被选中
        const isAllFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selectedFormIds.includes(id));

        if (isAllFilteredSelected) {
            // 如果过滤出的已全选，则将这些从已选列表中剔除（仅取消过滤项）
            setSelectedFormIds(prev => prev.filter(id => !filteredIds.includes(id)));
        } else {
            // 否则，把过滤出的所有项加入到已选列表中（取并集去重）
            setSelectedFormIds(prev => Array.from(new Set([...prev, ...filteredIds])));
        }
    };

    // 计算当前按钮最终会提交的表单数量
    const getFinalSubmitCount = () => {
        if (searchKeyword.trim() !== '') {
            const filteredIds = filteredFormList.map(f => f.formId);
            return selectedFormIds.filter(id => filteredIds.includes(id)).length;
        }
        return selectedFormIds.length;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
                background: '#fff',
                border: '1px solid #ebebeb',
                borderRadius: '6px',
                padding: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '20px',
                    paddingBottom: '12px',
                    borderBottom: '1px solid #f0f0f0'
                }}>
                    <h3 style={{ padding: 0, fontSize: '15px', margin: 0, color: '#1f2d3d', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                        <span style={{ color: '#005fb8', fontSize: '18px' }}>🎯</span> 目标字段筛选
                    </h3>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '13px', color: '#555', transition: 'color 0.2s' }}>
                            <input
                                type="checkbox"
                                checked={includeSubform}
                                onChange={(e) => setIncludeSubform(e.target.checked)}
                                style={{ marginRight: '6px', accentColor: '#005fb8' }}
                            />
                            包含明细表子字段
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '13px', color: '#555', transition: 'color 0.2s' }}>
                            <input
                                type="checkbox"
                                checked={includeProcessForm}
                                onChange={(e) => setIncludeProcessForm(e.target.checked)}
                                style={{ marginRight: '6px', accentColor: '#005fb8' }}
                            />
                            包含流程表单
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '13px', color: '#555', transition: 'color 0.2s' }}>
                            <input
                                type="checkbox"
                                checked={onlyCurrentApp}
                                onChange={(e) => setOnlyCurrentApp(e.target.checked)}
                                style={{ marginRight: '6px', accentColor: '#005fb8' }}
                            />
                            仅匹配当前应用
                        </label>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* 第一行：字段名称与类型 */}
                    <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '13px', color: '#555', marginBottom: '8px', fontWeight: 500 }}>
                                字段名称 <span style={{ color: '#999', fontSize: '12px', fontWeight: 'normal' }}>(支持从当前应用中选取)</span>
                            </label>
                            <input
                                className="st-input"
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    fontSize: '13px',
                                    borderRadius: '4px',
                                    border: '1px solid #dcdfe6',
                                    transition: 'border-color 0.2s, box-shadow 0.2s'
                                }}
                                value={fieldName}
                                onChange={handleSelectField}
                                placeholder="输入或选择要修改的字段名称"
                                list="available-fields-list"
                            />
                            <datalist id="available-fields-list">
                                {availableFields.map((f, i) => (
                                    <option key={`${f.name}-${f.type}-${i}`} value={f.name}>{f.type}</option>
                                ))}
                            </datalist>
                        </div>

                        <div style={{ width: '240px' }}>
                            <label style={{ display: 'block', fontSize: '13px', color: '#555', marginBottom: '8px', fontWeight: 500 }}>字段类型</label>
                            <select
                                className="st-input"
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    fontSize: '13px',
                                    borderRadius: '4px',
                                    border: '1px solid #dcdfe6',
                                    backgroundColor: '#fff',
                                    transition: 'border-color 0.2s'
                                }}
                                value={fieldType}
                                onChange={(e) => setFieldType(e.target.value)}
                            >
                                {FIELD_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.label} ({t.value})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* 导入配置区域 */}
                    <div style={{
                        marginTop: '4px',
                        padding: '12px',
                        background: '#f8f9fa',
                        borderRadius: '4px',
                        border: '1px dashed #e4e7ed',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'center'
                    }}>
                        <span style={{ fontSize: '13px', color: '#666', flexShrink: 0, fontWeight: 500 }}>快速导入:</span>
                        <input
                            type="text"
                            className="st-input"
                            placeholder="在此粘贴需要导入的配置 JSON"
                            value={importJsonText}
                            onChange={(e) => setImportJsonText(e.target.value)}
                            style={{
                                flex: 1,
                                padding: '6px 12px',
                                fontSize: '13px',
                                borderRadius: '4px',
                                border: '1px solid #dcdfe6',
                                backgroundColor: '#fff'
                            }}
                        />
                        <button
                            className="st-btn"
                            onClick={handleImportConfig}
                            style={{
                                background: '#fff',
                                border: '1px solid #005fb8',
                                color: '#005fb8',
                                padding: '6px 16px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                flexShrink: 0,
                                fontWeight: 500,
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => {
                                e.target.style.background = '#f0f7ff';
                            }}
                            onMouseOut={(e) => {
                                e.target.style.background = '#fff';
                            }}
                        >
                            导入配置
                        </button>
                    </div>
                </div>
            </div>

            {/* 配置面板区域 */}
            <div style={{ 
                background: '#fff', 
                border: '1px solid #ebebeb', 
                borderRadius: '6px', 
                padding: '20px', 
                flex: 1, 
                overflowY: 'auto',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
                <h3 style={{ 
                    padding: 0, 
                    fontSize: '15px', 
                    margin: '0 0 20px 0', 
                    color: '#1f2d3d', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    fontWeight: 600,
                    borderBottom: '1px solid #f0f0f0',
                    paddingBottom: '12px'
                }}>
                    <span style={{ color: '#005fb8', fontSize: '18px' }}>⚙️</span> 修改内容配置
                    <span style={{ fontSize: '12px', color: '#999', fontWeight: 400, marginLeft: 'auto' }}>
                        *解锁左侧图标的属性才会参与批量覆盖
                    </span>
                </h3>
                <div style={{ padding: '0 8px' }}>
                    {fieldType === 'TextField' ? (
                        <TextFieldConfig ref={configRef} />
                    ) : fieldType === 'NumberField' ? (
                        <NumberFieldConfig ref={configRef} />
                    ) : (
                        <div style={{ color: '#999', fontSize: '13px', padding: '40px 20px', textAlign: 'center' }}>
                            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🚧</div>
                            {FIELD_TYPES.find(t => t.value === fieldType)?.label || fieldType} 类型批量修改配置开发中...
                        </div>
                    )}
                </div>
            </div>

            {/* 批量修改扫描按钮 */}
            <div style={{ marginTop: '16px' }}>
                <button
                    onClick={handleBatchModify}
                    style={{
                        width: '100%',
                        height: '36px',
                        backgroundColor: '#1890ff',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        transition: 'background-color 0.3s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#40a9ff'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1890ff'}
                >
                    扫描并准备修改
                </button>
            </div>

            {/* 二次确认对话框 (Dialog) */}
            {showConfirmDialog && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999,
                    display: 'flex', justifyContent: 'center', alignItems: 'center'
                }}>
                    <div style={{
                        width: '500px', maxHeight: '80vh', backgroundColor: '#fff',
                        borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        display: 'flex', flexDirection: 'column', overflow: 'hidden'
                    }}>
                        {/* Header */}
                        <div style={{
                            padding: '16px 20px', borderBottom: '1px solid #f0f0f0',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
                                确认修改目标表单
                            </span>
                            <span
                                onClick={() => setShowConfirmDialog(false)}
                                style={{ cursor: 'pointer', color: '#999', fontSize: '20px', lineHeight: 1 }}
                            >×</span>
                        </div>

                        {/* Body */}
                        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, position: 'relative' }}>
                            {isExecuting && (
                                <div style={{
                                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                    backgroundColor: 'rgba(255,255,255,0.9)', zIndex: 10,
                                    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'
                                }}>
                                    <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', color: '#1890ff' }}>
                                        正在执行批量修改...
                                    </div>
                                    <div style={{ width: '80%', height: '8px', backgroundColor: '#f0f0f0', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${(executeProgress.current / executeProgress.total) * 100}%`,
                                            height: '100%', backgroundColor: '#1890ff', transition: 'width 0.3s'
                                        }}></div>
                                    </div>
                                    <div style={{ marginTop: '12px', fontSize: '13px', color: '#666' }}>
                                        进度: {executeProgress.current} / {executeProgress.total}
                                        <span style={{ marginLeft: '12px', color: '#52c41a' }}>成功: {executeProgress.success}</span>
                                        {executeProgress.fail > 0 && <span style={{ marginLeft: '8px', color: '#f5222d' }}>失败: {executeProgress.fail}</span>}
                                    </div>
                                </div>
                            )}

                            <div style={{ marginBottom: '16px', color: '#666', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>
                                    <span>共扫描到 <strong>{matchedFormList.length}</strong> 个表单包含目标字段：</span>
                                    <span style={{ color: '#1890ff' }}>{fieldName} ({fieldType})</span>
                                    <br />请勾选需要执行批量修改的表单。
                                </span>
                                <input
                                    type="text"
                                    placeholder="搜索表单名称或ID..."
                                    value={searchKeyword}
                                    onChange={(e) => setSearchKeyword(e.target.value)}
                                    style={{
                                        padding: '4px 8px', width: '180px', height: '28px',
                                        border: '1px solid #d9d9d9', borderRadius: '4px',
                                        fontSize: '13px'
                                    }}
                                />
                            </div>

                            <div style={{
                                border: '1px solid #d9d9d9', borderRadius: '4px', overflow: 'hidden'
                            }}>
                                <div style={{
                                    padding: '10px 16px', backgroundColor: '#fafafa', borderBottom: '1px solid #d9d9d9',
                                    display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer'
                                }} onClick={toggleAllSelection}>
                                    <input
                                        type="checkbox"
                                        checked={filteredFormList.length > 0 && filteredFormList.every(f => selectedFormIds.includes(f.formId))}
                                        onChange={() => { }} // 由父级 onClick 接管
                                    />
                                    <span style={{ fontWeight: 'bold' }}>
                                        {searchKeyword ? `全选搜索结果 (${filteredFormList.filter(f => selectedFormIds.includes(f.formId)).length}/${filteredFormList.length})` : `全选 (${selectedFormIds.length}/${matchedFormList.length})`}
                                    </span>
                                </div>
                                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                    {filteredFormList.length === 0 ? (
                                        <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>没有匹配的表单</div>
                                    ) : (
                                        filteredFormList.map(form => (
                                            <div
                                                key={form.formId}
                                                style={{
                                                    padding: '10px 16px', borderBottom: '1px solid #f0f0f0',
                                                    display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
                                                    backgroundColor: selectedFormIds.includes(form.formId) ? '#e6f7ff' : '#fff'
                                                }}
                                                onClick={() => toggleFormSelection(form.formId)}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedFormIds.includes(form.formId)}
                                                    onChange={() => { }} // 由父级 onClick 接管
                                                />
                                                <span style={{ flex: 1, color: '#333' }}>
                                                    {form.formName}
                                                    {!onlyCurrentApp && <span style={{ color: '#999', fontSize: '12px', marginLeft: '8px' }}>[{form.appName}]</span>}
                                                </span>
                                                <span style={{ color: '#999', fontSize: '12px' }}>{form.formId}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{
                            padding: '12px 20px', borderTop: '1px solid #f0f0f0', backgroundColor: '#fafafa',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <div style={{ fontSize: '12px', color: '#999' }}>
                                {searchKeyword.trim() !== '' && (
                                    <span>
                                        注意: 当前为搜索状态，仅会修改搜索结果中被勾选的表单。
                                        {selectedFormIds.length > getFinalSubmitCount() && (
                                            <span
                                                onClick={() => setSelectedFormIds(filteredFormList.map(f => f.formId))}
                                                style={{ color: '#1890ff', cursor: 'pointer', marginLeft: '8px' }}
                                            >
                                                清空其他隐藏选项
                                            </span>
                                        )}
                                    </span>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={() => setShowConfirmDialog(false)}
                                    disabled={isExecuting}
                                    style={{
                                        padding: '0 16px', height: '32px', border: '1px solid #d9d9d9',
                                        backgroundColor: '#fff', borderRadius: '4px', cursor: isExecuting ? 'not-allowed' : 'pointer',
                                        opacity: isExecuting ? 0.5 : 1
                                    }}
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleExecuteModify}
                                    disabled={getFinalSubmitCount() === 0 || isExecuting}
                                    style={{
                                        padding: '0 16px', height: '32px', border: 'none',
                                        backgroundColor: (getFinalSubmitCount() > 0 && !isExecuting) ? '#1890ff' : '#d9d9d9',
                                        color: '#fff', borderRadius: '4px', cursor: (getFinalSubmitCount() > 0 && !isExecuting) ? 'pointer' : 'not-allowed'
                                    }}
                                >
                                    {isExecuting ? '正在修改...' : `确认修改 (${getFinalSubmitCount()})`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BatchModifyFields;
