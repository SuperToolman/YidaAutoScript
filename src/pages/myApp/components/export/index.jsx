import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import Utils from '@/services/shared/BrowserUtilsService';
import ProcessService from '../../../../services/ProcessService.js';
import global from '../../../../global.js';
import Step1SelectApps from './components/Step1SelectApps.jsx';
import Step2SortApps from './components/Step2SortApps.jsx';
import Step3Confirm from './components/Step3Confirm.jsx';
import Step4Result from './components/Step4Result.jsx';

export default function MigrationExportModal({ isOpen, onClose }) {
    const [currentStep, setCurrentStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [availableApps, setAvailableApps] = useState([]);
    const [selectedApps, setSelectedApps] = useState([]);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [appDetails, setAppDetails] = useState({});
    const [appFlows, setAppFlows] = useState({});
    const [appNavs, setAppNavs] = useState({});
    const [expandedAppId, setExpandedAppId] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [migrationData, setMigrationData] = useState(null);
    const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0, text: '' });

    useEffect(() => {
        if (isOpen) {
            initModal();
        } else {
            setCurrentStep(1);
            setSearchKeyword('');
            setIsLoading(false);
            setMigrationData(null);
            setGenerationProgress({ current: 0, total: 0, text: '' });
        }
    }, [isOpen]);

    const initModal = async () => {
        setCurrentStep(1);
        setIsLoading(true);
        setSearchKeyword('');
        try {
            let apps = global.info.appStructure;
            if (!apps || apps.length === 0) {
                Utils.toast({ title: '正在拉取应用列表...', type: 'info' });
                apps = await global.services.getFullAppStructure();
            }
            setAvailableApps(apps || []);
        } catch (error) {
            console.error('拉取应用列表失败:', error);
            Utils.toast({ title: '获取应用列表失败', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const toggleAppSelection = (app) => {
        setSelectedApps(prev => {
            const exists = prev.find(a => a.appId === app.appId);
            if (exists) {
                return prev.filter(a => a.appId !== app.appId);
            }
            return [...prev, app];
        });
    };

    const moveApp = (index, direction) => {
        const newApps = [...selectedApps];
        if (direction === 'up' && index > 0) {
            [newApps[index - 1], newApps[index]] = [newApps[index], newApps[index - 1]];
        } else if (direction === 'down' && index < newApps.length - 1) {
            [newApps[index + 1], newApps[index]] = [newApps[index], newApps[index + 1]];
        }
        setSelectedApps(newApps);
    };

    const calculateAppDetails = async () => {
        setIsLoading(true);
        const details = { ...appDetails };
        const flows = { ...appFlows };
        const navs = { ...appNavs };
        
        try {
            for (const app of selectedApps) {
                const targetAppId = app.appId || app.appType;
                if (details[targetAppId]) continue;

                let formCount = 0;
                let fieldCount = 0;
                const forms = app.forms || app.formList || app.children || app.items || app.pages || [];
                formCount = forms.length;

                forms.forEach(form => {
                    const fields = Array.isArray(form.fields) ? form.fields : (Array.isArray(form.fieldList) ? form.fieldList : []);
                    const countFields = (fList) => {
                        let count = 0;
                        fList.forEach(f => {
                            if (f.componentName || f.type || f.fieldType) count++;
                            const subLists = [
                                f.children, f.components, f.fields, f.fieldList,
                                f.columns, f.props?.columns, f.props?.components,
                                f.props?.fields, f.props?.fieldList, f.props?.children, f.props?.items
                            ];
                            subLists.forEach(sub => {
                                if (Array.isArray(sub)) count += countFields(sub);
                            });
                        });
                        return count;
                    };
                    fieldCount += countFields(fields);
                });

                let appFlowList = [];
                try {
                    appFlowList = await ProcessService.getAllFlows(targetAppId);
                } catch (e) {
                    console.warn(`获取应用 ${targetAppId} 集成自动化列表失败`, e);
                }
                flows[targetAppId] = appFlowList;

                let appNavList = [];
                try {
                    appNavList = await global.services.fetchAllForms(targetAppId, { includeNav: true });
                } catch (e) {
                    console.warn(`获取应用 ${targetAppId} 导航数据失败`, e);
                }
                navs[targetAppId] = appNavList;

                details[targetAppId] = { formCount, fieldCount, automationCount: appFlowList.length };
            }
            setAppDetails(details);
            setAppFlows(flows);
            setAppNavs(navs);
        } catch (error) {
            console.error('获取应用详情失败:', error);
            Utils.toast({ title: '获取应用详情时发生部分错误', type: 'warn' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoToStep3 = async () => {
        setCurrentStep(3);
        await calculateAppDetails();
    };

    const handleConfirmMigration = async () => {
        setIsGenerating(true);
        setCurrentStep(4);
        setMigrationData(null);
        
        try {
            const finalMigrationData = [];
            
            for (let i = 0; i < selectedApps.length; i++) {
                const app = selectedApps[i];
                const targetAppId = app.appId || app.appType;
                const forms = app.forms || app.formList || app.children || app.items || app.pages || [];
                
                const appData = {
                    appId: targetAppId,
                    appName: app.appName || app.appOriginalName,
                    forms: [],
                    logicFlow: [],
                    navStructure: [],
                    navIds: { ids: [], idsStr: '' }
                };

                const navList = appNavs[targetAppId] || [];
                const navMapByFormUuid = {};
                const navTitleByUuid = {};
                navList.forEach(n => {
                    navTitleByUuid[n.navUuid] = n.title || '';
                    if (n.formUuid) {
                        navMapByFormUuid[n.formUuid] = n;
                    }
                });
                
                for (let j = 0; j < forms.length; j++) {
                    const form = forms[j];
                    const formUuid = form.formUuid || form.id || form.formId;
                    if (!formUuid) continue;
                    
                    const formName = form.formName || form.i18nTitle?.zh_CN || (form.name && form.name.zh_CN) || form.name || (form.title && form.title.zh_CN) || form.title || '未命名表单';
                    setGenerationProgress({
                        current: j + 1,
                        total: forms.length,
                        text: `正在获取 [${appData.appName}] 的表单: ${formName}`
                    });
                    
                    try {
                        const schema = await global.services.getFormSchema(formUuid, targetAppId);
                        if (schema) {
                            const schemaObj = typeof schema === 'string' ? JSON.parse(schema) : schema;
                            schemaObj._copyFormName = formName;
                            schemaObj._copyFormType = form.formType || form.type || 'receipt';
                            const navItem = navMapByFormUuid[formUuid];
                            if (navItem) {
                                schemaObj._navId = navItem.id;
                                schemaObj._parentNavTitle = navTitleByUuid[navItem.parentNavUuid] || '';
                                schemaObj._navType = navItem.navType;
                                schemaObj._formType = navItem.formType || form.formType || '';
                            }
                            appData.forms.push(schemaObj);
                        }
                    } catch (err) {
                        console.error(`获取表单 ${formUuid} Schema失败:`, err);
                    }
                }

                const navGroups = navList
                    .filter(n => n.navType === 'NAV')
                    .map(n => ({
                        id: n.id,
                        navUuid: n.navUuid,
                        parentNavUuid: n.parentNavUuid,
                        parentNavTitle: navTitleByUuid[n.parentNavUuid] || '',
                        navType: n.navType,
                        title: n.title,
                        formUuid: n.formUuid,
                        relateFormUuid: n.relateFormUuid,
                        formType: n.formType,
                        listOrder: n.listOrder
                    }));
                const allNavIds = navList.map(n => n.id).filter(Boolean);

                appData.navStructure = navGroups;
                appData.navIds = { ids: allNavIds, idsStr: allNavIds.join(',') };

                const flowList = appFlows[targetAppId] || [];
                if (flowList.length > 0) {
                    setGenerationProgress({
                        current: 0,
                        total: flowList.length,
                        text: `正在导出 [${appData.appName}] 集成自动化 0/${flowList.length}`
                    });
                    try {
                        const processCodes = flowList.map(f => f.processCode).filter(Boolean);
                        const flowExportRes = await ProcessService.exportBatchPayload({
                            appId: targetAppId,
                            processCodes,
                            onProgress: (p) => {
                                setGenerationProgress({
                                    current: p.current,
                                    total: p.total,
                                    text: `正在导出 [${appData.appName}] 集成自动化 ${p.current}/${p.total}`
                                });
                            }
                        });
                        if (flowExportRes && flowExportRes.data) {
                            appData.logicFlow = flowExportRes.data;
                        }
                    } catch (err) {
                        console.error(`导出应用 ${targetAppId} 集成自动化失败:`, err);
                        Utils.toast({ title: `[${appData.appName}] 集成自动化导出失败: ${err.message}`, type: 'error' });
                    }
                }
                
                finalMigrationData.push(appData);
            }
            
            setMigrationData(JSON.stringify(finalMigrationData, null, 2));
            Utils.toast({ title: '迁移数据生成成功！', type: 'success' });
        } catch (error) {
            console.error('生成迁移数据失败:', error);
            Utils.toast({ title: '生成迁移数据失败: ' + error.message, type: 'error' });
        } finally {
            setIsGenerating(false);
        }
    };

    const steps = [
        { label: '选择应用' },
        { label: '迁移准备' },
        { label: '确认执行' },
        { label: '迁移数据' }
    ];

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 99999, 
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                background: '#fff', width: '680px', borderRadius: '8px', 
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column',
                overflow: 'hidden'
            }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #ebebeb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#1f2d3d', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="#005fb8" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 12h4l2-2 4 4 4-4h6"></path>
                        </svg>
                        应用迁移向导
                    </h3>
                    {!isGenerating && <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#999', padding: 0, lineHeight: 1 }}>×</button>}
                </div>
                
                <div style={{ display: 'flex', padding: '16px 24px', borderBottom: '1px solid #ebebeb' }}>
                    {steps.map((step, idx) => (
                        <div key={idx} style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ fontWeight: currentStep >= idx + 1 ? 600 : 400, color: currentStep >= idx + 1 ? '#005fb8' : '#999', fontSize: '14px' }}>
                                <span style={{ display: 'inline-block', width: '20px', height: '20px', lineHeight: '20px', borderRadius: '50%', background: currentStep >= idx + 1 ? '#005fb8' : '#eee', color: currentStep >= idx + 1 ? '#fff' : '#999', marginRight: '6px', fontSize: '12px' }}>{idx + 1}</span>
                                {step.label}
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ padding: '24px', height: '400px', backgroundColor: '#fff' }}>
                    {currentStep === 1 && <Step1SelectApps availableApps={availableApps} selectedApps={selectedApps} searchKeyword={searchKeyword} setSearchKeyword={setSearchKeyword} toggleAppSelection={toggleAppSelection} isLoading={isLoading} />}
                    {currentStep === 2 && <Step2SortApps selectedApps={selectedApps} moveApp={moveApp} />}
                    {currentStep === 3 && <Step3Confirm selectedApps={selectedApps} appDetails={appDetails} appFlows={appFlows} appNavs={appNavs} expandedAppId={expandedAppId} setExpandedAppId={setExpandedAppId} isLoading={isLoading} migrationData={migrationData} />}
                    {currentStep === 4 && <Step4Result migrationData={migrationData} isGenerating={isGenerating} generationProgress={generationProgress} />}
                </div>

                <div style={{ padding: '16px 24px', borderTop: '1px solid #ebebeb', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#fafafa' }}>
                    {!isGenerating && (
                        <button onClick={onClose} style={{ padding: '8px 20px', background: '#fff', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', color: '#333' }}>取消</button>
                    )}
                    
                    {currentStep > 1 && !isGenerating && (
                        <button onClick={() => setCurrentStep(s => s - 1)} style={{ padding: '8px 20px', background: '#fff', border: '1px solid #005fb8', color: '#005fb8', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>上一步</button>
                    )}
                    
                    {currentStep === 1 && (
                        <button onClick={() => { 
                            if (selectedApps.length === 0) {
                                Utils.toast({ title: '请至少选择一个需要迁移的应用', type: 'warn' });
                            } else {
                                setCurrentStep(2);
                            }
                        }} style={{ padding: '8px 20px', background: '#005fb8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>下一步</button>
                    )}
                    
                    {currentStep === 2 && (
                        <button onClick={handleGoToStep3} style={{ padding: '8px 20px', background: '#005fb8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>下一步</button>
                    )}
                    
                    {currentStep === 3 && migrationData == null && (
                        <button onClick={handleConfirmMigration} disabled={isGenerating} style={{ padding: '8px 20px', background: isGenerating ? '#999' : '#00a854', color: '#fff', border: 'none', borderRadius: '4px', cursor: isGenerating ? 'not-allowed' : 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            {isGenerating ? '生成中...' : '确认迁移'}
                        </button>
                    )}
                    
                    {currentStep === 3 && migrationData != null && (
                        <button onClick={() => setCurrentStep(4)} style={{ padding: '8px 20px', background: '#00a854', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            查看已有数据
                        </button>
                    )}
                    
                    {currentStep === 4 && (
                        <button onClick={onClose} style={{ padding: '8px 20px', background: '#005fb8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>完成</button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
