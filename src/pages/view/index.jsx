import React from 'react';
import CopyActionGroup from './components/CopyActionGroup';
import ToolboxContainer from '../../components/ToolboxContainer';
import OutlinePanel from '../../components/OutlinePanel';
import PrintPagePanel from '../designer/components/PrintPagePanel';
// import MigrationPanel from '../designer/components/MigrationPanel';
import BatchModifyPanel from './components/BatchModifyPanel';
import AboutPanel from '../../components/AboutPanel';

const ViewPage = () => {
    const tabs = [
        { id: 'outline', label: '字段大纲', component: <OutlinePanel /> },
        { id: 'batch-modify', label: '批量修改', component: <BatchModifyPanel /> },
        // { id: 'page-migration', label: '页面迁移', component: <MigrationPanel /> },
        { id: 'print', label: '打印生成', component: <PrintPagePanel /> },
        { id: 'about', label: '关于脚本', component: <AboutPanel /> }
    ];

    return (
        <>
            <CopyActionGroup />
            <ToolboxContainer
                tabs={tabs}
                defaultTab="outline"
                title="数据管理页工具箱"
                targetSelector=".BasicPane--Bar--bv5Fiix"
                insertPosition="append"
                renderTrigger={({ togglePanel }) => (
                    <button
                        onClick={togglePanel}
                        style={{ backgroundColor: '#c562ffff', border: 'none', fontSize: 14, color: '#fff', height: 32, lineHeight: '32px', marginLeft: 10, borderRadius: 4, padding: '0 8px', cursor: 'pointer' }}
                    >
                        👾
                    </button>
                )}
            />
        </>
    );
};

export default ViewPage;