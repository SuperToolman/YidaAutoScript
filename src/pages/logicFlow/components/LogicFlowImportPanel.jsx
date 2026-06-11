import React, { useMemo, useState } from 'react';
import ProcessService from '../../../services/ProcessService';
import Utils from '@/services/shared/BrowserUtilsService';

const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'rgba(0,0,0,0.35)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

const panelStyle = {
    width: '760px',
    maxWidth: '92vw',
    maxHeight: '80vh',
    background: '#fff',
    borderRadius: '8px',
    padding: '16px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
};

const progressBarWrapStyle = {
    flex: 1,
    height: '8px',
    background: '#f0f0f0',
    borderRadius: '999px',
    overflow: 'hidden'
};

const firstText = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.zh_CN || value.en_US || value.label || value.name || '';
};

const getFlowDisplayName = (flow, fallback = '') => {
    if (!flow || typeof flow !== 'object') return fallback;
    return firstText(flow.title || flow.name) || flow.__customProcessName || flow.processCode || fallback;
};

const buildImportResultItem = (item, index, status, extra = {}) => ({
    index,
    status,
    flowName: getFlowDisplayName(item, `未命名流程${index + 1}`),
    sourceProcessCode: item?.processCode || item?.props?.processCode || '',
    processCode: extra.processCode || '',
    message: extra.message || '',
    raw: extra.raw || null
});

const StatusTag = ({ status }) => {
    const config = {
        idle: { text: '待开始', color: '#8c8c8c', bg: '#fafafa' },
        running: { text: '执行中', color: '#722ed1', bg: '#f9f0ff' },
        success: { text: '成功', color: '#389e0d', bg: '#f6ffed' },
        error: { text: '失败', color: '#cf1322', bg: '#fff1f0' }
    }[status] || { text: status || '未知', color: '#8c8c8c', bg: '#fafafa' };

    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '52px',
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '11px',
                color: config.color,
                background: config.bg
            }}
        >
            {config.text}
        </span>
    );
};

