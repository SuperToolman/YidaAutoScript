import React from 'react';

export default function Step3Confirm({ selectedApps, appDetails, appFlows, appNavs, expandedAppId, setExpandedAppId, isLoading, migrationData }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#1f2d3d', fontSize: '14px' }}>
                第三步：确认执行
                {migrationData ? (
                    <span style={{ fontWeight: 'normal', color: '#00a854', fontSize: '12px', marginLeft: '8px' }}>(已有生成的迁移数据，可直接查看)</span>
                ) : (
                    <span style={{ fontWeight: 'normal', color: '#999', fontSize: '12px' }}>(即将迁移以下应用及其配置)</span>
                )}
            </h4>
            
            {isLoading ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                    <svg className="animate-spin" viewBox="0 0 24 24" width="24" height="24" stroke="#005fb8" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite', marginBottom: '12px' }}>
                        <line x1="12" y1="2" x2="12" y2="6"></line>
                        <line x1="12" y1="18" x2="12" y2="22"></line>
                        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                        <line x1="2" y1="12" x2="6" y2="12"></line>
                        <line x1="18" y1="12" x2="22" y2="12"></line>
                        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                        <line x1="16.24" y1="4.93" x2="19.07" y2="7.76"></line>
                    </svg>
                    正在统计迁移数据，请稍候...
                </div>
            ) : (
                <div style={{ 
                    flex: 1, 
                    border: '1px solid #ebebeb', 
                    borderRadius: '6px', 
                    overflowY: 'auto',
                    maxHeight: '340px'
                }}>
                    {selectedApps.map((app, index) => {
                        const detail = appDetails[app.appId] || { formCount: 0, fieldCount: 0, automationCount: 0 };
                        const isExpanded = expandedAppId === app.appId;
                        
                        return (
                            <div key={app.appId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                <div 
                                    onClick={() => setExpandedAppId(isExpanded ? null : app.appId)}
                                    style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'space-between', 
                                        padding: '12px 16px', 
                                        cursor: 'pointer',
                                        background: isExpanded ? '#fafafa' : '#fff',
                                        transition: 'background 0.2s'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <span style={{ 
                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                            width: '20px', height: '20px', background: '#005fb8', color: '#fff', 
                                            borderRadius: '50%', marginRight: '12px', fontSize: '12px', fontWeight: 'bold'
                                        }}>
                                            {index + 1}
                                        </span>
                                        <div>
                                            <div style={{ fontWeight: 500, color: '#333', fontSize: '14px' }}>{app.appName || app.appOriginalName}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#666', fontSize: '13px' }}>
                                        <div style={{ display: 'flex', gap: '16px' }}>
                                            <span>表单: <strong style={{ color: '#005fb8' }}>{detail.formCount}</strong></span>
                                            <span>自动化: <strong style={{ color: '#005fb8' }}>{detail.automationCount}</strong></span>
                                        </div>
                                        <svg 
                                            viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" 
                                            style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                                        >
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </div>
                                </div>
                                
                                {isExpanded && (() => {
                                    const flowList = appFlows[app.appId] || [];
                                    const navList = appNavs[app.appId] || [];

                                    const navMap = {};
                                    const rootItems = [];
                                    navList.forEach(n => {
                                        navMap[n.navUuid] = { ...n, children: [] };
                                    });
                                    navList.forEach(n => {
                                        if (n.parentNavUuid && navMap[n.parentNavUuid]) {
                                            navMap[n.parentNavUuid].children.push(navMap[n.navUuid]);
                                        } else if (n.parentNavUuid === 'NAV-SYSTEM-PARENT-UUID' || !navMap[n.parentNavUuid]) {
                                            rootItems.push(navMap[n.navUuid]);
                                        }
                                    });

                                    const renderNavTree = (items, depth = 0) => {
                                        if (!items || !items.length) return null;
                                        return (
                                            <div style={{ paddingLeft: depth > 0 ? '16px' : '0' }}>
                                                {items.map((nav) => {
                                                    const isGroup = nav.navType === 'NAV';
                                                    const isPage = nav.navType === 'PAGE';
                                                    return (
                                                        <div key={nav.navUuid}>
                                                            <div style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                padding: '4px 8px',
                                                                marginBottom: '2px',
                                                                borderRadius: '4px',
                                                                background: isGroup ? '#e6f7ff' : '#fff',
                                                                border: isGroup ? '1px solid #91d5ff' : '1px solid #ebebeb',
                                                                fontSize: '12px'
                                                            }}>
                                                                <span style={{ marginRight: '6px', flexShrink: 0 }}>
                                                                    {isGroup ? '📁' : '📄'}
                                                                </span>
                                                                <span style={{
                                                                    color: '#333',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap',
                                                                    flex: 1,
                                                                    marginRight: '8px'
                                                                }}>
                                                                    {nav.title || '(未命名)'}
                                                                </span>
                                                                {isPage && nav.formUuid && (
                                                                    <span style={{ color: '#999', fontFamily: 'monospace', fontSize: '10px', flexShrink: 0 }}>
                                                                        {nav.formUuid.substring(0, 20)}...
                                                                    </span>
                                                                )}
                                                                {isGroup && (
                                                                    <span style={{ color: '#1890ff', fontSize: '11px', flexShrink: 0 }}>
                                                                        {nav.children.length} 项
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {nav.children.length > 0 && renderNavTree(nav.children, depth + 1)}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    };

                                    return (
                                    <div style={{ padding: '16px', background: '#fafafa', borderTop: '1px dashed #ebebeb' }}>
                                        <div style={{ display: 'flex', gap: '32px', marginBottom: '12px' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '12px', color: '#999', marginBottom: '8px' }}>基础信息</div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#333' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ color: '#666' }}>应用 AppID:</span>
                                                        <span style={{ fontFamily: 'monospace' }}>{app.appId}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ color: '#666' }}>总表单数量:</span>
                                                        <span>{detail.formCount} 个</span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ color: '#666' }}>集成自动化:</span>
                                                        <span>{detail.automationCount} 个</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {navList.length > 0 && (
                                            <div>
                                                <div style={{ fontSize: '12px', color: '#999', marginBottom: '8px', borderTop: '1px solid #ebebeb', paddingTop: '12px' }}>
                                                    表单分组结构 ({navList.filter(n => n.navType === 'NAV').length} 个分组, {navList.filter(n => n.navType === 'PAGE').length} 个表单)
                                                </div>
                                                <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                                                    {renderNavTree(rootItems)}
                                                </div>
                                            </div>
                                        )}

                                        {flowList.length > 0 && (
                                            <div>
                                                <div style={{ fontSize: '12px', color: '#999', marginBottom: '8px', borderTop: '1px solid #ebebeb', paddingTop: '12px' }}>
                                                    集成自动化列表
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', maxHeight: '100px', overflowY: 'auto' }}>
                                                    {flowList.map((flow, fIdx) => {
                                                        const flowName = flow.name?.zh_CN || flow.name || '未命名流程';
                                                        const code = flow.processCode || '';
                                                        return (
                                                            <div key={code || fIdx} style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                padding: '6px 10px',
                                                                background: '#fff',
                                                                borderRadius: '4px',
                                                                border: '1px solid #ebebeb'
                                                            }}>
                                                                <span style={{ color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '8px' }}>
                                                                    {flowName}
                                                                </span>
                                                                <span style={{ color: '#999', fontFamily: 'monospace', fontSize: '11px', flexShrink: 0 }}>
                                                                    {code}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    );
                                })()}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
