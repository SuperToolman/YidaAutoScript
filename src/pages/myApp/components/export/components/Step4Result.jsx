import React from 'react';
import Utils from '@/services/shared/BrowserUtilsService';

export default function Step4Result({ migrationData, isGenerating, generationProgress }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#1f2d3d', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                第四步：迁移数据展示
            </h4>

            {isGenerating ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#666', border: '1px solid #ebebeb', borderRadius: '6px' }}>
                    <svg className="animate-spin" viewBox="0 0 24 24" width="32" height="32" stroke="#005fb8" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite', marginBottom: '16px' }}>
                        <line x1="12" y1="2" x2="12" y2="6"></line>
                        <line x1="12" y1="18" x2="12" y2="22"></line>
                        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                        <line x1="2" y1="12" x2="6" y2="12"></line>
                        <line x1="18" y1="12" x2="22" y2="12"></line>
                        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                        <line x1="16.24" y1="4.93" x2="19.07" y2="7.76"></line>
                    </svg>
                    <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>正在生成迁移数据...</div>
                    <div style={{ fontSize: '12px', color: '#999' }}>{generationProgress.text}</div>
                    <div style={{ width: '200px', height: '4px', background: '#eee', borderRadius: '2px', marginTop: '16px', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%',
                            background: '#005fb8',
                            width: `${generationProgress.total > 0 ? (generationProgress.current / generationProgress.total) * 100 : 0}%`,
                            transition: 'width 0.2s'
                        }}></div>
                    </div>
                </div>
            ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid #ebebeb', borderRadius: '6px', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00a854' }}>
                        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        <span style={{ fontSize: '16px', fontWeight: 500 }}>迁移数据已生成完毕</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={async () => {
                                try {
                                    const copied = await Utils.setClipboard(migrationData);
                                    if (copied) {
                                        Utils.toast({ title: '已复制到剪贴板', type: 'success' });
                                    } else {
                                        await navigator.clipboard.writeText(migrationData);
                                        Utils.toast({ title: '已复制到剪贴板', type: 'success' });
                                    }
                                } catch {
                                    Utils.toast({ title: '复制失败，请手动选择复制', type: 'error' });
                                }
                            }}
                            style={{ padding: '10px 32px', background: '#00a854', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            复制迁移JSON
                        </button>
                        <button
                            onClick={() => {
                                try {
                                    const now = new Date();
                                    const pad = (n) => String(n).padStart(2, '0');
                                    const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
                                    const blob = new Blob([migrationData], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `migration_data_${ts}.json`;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                    Utils.toast({ title: 'JSON 文件已导出', type: 'success' });
                                } catch {
                                    Utils.toast({ title: '导出失败', type: 'error' });
                                }
                            }}
                            style={{ padding: '10px 32px', background: '#005fb8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            导出JSON文件
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
