import React, { useState } from 'react';

const SidebarLayout = ({ tabs, defaultTab, onClose, title = "宜搭脚本工具箱" }) => {
    const [activeTab, setActiveTab] = useState(defaultTab || (tabs.length > 0 ? tabs[0].id : ''));

    return (
        <div className="st-designer-panel" style={{ display: 'flex', width: '700px', height: '80vh', flexDirection: 'column' }}>
            <div className="st-header">
                <div className="st-title">{title}</div>
                <div className="st-controls">
                    <div className="st-icon-btn" title="关闭" onClick={onClose}>×</div>
                </div>
            </div>
            
            <div className="st-sidebar-layout" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <div className="st-sidebar">
                    {tabs.map(item => (
                        <div
                            key={item.id}
                            className={`st-sidebar-item ${activeTab === item.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(item.id)}
                        >
                            {item.label}
                        </div>
                    ))}
                </div>
                <div className="st-sidebar-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {tabs.map(item => (
                        <div 
                            key={item.id} 
                            style={{ 
                                display: activeTab === item.id ? 'flex' : 'none', 
                                flexDirection: 'column', 
                                height: '100%', 
                                overflow: 'hidden' 
                            }}
                        >
                            {item.component || (
                                <div style={{ padding: '20px', textAlign: 'center', color: '#999', margin: 'auto' }}>
                                    <h3>{item.label}</h3>
                                    <p>内容加载中...</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SidebarLayout;