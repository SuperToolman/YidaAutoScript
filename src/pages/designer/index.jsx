import React from 'react';
import ToolboxContainer from '../../components/ToolboxContainer';
import OutlinePanel from '../../components/OutlinePanel';
import ConvertPanel from './components/ConvertPanel';
import CrossApiPanel from './components/CrossApiPanel';
import JsApiPanel from './components/JsApiPanel';
import MigrationPanel from './components/MigrationPanel';
import PrintPagePanel from './components/PrintPagePanel';
import AboutPanel from '../../components/AboutPanel';
import DataFillingInjector from './components/DataFillingInjector';

const PageDesignerPage = ({ onClose }) => {
    const tabs = [
        { id: 'outline', label: '字段大纲', component: <OutlinePanel /> },
        { id: 'convert', label: '内容转换', component: <ConvertPanel /> },
        { id: 'page-migration', label: '页面迁移', component: <MigrationPanel /> },
        { id: 'cross-ds', label: '跨应用API', component: <CrossApiPanel /> },
        { id: 'js-api', label: 'JS-API', component: <JsApiPanel /> },
        { id: 'print', label: '打印生成', component: <PrintPagePanel /> },
        { id: 'about', label: '关于脚本', component: <AboutPanel /> }
    ];

    return (
        <>
            <ToolboxContainer tabs={tabs} defaultTab="outline" title="表单设计器工具箱" />
            <DataFillingInjector />
        </>
    );
};

export default PageDesignerPage;