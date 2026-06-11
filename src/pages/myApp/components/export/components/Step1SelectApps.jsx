import React from 'react';

export default function Step1SelectApps({ availableApps, selectedApps, searchKeyword, setSearchKeyword, toggleAppSelection, isLoading }) {
    const filteredApps = availableApps.filter(app => {
        const keyword = searchKeyword.toLowerCase();
        const name = (app.appName || app.appOriginalName || '').toLowerCase();
        const id = (app.appId || app.appType || '').toLowerCase();
        return name.includes(keyword) || id.includes(keyword);
    });

    const isAllFilteredSelected = filteredApps.length > 0 && filteredApps.every(app => selectedApps.some(sa => sa.appId === app.appId));

    const handleSelectAll = () => {
        if (isAllFilteredSelected) {
            const filteredAppIds = filteredApps.map(a => a.appId);
            selectedApps.forEach(a => {
                if (filteredAppIds.includes(a.appId)) toggleAppSelection(a);
            });
        } else {
            filteredApps.forEach(fa => {
                if (!selectedApps.some(sa => sa.appId === fa.appId)) {
                    toggleAppSelection(fa);
                }
            });
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, color: '#1f2d3d', fontSize: '14px' }}>第一步：选择需要迁移的应用 (已选 {selectedApps.length})</h4>
                <input
                    type="text"
                    placeholder="搜索应用名称或 AppID"
                    value={searchKeyword}
                    onChange={e => setSearchKeyword(e.target.value)}
                    style={{ padding: '6px 10px', fontSize: '12px', border: '1px solid #d9d9d9', borderRadius: '4px', width: '220px', outline: 'none' }}
                />
            </div>

            {isLoading ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', border: '1px solid #ebebeb', borderRadius: '6px' }}>
                    正在加载应用列表...
                </div>
            ) : (
                <>
                    {availableApps.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', background: '#f5f5f5', border: '1px solid #ebebeb', borderBottom: 'none', borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '13px', color: '#333' }}>
                                <input 
                                    type="checkbox" 
                                    checked={isAllFilteredSelected} 
                                    onChange={handleSelectAll}
                                    style={{ marginRight: '8px', accentColor: '#005fb8', cursor: 'pointer' }}
                                />
                                全选 ({filteredApps.length})
                            </label>
                        </div>
                    )}
                    <div style={{ 
                        flex: 1, 
                        border: '1px solid #ebebeb', 
                        borderTopLeftRadius: availableApps.length > 0 ? '0' : '6px',
                        borderTopRightRadius: availableApps.length > 0 ? '0' : '6px',
                        borderBottomLeftRadius: '6px',
                        borderBottomRightRadius: '6px',
                        overflowY: 'auto',
                        maxHeight: '320px'
                    }}>
                        {filteredApps.length === 0 ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: '#999', fontSize: '13px' }}>没有匹配的应用数据</div>
                        ) : (
                            filteredApps.map((app) => {
                                const isSelected = selectedApps.some(a => a.appId === app.appId);
                                return (
                                    <div 
                                        key={app.appId} 
                                        onClick={() => toggleAppSelection(app)}
                                        style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            padding: '8px 12px', 
                                            borderBottom: '1px solid #f0f0f0',
                                            cursor: 'pointer',
                                            background: isSelected ? '#f0f7ff' : '#fff',
                                            transition: 'background 0.2s'
                                        }}
                                    >
                                        <input 
                                            type="checkbox" 
                                            checked={isSelected} 
                                            readOnly
                                            style={{ marginRight: '12px', accentColor: '#005fb8', transform: 'scale(1.1)', cursor: 'pointer' }}
                                        />
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <div style={{ fontWeight: 500, color: '#333', fontSize: '13px', marginBottom: '2px' }}>
                                                {app.appName || app.appOriginalName || '未知应用'}
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#999' }}>
                                                {app.appId || app.appType}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
