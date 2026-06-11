import React from 'react';

export default function Step4CreateNav({ importTasks, navCreationDone = false }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {navCreationDone && (
                <div style={{ padding: '10px 12px', border: '1px solid #b7eb8f', background: '#f6ffed', borderRadius: '6px', color: '#237804', fontSize: '13px' }}>
                    分组创建已完成，可以点击底部“结束”关闭导入向导。
                </div>
            )}
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                根据源应用的导航结构，确认将在目标组织中创建的分组。
            </div>
            {importTasks.map((task, idx) => {
                const navList = task.navStructureData || [];
                if (navList.length === 0) {
                    return (
                        <div key={idx} style={{ border: '1px solid #ebebeb', borderRadius: '6px', padding: '12px 16px', background: '#fff' }}>
                            <div style={{ fontWeight: 500, fontSize: '14px', color: '#333' }}>{task.appName}</div>
                            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>无分组数据</div>
                        </div>
                    );
                }

                const rootGroups = navList.filter(n => !n.parentNavTitle || n.parentNavTitle === '');
                const nestedGroups = navList.filter(n => n.parentNavTitle);

                return (
                    <div key={idx} style={{ border: '1px solid #ebebeb', borderRadius: '6px', padding: '12px 16px', background: '#fff' }}>
                        <div style={{ fontWeight: 500, fontSize: '14px', color: '#333', marginBottom: '8px' }}>
                            {task.appName}
                            <span style={{ fontWeight: 'normal', color: '#999', fontSize: '12px', marginLeft: '8px' }}>
                                {navList.length} 个分组
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', maxHeight: '140px', overflowY: 'auto' }}>
                            {rootGroups.map((nav, nIdx) => (
                                <div key={nIdx} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '4px 8px',
                                    background: '#e6f7ff',
                                    border: '1px solid #91d5ff',
                                    borderRadius: '4px'
                                }}>
                                    <span style={{ marginRight: '6px' }}>📁</span>
                                    <span style={{ color: '#333', flex: 1 }}>{nav.title || '(未命名分组)'}</span>
                                    {nav.relateFormUuid && (
                                        <span style={{ color: '#999', fontFamily: 'monospace', fontSize: '10px', flexShrink: 0 }}>
                                            {String(nav.relateFormUuid).substring(0, 16)}...
                                        </span>
                                    )}
                                </div>
                            ))}
                            {nestedGroups.map((nav, nIdx) => (
                                <div key={'sub-' + nIdx} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '4px 8px',
                                    paddingLeft: '24px',
                                    background: '#f0f7ff',
                                    border: '1px solid #d6e4ff',
                                    borderRadius: '4px'
                                }}>
                                    <span style={{ marginRight: '6px' }}>📁</span>
                                    <span style={{ color: '#333', flex: 1 }}>{nav.title || '(未命名分组)'}</span>
                                    <span style={{ color: '#999', fontSize: '11px', marginRight: '8px' }}>
                                        → {nav.parentNavTitle}
                                    </span>
                                    {nav.relateFormUuid && (
                                        <span style={{ color: '#999', fontFamily: 'monospace', fontSize: '10px', flexShrink: 0 }}>
                                            {String(nav.relateFormUuid).substring(0, 16)}...
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
