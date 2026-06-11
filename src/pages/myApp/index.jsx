import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import Utils from '@/services/shared/BrowserUtilsService';
import MigrationExportModal from './components/export/index.jsx';
import ImportConfirmDialog from './components/import/components/ImportConfirmDialog.jsx';
import ImportWizardDialog from './components/import/index.jsx';
import DependenceFix from './components/dependence_fix/index.jsx';

const MyAppPage = () => {
    const [targetContainer, setTargetContainer] = useState(null);

    // 弹窗状态
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
    const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);
    
    // 导入任务数据
    const [importTasks, setImportTasks] = useState([]);

    useEffect(() => {
        Utils.log('[宜搭脚本] 进入我的应用(myApp)页面', 'info');

        // 轮询等待目标容器出现
        const checkContainer = setInterval(() => {
            const buttonListContainer = document.querySelector('.TopContainer--ButtonList--o3P9IiQ');
            
            if (buttonListContainer) {
                clearInterval(checkContainer);
                Utils.log('[宜搭脚本] 找到 TopContainer--ButtonList--o3P9IiQ 容器，准备插入按钮', 'info');
                
                // 防止重复挂载，使用 React Portal 将按钮渲染进去
                setTargetContainer(buttonListContainer);
            }
        }, 500);

        // 设置一个超时，避免无限轮询
        const timeout = setTimeout(() => {
            clearInterval(checkContainer);
        }, 15000);

        return () => {
            clearInterval(checkContainer);
            clearTimeout(timeout);
        };
    }, []);

    // 如果目标容器未出现，则不渲染任何东西
    if (!targetContainer) return null;

    const handleConfirmImport = (tasks) => {
        setIsImportConfirmOpen(false);
        setImportTasks(tasks);
        setIsImportWizardOpen(true);
    };

    return (
        <>
            {ReactDOM.createPortal(
                <div style={{ display: 'inline-flex', marginRight: '12px', verticalAlign: 'middle' }}>
                    <button
                        className="st-btn"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 16px', backgroundColor: '#005fb8', color: '#ffffff', border: 'none', borderRadius: '4px', fontSize: '14px', cursor: 'pointer', transition: 'background-color 0.15s' }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#004c94'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#005fb8'}
                        onClick={() => setIsExportModalOpen(true)}
                    >
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 12h4l2-2 4 4 4-4h6"></path>
                        </svg>
                        应用迁移
                    </button>
                    
                    <button
                        className="st-btn"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 16px', backgroundColor: '#00a854', color: '#ffffff', border: 'none', borderRadius: '4px', fontSize: '14px', cursor: 'pointer', transition: 'background-color 0.15s', marginLeft: '8px' }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#008a44'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#00a854'}
                        onClick={() => setIsImportConfirmOpen(true)}
                    >
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        开始迁移
                    </button>

                    <DependenceFix />
                </div>,
                targetContainer
            )}
            
            <MigrationExportModal 
                isOpen={isExportModalOpen} 
                onClose={() => setIsExportModalOpen(false)} 
            />
            
            <ImportConfirmDialog 
                isOpen={isImportConfirmOpen} 
                onClose={() => setIsImportConfirmOpen(false)} 
                onConfirm={handleConfirmImport}
            />
            
            <ImportWizardDialog 
                isOpen={isImportWizardOpen} 
                onClose={() => setIsImportWizardOpen(false)} 
                initialTasks={importTasks}
            />
        </>
    );
};

export default MyAppPage;