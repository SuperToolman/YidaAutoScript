/**
 * 现代化的 API 代码展示卡片 (由原 CodeModule.js 重构而来)
 */
import React, { useState, useEffect, useRef } from 'react';
import Utils from '@/services/shared/BrowserUtilsService';
import MonacoModule from '@/services/ui/MonacoEditorService';
import Config from '@/services/shared/StyleConfigService';
import global from '../global';

export const ApiCard = ({ title, name, methodName, desc, code, allowToggle = true }) => {
    const [codeVisible, setCodeVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [copyText, setCopyText] = useState('复制');
    const editorHostRef = useRef(null);
    const editorInstanceRef = useRef(null);

    const displayMethodName = name || methodName;
    const stateKey = String(displayMethodName || 'card');

    useEffect(() => {
        if (allowToggle && global.crossDsState?.[stateKey]?.codeVisible) {
            setCodeVisible(true);
        }
    }, [allowToggle, stateKey]);

    useEffect(() => {
        let mounted = true;
        if (codeVisible && !editorInstanceRef.current && editorHostRef.current) {
            // 立即使用 textarea 回退显示代码，保证用户能立刻看到内容
            if (editorHostRef.current) {
                // 转义 HTML 实体以防止注入，并正确渲染代码
                const escapeHtml = (text) => {
                    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
                    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
                };
                editorHostRef.current.innerHTML = `<textarea readonly style="width: 100%; height: 100%; padding: 8px; border: none; font-size: 12px; line-height: 1.4; box-sizing: border-box; resize: none; background: transparent; font-family: Consolas, 'Courier New', monospace; outline: none; white-space: pre; color: #333;" wrap="off">${escapeHtml(code)}</textarea>`;
            }
            setTimeout(() => {
                if (!mounted) return;
                MonacoModule.createIsolatedMonacoEditor(editorHostRef.current, {
                    value: code,
                    language: 'javascript',
                    theme: 'vs',
                    minimap: { enabled: false },
                    fontSize: 12
                }).then(instance => {
                    if (mounted) {
                        editorInstanceRef.current = instance;
                        setLoading(false); // 加载完成，取消 loading 状态
                    } else if (instance) {
                        instance.dispose();
                    }
                });
            }, 50);
        }
        
        if (allowToggle) {
            if (!global.crossDsState) global.crossDsState = {};
            global.crossDsState[stateKey] = { 
                ...(global.crossDsState[stateKey] || {}), 
                codeVisible 
            };
        }

        return () => {
            mounted = false;
        };
    }, [codeVisible, code, allowToggle, stateKey]);

    const handleCopy = (e) => {
        e.stopPropagation();
        const currentCode = editorInstanceRef.current ? editorInstanceRef.current.getValue() : code;
        
        // 使用标准的剪贴板 API
        navigator.clipboard.writeText(currentCode).then(() => {
            setCopyText('已复制');
            setTimeout(() => setCopyText('复制'), 1500);
            Utils.toast({ title: '代码已复制到剪贴板', type: 'success' });
        }).catch(() => {
            Utils.toast({ title: '复制失败', type: 'error' });
        });
    };

    return (
        <div 
            className="st-api-card" 
            style={{
                padding: '8px 10px', 
                border: '1px solid #eee', 
                borderRadius: '4px', 
                marginBottom: '6px', 
                background: '#fff',
                transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';
                e.currentTarget.style.borderColor = '#1890ff';
            }}
            onMouseOut={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = '#eee';
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#333' }}>
                        {title || displayMethodName}
                    </div>
                    {(title && displayMethodName) && (
                        <div style={{ fontSize: '11px', color: '#1890ff', background: '#e6f7ff', padding: '1px 4px', borderRadius: '2px' }}>
                            {displayMethodName}
                        </div>
                    )}
                </div>
                
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {allowToggle && (
                        <div 
                            className="st-icon-btn"
                            title="查看/编辑代码"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!codeVisible && !editorInstanceRef.current) {
                                    setLoading(true);
                                }
                                setCodeVisible(!codeVisible);
                            }}
                            style={{ width: '20px', height: '20px', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            dangerouslySetInnerHTML={{ __html: Config.ICONS.code }}
                        />
                    )}
                    <button 
                        onClick={handleCopy}
                        style={{
                            border: copyText === '已复制' ? '1px solid #52c41a' : '1px solid #d9d9d9',
                            background: '#fff',
                            cursor: 'pointer',
                            padding: '1px 6px',
                            borderRadius: '3px',
                            fontSize: '11px',
                            color: copyText === '已复制' ? '#52c41a' : '#666',
                            transition: 'all 0.2s'
                        }}
                    >
                        {copyText}
                    </button>
                </div>
            </div>

            <div style={{ fontSize: '11px', color: '#999', lineHeight: 1.4, marginTop: '2px' }}>
                {desc}
            </div>

            {allowToggle && (
                <div style={{ 
                    display: codeVisible ? 'block' : 'none', 
                    marginTop: '8px', 
                    border: '1px solid #d9d9d9', 
                    borderRadius: '4px', 
                    overflow: 'hidden',
                    position: 'relative'
                }}>
                    <div ref={editorHostRef} style={{ width: '100%', height: '200px', background: '#f5f5f5', position: 'relative' }} />
                    {(loading && codeVisible) && (
                        <div style={{ 
                            position: 'absolute', 
                            top: '5px', 
                            right: '5px', 
                            color: '#999', 
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'rgba(255, 255, 255, 0.8)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            pointerEvents: 'none'
                        }}>
                            <span dangerouslySetInnerHTML={{ __html: Config.ICONS.loading }} style={{ width: '14px', height: '14px', display: 'inline-block' }}></span>
                            加载编辑器中...
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ApiCard;
