import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Utils from '@/services/shared/BrowserUtilsService';
import global from '../../../global';

const BatchCopyModal = ({ visible, onClose }) => {
    const [forms, setForms] = useState([]);
    const [loading, setLoading] = useState(false);
    const [keyword, setKeyword] = useState('');
    const [selectedForms, setSelectedForms] = useState({});
    const [copying, setCopying] = useState(false);

    useEffect(() => {
        if (visible) {
            fetchForms();
        } else {
            // Reset state on close
            setForms([]);
            setKeyword('');
            setSelectedForms({});
        }
    }, [visible]);

    const fetchForms = async () => {
        setLoading(true);
        Utils.toast({ title: '正在获取应用表单列表...', type: 'info' });
        try {
            const fetchedForms = await global.services.fetchAllForms(global.info.appId);
            if (!fetchedForms || fetchedForms.length === 0) {
                Utils.toast({ title: '当前应用下没有可复制的表单', type: 'warn' });
            } else {
                setForms(fetchedForms);
            }
        } catch (e) {
            Utils.toast({ title: '获取表单列表失败', type: 'error' });
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectAll = (e) => {
        const checked = e.target.checked;
        const newSelected = { ...selectedForms };
        visibleForms.forEach((form) => {
            newSelected[form.formUuid] = checked;
        });
        setSelectedForms(newSelected);
    };

    const handleCheckboxChange = (formUuid, checked) => {
        setSelectedForms(prev => ({ ...prev, [formUuid]: checked }));
    };

    const handleConfirmCopy = async () => {
        const selectedList = forms.filter(form => selectedForms[form.formUuid]);
        if (selectedList.length === 0) {
            Utils.toast({ title: '请至少选择一个表单', type: 'warn' });
            return;
        }

        setCopying(true);
        try {
            const schemas = [];
            for (let i = 0; i < selectedList.length; i++) {
                const { formUuid, i18nTitle, formType, type } = selectedList[i];
                const formName = i18nTitle?.zh_CN || '未命名表单';
                const actualFormType = formType || type || 'receipt';
                
                Utils.toast({ title: `正在获取 ${formName} (${i + 1}/${selectedList.length})`, type: 'info' });
                const schema = await global.services.getFormSchema(formUuid, global.info.appId);
                if (schema) {
                    schema._copyFormName = formName;
                    schema._copyFormType = actualFormType;
                    schemas.push(schema);
                }
            }

            const schemaStr = JSON.stringify(schemas, null, 2);
            await navigator.clipboard.writeText(schemaStr);
            Utils.toast({ title: `成功复制 ${schemas.length} 个表单Schema到剪贴板！`, type: 'success' });
            onClose();
        } catch (error) {
            console.error('[BatchCopyModal] 批量复制失败:', error);
            Utils.toast({ title: '批量复制失败: ' + error.message, type: 'error' });
        } finally {
            setCopying(false);
        }
    };

    if (!visible) return null;

    const visibleForms = forms.filter(form => {
        if (!keyword) return true;
        const name = (form.i18nTitle?.zh_CN || '').toLowerCase();
        return name.includes(keyword.toLowerCase());
    });

    const isAllVisibleSelected = visibleForms.length > 0 && visibleForms.every(form => selectedForms[form.formUuid]);

    const modalContent = (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ background: '#fff', width: 500, maxHeight: '80vh', borderRadius: 8, display: 'flex', flexDirection: 'column', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #e8e8e8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: 16, color: '#333' }}>批量复制表单</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#999' }}>✕</button>
                </div>
                
                <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
                    <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input 
                            type="checkbox" 
                            id="yida-batch-copy-select-all" 
                            style={{ marginRight: 8, cursor: 'pointer' }}
                            checked={isAllVisibleSelected}
                            onChange={handleSelectAll}
                        />
                        <label htmlFor="yida-batch-copy-select-all" style={{ cursor: 'pointer', fontSize: 14, color: '#333', userSelect: 'none', marginRight: 12 }}>全选</label>
                        
                        <input 
                            type="text" 
                            placeholder="搜索表单..." 
                            style={{ flex: 1, height: 28, border: '1px solid #dbdbdb', borderRadius: 4, padding: '0 8px', fontSize: 13, marginRight: 8 }}
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                        />
                        <button 
                            style={{ padding: '0 8px', height: 28, border: '1px solid #d9d9d9', background: '#fff', color: '#999', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
                            onClick={() => setKeyword('')}
                        >清除</button>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>加载中...</div>
                    ) : (
                        <div>
                            {visibleForms.map((form) => (
                                <div key={form.formUuid} style={{ marginBottom: 8, display: 'flex', alignItems: 'center' }}>
                                    <input 
                                        type="checkbox" 
                                        id={`form-cb-${form.formUuid}`}
                                        style={{ marginRight: 8, cursor: 'pointer' }}
                                        checked={!!selectedForms[form.formUuid]}
                                        onChange={(e) => handleCheckboxChange(form.formUuid, e.target.checked)}
                                    />
                                    <label htmlFor={`form-cb-${form.formUuid}`} style={{ cursor: 'pointer', fontSize: 14, color: '#666', userSelect: 'none' }}>
                                        {form.i18nTitle?.zh_CN || '未命名表单'}
                                    </label>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ padding: '16px 24px', borderTop: '1px solid #e8e8e8', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    <button 
                        style={{ padding: '0 16px', height: 32, border: '1px solid #d9d9d9', background: '#fff', borderRadius: 4, cursor: 'pointer' }}
                        onClick={onClose}
                    >取消</button>
                    <button 
                        style={{ padding: '0 16px', height: 32, border: 'none', background: copying ? '#999' : '#1890ff', color: '#fff', borderRadius: 4, cursor: 'pointer' }}
                        onClick={handleConfirmCopy}
                        disabled={copying}
                    >{copying ? '读取中...' : '确认复制'}</button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default BatchCopyModal;