import React from 'react';
import { createPortal } from 'react-dom';
import ToolboxContainer from '../../components/ToolboxContainer';
import OutlinePanel from '../../components/OutlinePanel';
import AboutPanel from '../../components/AboutPanel';
import FillPanel from './components/FillPanel';
import { useExternalDom } from '../../hooks/useExternalDom';

const NewDesignerPage = () => {
    // 集成自动化不仅有独立的规则填充面板（嵌入式），还有全局外部工具箱
    const targetPane = useExternalDom('.simple-flow-settings-primary-pane');

    const tabs = [
        { id: 'outline', label: '字段大纲', component: <OutlinePanel /> },
        { id: 'about', label: '关于脚本', component: <AboutPanel /> }
    ];

    return (
        <>
            {/* 1. 挂载悬浮工具箱 (包含外部非节点工具) */}
            <ToolboxContainer tabs={tabs} defaultTab="outline" title="集成自动化工具箱" />
            
            {/* 2. 挂载嵌入式面板 (规则填充)，仅当找到目标容器时挂载 */}
            {targetPane && createPortal(
                <div className="st-newdesigner-panel" style={{ width: '100%', background: '#fff', borderTop: '1px solid #e8e8e8', borderBottom: '1px solid #e8e8e8', padding: '16px', margin: '16px 0', boxSizing: 'border-box' }}>
                    {/* <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: '#333' }}>自动化规则快捷填充</h3> */}
                    <FillPanel />
                </div>,
                targetPane
            )}
        </>
    );
};

export default NewDesignerPage;