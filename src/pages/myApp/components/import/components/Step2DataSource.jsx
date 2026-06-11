import React from 'react';

export default function Step2DataSource() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666' }}>
            <svg viewBox="0 0 24 24" width="48" height="48" stroke="#ccc" strokeWidth="1" fill="none" style={{ marginBottom: '16px' }}>
                <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
            </svg>
            <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>应用数据源配置</div>
            <div style={{ fontSize: '14px', color: '#999' }}>该功能正在开发中，请直接点击下一步</div>
        </div>
    );
}
