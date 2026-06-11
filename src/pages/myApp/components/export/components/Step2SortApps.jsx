import React from 'react';

export default function Step2SortApps({ selectedApps, moveApp }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#1f2d3d', fontSize: '14px' }}>
                第二步：迁移优先级排序 <span style={{ fontWeight: 'normal', color: '#999', fontSize: '12px' }}>(由上到下，越靠上越优先迁移)</span>
            </h4>
            <div style={{ 
                flex: 1, 
                border: '1px solid #ebebeb', 
                borderRadius: '6px', 
                overflowY: 'auto',
                maxHeight: '340px',
                padding: '8px'
            }}>
                {selectedApps.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#999' }}>未选择任何应用</div>
                ) : (
                    selectedApps.map((app, index) => (
                        <div 
                            key={app.appId} 
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between', 
                                padding: '12px 16px', 
                                background: '#fafafa', 
                                marginBottom: '8px', 
                                borderRadius: '4px', 
                                border: '1px solid #e8e8e8'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ 
                                    display: 'inline-flex', 
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '24px', 
                                    height: '24px', 
                                    background: '#e6f7ff', 
                                    color: '#005fb8', 
                                    borderRadius: '50%', 
                                    marginRight: '12px', 
                                    fontSize: '12px',
                                    fontWeight: 'bold'
                                }}>
                                    {index + 1}
                                </span>
                                <div>
                                    <div style={{ fontWeight: 500, color: '#333', fontSize: '14px' }}>{app.appName || app.appOriginalName}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button 
                                    onClick={() => moveApp(index, 'up')} 
                                    disabled={index === 0} 
                                    style={{ 
                                        padding: '4px 8px', 
                                        cursor: index === 0 ? 'not-allowed' : 'pointer', 
                                        opacity: index === 0 ? 0.4 : 1,
                                        background: '#fff',
                                        border: '1px solid #d9d9d9',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        color: '#333'
                                    }}
                                >
                                    ↑ 上移
                                </button>
                                <button 
                                    onClick={() => moveApp(index, 'down')} 
                                    disabled={index === selectedApps.length - 1} 
                                    style={{ 
                                        padding: '4px 8px', 
                                        cursor: index === selectedApps.length - 1 ? 'not-allowed' : 'pointer', 
                                        opacity: index === selectedApps.length - 1 ? 0.4 : 1,
                                        background: '#fff',
                                        border: '1px solid #d9d9d9',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        color: '#333'
                                    }}
                                >
                                    ↓ 下移
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
