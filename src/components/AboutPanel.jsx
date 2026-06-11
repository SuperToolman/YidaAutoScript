/**
 * 关于面板组件
 * 显示脚本的版本信息、作者、描述等依赖信息。
 */



import React, { useState } from 'react';

const AboutPanel = () => {
    const [isChecking, setIsChecking] = useState(false);

    // 优先尝试从作用域直接读取 GM_info (Tampermonkey 沙盒环境)，如果不行再尝试 window.GM_info
    const info = typeof GM_info !== 'undefined' ? GM_info : window.GM_info;
    
    const scriptName = info?.script?.name || '宜搭脚本工具箱Re';
    // 因为 Vite 打包时注入的 GM_info 版本可能是自动生成的，这里如果读取不到则使用构建配置里的默认版本
    const scriptVersion = info?.script?.version || '202605120';
    const scriptAuthor = info?.script?.author || 'LandeMeng';
    const scriptDesc = info?.script?.description || '宜搭自动化辅助工具，支持规则填充、表单转换、打印样式调整等功能。';

    const dependencies = [
        { name: 'React', version: '18.x' },
        { name: 'ReactDOM', version: '18.x' },
        { name: 'Monaco Editor', version: '0.36.1' }
    ];

    const handleCheckUpdate = () => {
        setIsChecking(true);
        // 通过打开 Greasy Fork 的脚本页面，让用户直接查看或更新
        window.open('https://greasyfork.org/zh-CN/scripts/570376-宜搭脚本工具箱re', '_blank');
        setTimeout(() => setIsChecking(false), 1000);
    };

    return (
        <div style={{ padding: '32px 24px', textAlign: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', background: '#fff', borderRadius: '8px' }}>
            {/* Logo / Icon */}
            <div 
                style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}
                dangerouslySetInnerHTML={{
                    __html: `<svg viewBox="0 0 1024 1024" width="64" height="64"><path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z" fill="#1890ff"/><path d="M512 140c-205.4 0-372 166.6-372 372s166.6 372 372 372 372-166.6 372-372-166.6-372-372-372zm0 668c-163.6 0-296-132.4-296-296s132.4-296 296-296 296 132.4 296 296-132.4 296-296 296z" fill="#e6f7ff" opacity="0.3"/><path d="M512 232c-154.6 0-280 125.4-280 280s125.4 280 280 280 280-125.4 280-280-125.4-280-280-280zm0 484c-112.8 0-204-91.2-204-204s91.2-204 204-204 204 91.2 204 204-91.2 204-204 204z" fill="#1890ff"/></svg>`
                }}
            />

            <h2 style={{ fontSize: '20px', color: '#1f2d3d', margin: '0 0 8px 0', fontWeight: 600 }}>
                {scriptName}
            </h2>
            <p style={{ fontSize: '14px', color: '#666', margin: '0 0 24px 0' }}>
                当前版本: v{scriptVersion}
            </p>

            {/* 检查更新按钮 */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
                <button
                    className="st-btn"
                    onClick={handleCheckUpdate}
                    disabled={isChecking}
                    style={{
                        background: '#005fb8',
                        border: 'none',
                        color: '#fff',
                        padding: '8px 24px',
                        borderRadius: '4px',
                        cursor: isChecking ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: 500,
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        opacity: isChecking ? 0.7 : 1
                    }}
                    onMouseOver={(e) => {
                        if (!isChecking) e.target.style.background = '#004c94';
                    }}
                    onMouseOut={(e) => {
                        if (!isChecking) e.target.style.background = '#005fb8';
                    }}
                >
                    {isChecking ? (
                        <>
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                                <line x1="12" y1="2" x2="12" y2="6"></line>
                                <line x1="12" y1="18" x2="12" y2="22"></line>
                                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                                <line x1="2" y1="12" x2="6" y2="12"></line>
                                <line x1="18" y1="12" x2="22" y2="12"></line>
                                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                                <line x1="16.24" y1="4.93" x2="19.07" y2="7.76"></line>
                            </svg>
                            检查中...
                        </>
                    ) : (
                        <>
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21.5 2v6h-6M2.13 15.57a10 10 0 1 0 3.43-8.81L2.5 10"></path>
                            </svg>
                            检查更新
                        </>
                    )}
                </button>
            </div>

            <div style={{ marginBottom: '32px', textAlign: 'left', background: '#f9f9f9', padding: '12px', borderRadius: '6px', border: '1px solid #eee' }}>
                <div style={{ fontSize: '12px', color: '#999', marginBottom: '8px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    运行时依赖关系
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {dependencies.map((dep, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                            <span style={{ color: '#333' }}>{dep.name}</span>
                            <span style={{ color: '#666', fontFamily: 'monospace' }}>{dep.version}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ fontSize: '12px', color: '#bfbfbf', paddingTop: '16px', borderTop: '1px solid #f0f0f0' }}>
                © {new Date().getFullYear()} All Rights Reserved.
            </div>

            <style>{`
                @keyframes spin {
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default AboutPanel;