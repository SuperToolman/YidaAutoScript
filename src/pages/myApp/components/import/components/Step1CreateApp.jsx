import React from 'react';

export default function Step1CreateApp({ importTasks}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '13px', color: '#666' }}>
                    在目标组织中创建对应的应用，或直接跳到下一步，迁移时系统会自动创建。
                </div>

            </div>
            {importTasks.map((task, idx) => {
                const hasAppId = !!task.targetAppId;
                return (
                    <div key={idx} style={{ border: '1px solid #ebebeb', borderRadius: '6px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: hasAppId ? '#f6ffed' : '#fff' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ fontWeight: 500, fontSize: '14px', color: '#333' }}>
                                {task.appName}
                            </div>
                            {hasAppId ? (
                                <div style={{ fontSize: '12px', color: '#00a854', fontFamily: 'monospace' }}>
                                    已创建: {task.targetAppId}
                                </div>
                            ) : (
                                <div style={{ fontSize: '12px', color: '#999' }}>
                                    源 AppId: {task.appId}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
