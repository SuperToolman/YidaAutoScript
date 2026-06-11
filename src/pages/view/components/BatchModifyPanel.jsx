import React, { useState } from 'react';
import BatchModifyFields from './BatchModifyFields';
import BatchModifyForms from './BatchModifyForms';
import BatchModifyFormJs from './BatchModifyFormJs';

/**
 * 批量修改面板
 */
const BatchModifyPanel = () => {
    const [activeSubTab, setActiveSubTab] = useState('fields');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
            {/* 顶部分类 Tab */}
            <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', padding: '0 16px', flexShrink: 0 }}>
                <div 
                    style={{ 
                        cursor: 'pointer', 
                        padding: '12px 16px',
                        color: activeSubTab === 'fields' ? '#1890ff' : '#666', 
                        fontWeight: activeSubTab === 'fields' ? 600 : 400,
                        borderBottom: activeSubTab === 'fields' ? '2px solid #1890ff' : '2px solid transparent',
                        transition: 'all 0.2s',
                        fontSize: '13px'
                    }}
                    onClick={() => setActiveSubTab('fields')}
                >
                    批量修改字段
                </div>
                <div 
                    style={{ 
                        cursor: 'pointer', 
                        padding: '12px 16px',
                        color: activeSubTab === 'forms' ? '#1890ff' : '#666', 
                        fontWeight: activeSubTab === 'forms' ? 600 : 400,
                        borderBottom: activeSubTab === 'forms' ? '2px solid #1890ff' : '2px solid transparent',
                        transition: 'all 0.2s',
                        fontSize: '13px'
                    }}
                    onClick={() => setActiveSubTab('forms')}
                >
                    批量修改表单
                </div>
                <div 
                    style={{ 
                        cursor: 'pointer', 
                        padding: '12px 16px',
                        color: activeSubTab === 'js' ? '#1890ff' : '#666', 
                        fontWeight: activeSubTab === 'js' ? 600 : 400,
                        borderBottom: activeSubTab === 'js' ? '2px solid #1890ff' : '2px solid transparent',
                        transition: 'all 0.2s',
                        fontSize: '13px'
                    }}
                    onClick={() => setActiveSubTab('js')}
                >
                    批量修改表单JS
                </div>
            </div>
            
            {/* 内容区 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                {activeSubTab === 'fields' && <BatchModifyFields />}
                {activeSubTab === 'forms' && <BatchModifyForms />}
                {activeSubTab === 'js' && <BatchModifyFormJs />}
            </div>
        </div>
    );
};

export default BatchModifyPanel;
