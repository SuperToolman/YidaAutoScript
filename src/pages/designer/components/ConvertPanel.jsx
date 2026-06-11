/**
 * 转换面板组件
 * 显示关联表单配置转换面板，用户可以在其中输入和查看转换结果。
 */



import React, { useRef, useEffect, useState } from 'react';
import global from '../../../global';
import Utils from '@/services/shared/BrowserUtilsService';
import ConvertModule from '@/services/schema/SchemaConvertService';
import MonacoModule from '@/services/ui/MonacoEditorService';
import { CopyButton } from '../../../components/Shared';

const ConvertPanel = () => {
    const editorRef = useRef(null);
    const editorInstance = useRef(null);
    const [inputValue, setInputValue] = useState('');
    const [resultValue, setResultValue] = useState('');

    useEffect(() => {
        // Ensure schema is loaded
        if (!global.info.formSchema) {
            global.services.getFormSchema().then(content => {
                if (content) {
                    console.log("成功获取到formSchema", content);
                    global.info.formSchema = content;
                    initEditor();
                }
            });
        } else {
            initEditor();
        }

        return () => {
            if (editorInstance.current) {
                editorInstance.current.dispose();
            }
        };
    }, []);

    const initEditor = async () => {
        if (!editorRef.current) return;
        
        const schemaValue = (global.info.formSchema && typeof global.info.formSchema === 'object')
            ? JSON.stringify(global.info.formSchema, null, 2)
            : (global.info.formSchema || '// Schema content will appear here');

        if (!editorInstance.current) {
            // Use setTimeout to ensure the container is fully mounted and has layout dimensions
            setTimeout(async () => {
                if (!editorRef.current) return;
                editorInstance.current = await MonacoModule.createIsolatedMonacoEditor(editorRef.current, {
                    value: schemaValue,
                    language: 'json',
                    theme: 'vs',
                    minimap: { enabled: false },
                    fontSize: 12
                });
            }, 300); // 增加延迟，确保DOM和样式完全就绪
        } else {
            editorInstance.current.setValue(schemaValue);
        }
    };

    const handleFormConvert = async () => {
        if (!inputValue) {
            Utils.toast({ title: '请输入需要转换的关联表单配置', type: 'warn' });
            return;
        }
        try {
            let tree = JSON.parse(inputValue);
            let isFullSchema = false;

            if (tree && Array.isArray(tree.componentsTree)) {
                tree = tree.componentsTree;
                isFullSchema = true;
            } else if (tree && tree.componentName === 'Page' && Array.isArray(tree.children)) {
                tree = [tree];
            } else if (!Array.isArray(tree)) {
                tree = [tree];
            }

            const infoList = await ConvertModule.getConvertInfo(JSON.parse(inputValue));
            if (infoList && infoList.resultList && infoList.resultList.length > 0) {
                infoList.resultList.forEach(item => {
                    if (item.type === 'component') {
                        ConvertModule.replaceAssociationFormInTree(tree, item);
                    } else if (item.type === 'datasource') {
                        if (item.ds && item.ds.options) {
                            item.ds.options.appType = item.to.appId;
                            item.ds.options.formUuid = item.to.formUuid;
                            if (item.ds.options.appName) item.ds.options.appName = item.to.appName;
                            if (item.ds.options.tableName) item.ds.options.tableName = item.to.formName;
                        }
                    }
                });
                Utils.toast({ title: `成功转换 ${infoList.resultList.length} 项关联配置！`, type: 'success' });
            } else {
                Utils.toast({ title: '未找到需要置换的项', type: 'info' });
            }
            
            let finalResult = JSON.parse(inputValue);
            if (!isFullSchema) {
                if (tree.length === 1 && tree[0].componentName === 'Page' && Array.isArray(tree[0].children)) {
                    finalResult = tree[0].children;
                } else {
                    finalResult = tree;
                }
            }
            setResultValue(JSON.stringify(finalResult, null, 2));
        } catch (err) {
            Utils.toast({ title: '解析或转换失败: ' + err.message, type: 'error' });
        }
    };

    const handleSchemaConvert = async () => {
        if (!inputValue) {
            Utils.toast({ title: '请输入需要转换的Schema内容', type: 'warn' });
            return;
        }
        try {
            const schema = JSON.parse(inputValue);
            const pages = Array.isArray(schema.pages) ? schema.pages : [];
            if (pages.length === 0) {
                Utils.toast({ title: '未找到 pages 数组', type: 'warn' });
                return;
            }

            let totalResults = 0;
            const globalJsInfo = await ConvertModule.getConvertInfo({ 
                actions: schema.actions,
                _idNameMapping: schema._idNameMapping 
            });
            
            if (globalJsInfo.resultList && globalJsInfo.resultList.length) {
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
                    totalResults += infoList.resultList.length;
                }
            }
            Utils.toast({ title: `Schema 转换完成，共替换 ${totalResults} 项规则`, type: 'success' });
            setResultValue(JSON.stringify(schema, null, 2));
        } catch (err) {
            Utils.toast({ title: '解析或转换失败: ' + err.message, type: 'error' });
        }
    };

    const handleCopySchema = async () => {
        const schemaValue = (global.info.formSchema && typeof global.info.formSchema === 'object')
            ? JSON.stringify(global.info.formSchema, null, 2)
            : (global.info.formSchema || '');
        if (schemaValue) {
            await Utils.setClipboard(schemaValue);
            Utils.toast({ title: 'Schema复制成功！', type: 'success' });
        } else {
            Utils.toast({ title: 'Schema为空', type: 'warn' });
        }
    };

    const handleImportSchema = () => {
        Utils.toast({ title: '导入Schema功能开发中...', type: 'info' });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', height: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>
            
            {/* 卡片 1: 关联表单转换 */}
            <div style={{ 
                background: '#fafafa', 
                border: '1px solid #f0f0f0', 
                borderRadius: '8px', 
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>🔄</span>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: '#333' }}>关联表单配置转换</span>
                </div>
                <div style={{ fontSize: '12px', color: '#666', lineHeight: '1.5' }}>
                    在下方输入旧版的关联表单或 Schema 映射配置，将其转换为最新格式。
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                    <input 
                        type="text"
                        placeholder="在此粘贴源 JSON 配置字符串..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        style={{ flex: 1, padding: '6px 10px', fontSize: '13px', border: '1px solid #d9d9d9', borderRadius: '6px', outline: 'none', transition: 'border-color 0.2s' }}
                        onFocus={e => e.target.style.borderColor = '#1890ff'}
                        onBlur={e => e.target.style.borderColor = '#d9d9d9'}
                    />
                    <button 
                        className="st-btn" 
                        onClick={handleFormConvert}
                        title="将旧版关联表单配置清洗、修复失效的数据源与引用绑定关系。"
                        style={{ padding: '0 16px', background: '#1890ff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#fff', fontWeight: 500 }}
                    >
                        转换关联表单
                    </button>
                    <button 
                        className="st-btn" 
                        onClick={handleSchemaConvert}
                        title="将旧版映射规则清洗转换为最新的标准字段规则，防止联动失效。"
                        style={{ padding: '0 16px', background: '#1890ff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#fff', fontWeight: 500 }}
                    >
                        Schema 映射转换
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                    <input 
                        type="text"
                        readOnly
                        placeholder="转换结果将在此显示..."
                        value={resultValue}
                        style={{ flex: 1, padding: '6px 10px', fontSize: '13px', border: '1px solid #d9d9d9', background: '#f5f5f5', borderRadius: '6px', outline: 'none', color: '#666' }}
                    />
                    <CopyButton 
                        text="复制结果" 
                        value={resultValue || ' '} 
                        style={{ 
                            padding: '6px 12px', 
                            fontSize: '12px', 
                            background: resultValue ? '#1890ff' : '#d9d9d9', 
                            color: '#fff', 
                            border: 'none', 
                            borderRadius: '6px',
                            cursor: resultValue ? 'pointer' : 'not-allowed',
                            pointerEvents: resultValue ? 'auto' : 'none'
                        }} 
                    />
                </div>
            </div>

            {/* 卡片 2: Schema 实时查看器 */}
            <div style={{ 
                background: '#fafafa', 
                border: '1px solid #f0f0f0', 
                borderRadius: '8px', 
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                flex: 1
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px' }}>📝</span>
                        <span style={{ fontWeight: 600, fontSize: '14px', color: '#333' }}>当前页面 Schema 数据</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                            className="st-btn" 
                            onClick={handleCopySchema}
                            style={{ padding: '4px 12px', background: '#fff', border: '1px solid #d9d9d9', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#333' }}
                        >
                            一键复制全部
                        </button>
                        <button 
                            className="st-btn" 
                            onClick={handleImportSchema}
                            style={{ padding: '4px 12px', background: '#f5f5f5', border: '1px solid #e8e8e8', borderRadius: '6px', cursor: 'not-allowed', fontSize: '12px', color: '#999' }}
                            title="该功能正在开发中"
                        >
                            导入 Schema
                        </button>
                    </div>
                </div>

                {/* Editor Container */}
                <div 
                    ref={editorRef}
                    className="st-schema-editor-host"
                    style={{ flex: 1, border: '1px solid #d9d9d9', borderRadius: '6px', overflow: 'hidden', background: '#fff', minHeight: '350px', position: 'relative' }}
                >
                </div>
            </div>
        </div>
    );
};

export default ConvertPanel;