const LogicFlowImportPanel = () => {
    const [importDialogVisible, setImportDialogVisible] = useState(false);
    const [exportDialogVisible, setExportDialogVisible] = useState(false);
    const [importing, setImporting] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [flowsLoading, setFlowsLoading] = useState(false);
    const [flows, setFlows] = useState([]);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [selectedCodes, setSelectedCodes] = useState([]);
    const [importProgress, setImportProgress] = useState(null);
    const [exportProgress, setExportProgress] = useState(null);
    const [importSummary, setImportSummary] = useState(null);
    const [importResults, setImportResults] = useState([]);
    const [importError, setImportError] = useState('');

    const loading = importing || exporting;

    const filteredFlows = useMemo(() => {
        const key = (searchKeyword || '').trim().toLowerCase();
        if (!key) return flows;
        return flows.filter((flow) => {
            const name = String(getFlowDisplayName(flow, '')).toLowerCase();
            const processCode = String(flow && flow.processCode ? flow.processCode : '').toLowerCase();
            const formName = String(flow && flow.formName ? flow.formName : '').toLowerCase();
            return name.includes(key) || processCode.includes(key) || formName.includes(key);
        });
    }, [flows, searchKeyword]);

    const loadFlows = async () => {
        setFlowsLoading(true);
        try {
            const allFlows = await ProcessService.getAllFlows();
            setFlows(allFlows || []);
        } catch (err) {
            console.error('获取流程列表异常:', err);
            Utils.toast({ title: `获取流程列表失败: ${err.message}`, type: 'error' });
        } finally {
            setFlowsLoading(false);
        }
    };

    const resetImportState = () => {
        setImporting(false);
        setImportProgress(null);
        setImportSummary(null);
        setImportResults([]);
        setImportError('');
    };

    const openImportDialog = () => {
        resetImportState();
        setImportDialogVisible(true);
    };

    const openExportDialog = async () => {
        setExportDialogVisible(true);
        setSearchKeyword('');
        setSelectedCodes([]);
        setExportProgress(null);
        await loadFlows();
    };

    const handleImport = async () => {
        setImporting(true);
        setImportProgress(null);
        setImportSummary(null);
        setImportResults([]);
        setImportError('');

        try {
            const clipboardText = await navigator.clipboard.readText();
            if (!clipboardText || !clipboardText.trim()) {
                setImportError('剪贴板中没有可用的迁移代码');
                return;
            }

            const originalPayload = JSON.parse(clipboardText.trim());

            if (Array.isArray(originalPayload)) {
                const total = originalPayload.length;
                const idleResults = originalPayload.map((item, index) => buildImportResultItem(item, index, 'idle'));
                setImportResults(idleResults);
                setImportSummary({ total, successCount: 0, failedCount: 0, mode: 'batch' });

                const batchRes = await ProcessService.importBatchPayload(originalPayload, (p) => {
                    setImportProgress(p);
                    setImportResults((prev) => prev.map((row, idx) => {
                        if (idx + 1 < p.current) return row;
                        if (idx + 1 === p.current) {
                            return { ...row, status: 'running', message: `正在处理 ${p.flowName || row.flowName}` };
                        }
                        return row;
                    }));
                });

                const errorMap = new Map((batchRes.errors || []).map((item) => [item.index, item]));
                const finalResults = originalPayload.map((item, index) => {
                    const failedItem = errorMap.get(index);
                    if (failedItem) {
                        return buildImportResultItem(item, index, 'error', {
                            message: failedItem.message,
                            raw: failedItem
                        });
                    }
                    return buildImportResultItem(item, index, 'success', {
                        message: '导入成功'
                    });
                });

                setImportResults(finalResults);
                setImportSummary({
                    total: batchRes.total,
                    successCount: batchRes.successCount,
                    failedCount: batchRes.failedCount,
                    mode: 'batch'
                });
                setImportProgress({ current: batchRes.total, total: batchRes.total, flowName: '' });
            } else {
                setImportSummary({ total: 1, successCount: 0, failedCount: 0, mode: 'single' });
                setImportResults([buildImportResultItem(originalPayload, 0, 'running', { message: '正在导入' })]);

                const res = await ProcessService.importPayload(originalPayload);
                if (res && res.success) {
                    setImportResults([
                        buildImportResultItem(originalPayload, 0, 'success', {
                            message: res.message || '导入成功',
                            processCode: res.processCode,
                            raw: res
                        })
                    ]);
                    setImportSummary({ total: 1, successCount: 1, failedCount: 0, mode: 'single' });
                } else {
                    setImportResults([
                        buildImportResultItem(originalPayload, 0, 'error', {
                            message: res?.message || '未知错误',
                            raw: res
                        })
                    ]);
                    setImportSummary({ total: 1, successCount: 0, failedCount: 1, mode: 'single' });
                }
                setImportProgress({ current: 1, total: 1, flowName: '' });
            }
        } catch (err) {
            console.error('导入异常:', err);
            setImportError(`转换或导入失败: ${err.message}`);
            setImportResults((prev) => {
                if (prev.length) return prev;
                return [{
                    index: 0,
                    status: 'error',
                    flowName: '导入任务',
                    sourceProcessCode: '',
                    processCode: '',
                    message: err.message,
                    raw: err
                }];
            });
        } finally {
            setImporting(false);
        }
    };

    const handleBatchExport = async () => {
        try {
            if (!selectedCodes.length) {
                Utils.toast({ title: '请先勾选要导出的集成自动化', type: 'warn' });
                return;
            }
            setExporting(true);
            setExportProgress(null);
            const res = await ProcessService.exportBatchPayload({
                processCodes: selectedCodes,
                onProgress: (p) => setExportProgress(p)
            });
            const text = res.jsonString || JSON.stringify(res.data, null, 2);
            const copied = await Utils.setClipboard(text);
            if (!copied) throw new Error('复制失败，请检查浏览器权限');

            Utils.toast({ title: `导出完成\n成功导出 ${res.count} 个流程，已复制到剪贴板`, type: 'success' });
            setExportDialogVisible(false);
        } catch (err) {
            console.error('导出异常:', err);
            Utils.toast({ title: `导出失败: ${err.message}`, type: 'error' });
        } finally {
            setExporting(false);
            setExportProgress(null);
        }
    };

    const toggleCode = (code) => {
        setSelectedCodes((prev) => prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]);
    };

    const selectAllFiltered = () => {
        const all = filteredFlows
            .map((f) => String(f && f.processCode ? f.processCode : ''))
            .filter(Boolean);
        setSelectedCodes(Array.from(new Set(all)));
    };

    const clearSelection = () => setSelectedCodes([]);

    const importPercent = importProgress && importProgress.total
        ? Math.round((importProgress.current / importProgress.total) * 100)
        : 0;
    const exportPercent = exportProgress && exportProgress.total
        ? Math.round((exportProgress.current / exportProgress.total) * 100)
        : 0;

    return (
        <div
            className="st-import-container"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', paddingLeft: '20px' }}
        >
            <button
                className="st-btn st-btn-primary"
                onClick={openImportDialog}
                disabled={loading}
                style={{
                    height: '28px',
                    padding: '0 12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    background: loading ? '#d9d9d9' : '#722ed1',
                    color: '#fff',
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s'
                }}
            >
                {importing ? '导入中...' : '从剪贴板导入'}
            </button>
            <button
                className="st-btn"
                onClick={openExportDialog}
                disabled={loading}
                style={{
                    height: '28px',
                    padding: '0 12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    background: loading ? '#d9d9d9' : '#13c2c2',
                    color: '#fff',
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s'
                }}
            >
                {exporting ? '导出中...' : '导出集成自动化'}
            </button>

            {importDialogVisible && (
                <div
                    style={overlayStyle}
                    onClick={() => !importing && setImportDialogVisible(false)}
                >
                    <div style={{ ...panelStyle, width: '860px' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                            <div>
                                <div style={{ fontSize: '16px', fontWeight: 600, color: '#222' }}>导入集成自动化</div>
                                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                                    从剪贴板读取迁移 JSON，展示进度、结果和失败详情
                                </div>
                            </div>
                            <StatusTag status={importing ? 'running' : importSummary ? (importSummary.failedCount > 0 ? 'error' : 'success') : 'idle'} />
                        </div>

                        <div style={{ border: '1px solid #f0f0f0', borderRadius: '6px', padding: '12px', background: '#fafafa' }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
                                <button
                                    onClick={handleImport}
                                    disabled={importing}
                                    style={{
                                        height: '32px',
                                        padding: '0 14px',
                                        borderRadius: '4px',
                                        border: 'none',
                                        background: importing ? '#d9d9d9' : '#722ed1',
                                        color: '#fff',
                                        cursor: importing ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    {importing ? '正在导入...' : '开始导入'}
                                </button>
                                {importSummary && (
                                    <div style={{ fontSize: '12px', color: '#666' }}>
                                        总数 {importSummary.total} / 成功 {importSummary.successCount} / 失败 {importSummary.failedCount}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={progressBarWrapStyle}>
                                    <div
                                        style={{
                                            width: `${importPercent}%`,
                                            height: '100%',
                                            background: importSummary && importSummary.failedCount > 0 ? '#fa8c16' : '#722ed1',
                                            borderRadius: '999px',
                                            transition: 'width 0.3s'
                                        }}
                                    />
                                </div>
                                <span style={{ fontSize: '12px', color: '#666', minWidth: '96px', textAlign: 'right' }}>
                                    {importProgress ? `${importProgress.current}/${importProgress.total}` : '未开始'}
                                </span>
                            </div>

                            {importProgress?.flowName && (
                                <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                                    当前处理: {importProgress.flowName}
                                </div>
                            )}

                            {importError && (
                                <div style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '6px', background: '#fff1f0', color: '#cf1322', fontSize: '12px' }}>
                                    {importError}
                                </div>
                            )}
                        </div>

                        <div
                            style={{
                                border: '1px solid #f0f0f0',
                                borderRadius: '6px',
                                overflow: 'auto',
                                maxHeight: '44vh',
                                background: '#fff'
                            }}
                        >
                            {importResults.length ? (
                                importResults.map((item) => (
                                    <div
                                        key={`${item.index}-${item.sourceProcessCode}-${item.flowName}`}
                                        style={{
                                            padding: '12px',
                                            borderBottom: '1px solid #f5f5f5',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '6px'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <StatusTag status={item.status} />
                                            <div style={{ fontSize: '13px', color: '#222', fontWeight: 500 }}>
                                                {item.flowName}
                                            </div>
                                            {item.processCode && (
                                                <div style={{ marginLeft: 'auto', fontSize: '11px', color: '#999' }}>
                                                    新流程编码: {item.processCode}
                                                </div>
                                            )}
                                        </div>
                                        {item.sourceProcessCode && (
                                            <div style={{ fontSize: '11px', color: '#999' }}>
                                                源流程编码: {item.sourceProcessCode}
                                            </div>
                                        )}
                                        <div style={{ fontSize: '12px', color: item.status === 'error' ? '#cf1322' : '#666', whiteSpace: 'pre-wrap' }}>
                                            {item.message || (item.status === 'success' ? '导入成功' : item.status === 'running' ? '正在处理' : '')}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div style={{ padding: '24px', fontSize: '12px', color: '#999', textAlign: 'center' }}>
                                    点击“开始导入”后，这里会显示每条流程的执行结果
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button
                                onClick={() => !importing && setImportDialogVisible(false)}
                                style={{ height: '30px', padding: '0 12px', borderRadius: '4px', border: '1px solid #d9d9d9', background: '#fff', cursor: importing ? 'not-allowed' : 'pointer' }}
                            >
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {exportDialogVisible && (
                <div
                    style={overlayStyle}
                    onClick={() => !exporting && setExportDialogVisible(false)}
                >
                    <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
                        <div style={{ fontSize: '15px', fontWeight: 600 }}>导出集成自动化</div>
                        <input
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                            placeholder="搜索：流程名称 / processCode / 表单名"
                            style={{
                                width: '100%',
                                height: '32px',
                                border: '1px solid #d9d9d9',
                                borderRadius: '4px',
                                padding: '0 10px',
                                fontSize: '12px',
                                outline: 'none'
                            }}
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={selectAllFiltered}
                                disabled={flowsLoading}
                                style={{ height: '28px', padding: '0 10px', borderRadius: '4px', border: '1px solid #d9d9d9', background: '#fff', cursor: 'pointer' }}
                            >
                                全选当前搜索结果
                            </button>
                            <button
                                onClick={clearSelection}
                                disabled={flowsLoading}
                                style={{ height: '28px', padding: '0 10px', borderRadius: '4px', border: '1px solid #d9d9d9', background: '#fff', cursor: 'pointer' }}
                            >
                                清空选择
                            </button>
                            <div style={{ marginLeft: 'auto', fontSize: '12px', color: '#666', lineHeight: '28px' }}>
                                已选 {selectedCodes.length} / {filteredFlows.length}
                            </div>
                        </div>
                        <div
                            style={{
                                border: '1px solid #f0f0f0',
                                borderRadius: '6px',
                                overflow: 'auto',
                                maxHeight: '48vh',
                                padding: '6px'
                            }}
                        >
                            {flowsLoading ? (
                                <div style={{ padding: '14px', fontSize: '12px', color: '#666' }}>加载中...</div>
                            ) : filteredFlows.length ? (
                                filteredFlows.map((flow, idx) => {
                                    const code = String(flow && flow.processCode ? flow.processCode : '');
                                    const key = code || `flow-${idx}`;
                                    const checked = selectedCodes.includes(code);
                                    return (
                                        <label
                                            key={key}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                padding: '8px',
                                                borderBottom: '1px solid #f5f5f5',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <input type="checkbox" checked={checked} onChange={() => toggleCode(code)} />
                                            <span style={{ fontSize: '12px', color: '#222' }}>
                                                {getFlowDisplayName(flow, '(未命名流程)')}
                                            </span>
                                            <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#999' }}>{code}</span>
                                        </label>
                                    );
                                })
                            ) : (
                                <div style={{ padding: '14px', fontSize: '12px', color: '#666' }}>没有匹配到流程</div>
                            )}
                        </div>
                        {exportProgress && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '11px',
                                color: '#666',
                                padding: '4px 0'
                            }}>
                                <span style={{ whiteSpace: 'nowrap', fontWeight: 500 }}>导出进度</span>
                                <div style={progressBarWrapStyle}>
                                    <div
                                        style={{
                                            width: `${exportPercent}%`,
                                            height: '100%',
                                            background: '#13c2c2',
                                            borderRadius: '999px',
                                            transition: 'width 0.3s'
                                        }}
                                    />
                                </div>
                                <span style={{ whiteSpace: 'nowrap' }}>{exportProgress.current}/{exportProgress.total}</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button
                                onClick={() => !exporting && setExportDialogVisible(false)}
                                style={{ height: '30px', padding: '0 12px', borderRadius: '4px', border: '1px solid #d9d9d9', background: '#fff', cursor: 'pointer' }}
                            >
                                取消
                            </button>
                            <button
                                onClick={handleBatchExport}
                                disabled={exporting || flowsLoading}
                                style={{ height: '30px', padding: '0 12px', borderRadius: '4px', border: 'none', background: '#13c2c2', color: '#fff', cursor: exporting ? 'not-allowed' : 'pointer' }}
                            >
                                {exporting ? '导出中...' : '导出选中项并复制'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LogicFlowImportPanel;
