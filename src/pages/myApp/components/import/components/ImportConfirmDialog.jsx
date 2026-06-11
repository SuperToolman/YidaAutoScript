import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import Utils from '@/services/shared/BrowserUtilsService';

export default function ImportConfirmDialog({ isOpen, onClose, onConfirm }) {
    const [pastedText, setPastedText] = useState('');
    const [showPasteArea, setShowPasteArea] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fileName, setFileName] = useState('');
    const fileInputRef = useRef(null);

    if (!isOpen) return null;

    const parseAndConfirm = (text) => {
        if (!text || !text.trim()) {
            Utils.toast({ title: '剪贴板为空，请手动粘贴或上传迁移 JSON', type: 'warn' });
            setShowPasteArea(true);
            return;
        }

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            Utils.toast({ title: '内容不是有效的 JSON 格式', type: 'error' });
            setShowPasteArea(true);
            return;
        }

        if (!Array.isArray(data)) {
            Utils.toast({ title: 'JSON 数据结构不符合要求 (应为应用数组)', type: 'error' });
            setShowPasteArea(true);
            return;
        }

        Utils.toast({ title: `成功读取到 ${data.length} 个应用的迁移数据！`, type: 'success' });

        const initialTasks = data.map(app => ({
            appId: app.appId,
            appName: app.appName,
            formsData: app.forms || [],
            logicFlowData: app.logicFlow || [],
            navStructureData: app.navStructure || [],
            navIds: app.navIds || { ids: [], idsStr: '' },
            totalForms: (app.forms || []).length,
            successForms: 0,
            failedForms: 0,
            status: 'pending',
            logs: []
        }));

        onClose();
        onConfirm(initialTasks);
    };

    const handleClipboardRead = async () => {
        setLoading(true);
        try {
            const text = await navigator.clipboard.readText();
            parseAndConfirm(text);
        } catch (error) {
            console.error('读取剪贴板失败:', error);
            Utils.toast({ title: '读取剪贴板失败，请手动粘贴或上传文件', type: 'warn' });
            setShowPasteArea(true);
        } finally {
            setLoading(false);
        }
    };

    const handlePasteConfirm = () => {
        parseAndConfirm(pastedText);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setFileName(file.name);
        setLoading(true);

        const reader = new FileReader();
        reader.onload = (event) => {
            setLoading(false);
            parseAndConfirm(event.target.result);
        };
        reader.onerror = () => {
            setLoading(false);
            Utils.toast({ title: '文件读取失败，请重试', type: 'error' });
        };
        reader.readAsText(file);
    };

    const resetFileInput = () => {
        setFileName('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return ReactDOM.createPortal(
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 99999,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                background: '#fff', width: showPasteArea ? '600px' : '420px', borderRadius: '8px',
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
                        开始执行迁移
                    </h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#999', padding: 0, lineHeight: 1 }}>×</button>
                </div>

                {!showPasteArea ? (
                    <>
                        <div style={{ padding: '24px', fontSize: '14px', color: '#333', lineHeight: 1.6 }}>
                            即将开始迁移流程。为了避免大数据量输入导致页面卡顿，系统将直接读取您<strong>剪贴板中的 JSON 数据</strong>作为迁移配置。<br/><br/>
                            请确保您已经复制了上一步生成的迁移 JSON，并允许浏览器读取剪贴板权限。<br/><br/>
                            若数据量过大导致剪贴板读取失败，请使用下方的<strong>文件上传</strong>方式。
                        </div>

                        <div style={{ padding: '0 24px 16px 24px' }}>
                            <button
                                onClick={() => { resetFileInput(); fileInputRef.current?.click(); }}
                                style={{ padding: '8px 20px', background: '#f5f5f5', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', color: '#333', display: 'flex', alignItems: 'center', gap: '6px', width: '100%', justifyContent: 'center' }}>
                                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="17 8 12 3 7 8"></polyline>
                                    <line x1="12" y1="3" x2="12" y2="15"></line>
                                </svg>
                                上传迁移 JSON 文件
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json,application/json"
                                style={{ display: 'none' }}
                                onChange={handleFileChange}
                            />
                            {fileName && (
                                <div style={{ marginTop: '8px', fontSize: '12px', color: '#00a854', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    已选择: {fileName}
                                </div>
                            )}
                        </div>

                        <div style={{ padding: '16px 24px', borderTop: '1px solid #ebebeb', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#fafafa' }}>
                            <button
                                onClick={onClose}
                                style={{ padding: '8px 20px', background: '#fff', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', color: '#333' }}
                            >取消</button>
                            <button
                                onClick={handleClipboardRead}
                                disabled={loading}
                                style={{ padding: '8px 20px', background: loading ? '#d9d9d9' : '#00a854', color: '#fff', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >{loading ? '读取中...' : '确认读取并迁移'}</button>
                        </div>
                    </>
                ) : (
                    <>
                        <div style={{ padding: '24px', fontSize: '14px', color: '#333', lineHeight: 1.6 }}>
                            <div style={{ marginBottom: '12px', color: '#fa8c16', fontWeight: 500 }}>
                                ⚠️ 剪贴板读取失败或数据为空
                            </div>
                            请通过以下任一方式提供迁移数据：
                        </div>

                        <div style={{ padding: '0 24px 12px 24px' }}>
                            <button
                                onClick={() => { resetFileInput(); fileInputRef.current?.click(); }}
                                style={{ padding: '8px 20px', background: '#005fb8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', width: '100%', justifyContent: 'center' }}>
                                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="17 8 12 3 7 8"></polyline>
                                    <line x1="12" y1="3" x2="12" y2="15"></line>
                                </svg>
                                上传迁移 JSON 文件
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json,application/json"
                                style={{ display: 'none' }}
                                onChange={handleFileChange}
                            />
                            {fileName && (
                                <div style={{ marginTop: '8px', fontSize: '12px', color: '#00a854', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    已选择: {fileName}
                                </div>
                            )}
                        </div>

                        <div style={{ padding: '0 24px 12px 24px', textAlign: 'center', color: '#999', fontSize: '12px' }}>
                            — 或手动粘贴 —
                        </div>

                        <div style={{ padding: '0 24px' }}>
                            <textarea
                                value={pastedText}
                                onChange={(e) => setPastedText(e.target.value)}
                                placeholder="在此粘贴迁移 JSON..."
                                style={{
                                    width: '100%', height: '140px', border: '1px solid #d9d9d9', borderRadius: '4px',
                                    padding: '12px', fontSize: '12px', fontFamily: 'Consolas, Monaco, monospace',
                                    resize: 'vertical', outline: 'none', boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        <div style={{ padding: '16px 24px', borderTop: '1px solid #ebebeb', display: 'flex', justifyContent: 'space-between', gap: '12px', background: '#fafafa', marginTop: '16px' }}>
                            <button
                                onClick={() => { setShowPasteArea(false); setPastedText(''); resetFileInput(); }}
                                style={{ padding: '8px 20px', background: '#fff', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', color: '#333' }}
                            >返回</button>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={onClose}
                                    style={{ padding: '8px 20px', background: '#fff', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', color: '#333' }}
                                >取消</button>
                                <button
                                    onClick={handlePasteConfirm}
                                    disabled={!pastedText.trim()}
                                    style={{ padding: '8px 20px', background: pastedText.trim() ? '#00a854' : '#d9d9d9', color: '#fff', border: 'none', borderRadius: '4px', cursor: pastedText.trim() ? 'pointer' : 'not-allowed', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >确认并迁移</button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>,
        document.body
    );
}
