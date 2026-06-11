import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useExternalDom } from '@/hooks/useExternalDom';
import Utils from '@/services/shared/BrowserUtilsService';
import DataMetadataModule from '@/services/dataset/DataMetadataService';
import ConvertModule from '@/services/schema/SchemaConvertService';
import global from '@/global';

const DataSetPageInjector = () => {
    const tableTl = useExternalDom('.next-yida-table-tl');

    if (!tableTl) return null;

    return <DataSetActionsPortal container={tableTl} />;
};

const DataSetActionsPortal = ({ container }) => {
    const [target, setTarget] = useState(null);

    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [datasetList, setDatasetList] = useState([]);
    const [filteredList, setFilteredList] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [filterType, setFilterType] = useState('ALL'); // 筛选类型
    const [sortOrder, setSortOrder] = useState('DESC');  // 排序方式
    
    // Import state
    const [importText, setImportText] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!container) return;

        let div = container.querySelector('.yida-dataset-btn-container');
        if (!div) {
            div = Utils.create('span', {
                className: 'yida-dataset-btn-container',
                style: 'display: inline-block; margin-left: 8px;'
            });
            container.appendChild(div);
        }
        setTarget(div);

        return () => {
            if (div && div.parentNode) {
                div.parentNode.removeChild(div);
            }
        };
    }, [container]);

    const handleBatchCopyClick = async () => {
        setIsLoading(true);
        Utils.toast({ title: '开始查询数据集...', type: 'info' });
        try {
            const res = await global.services.searchCubeList();
            const data = res?.content?.data || [];
            
            // 给原始数据打上初始索引索引，方便恢复“原始顺序”
            const indexedData = data.map((item, index) => ({ ...item, _originalIndex: index }));
            
            setDatasetList(indexedData);
            setFilteredList(indexedData);
            setSelectedIds([]);
            setSearchText('');
            setFilterType('ALL');
            setSortOrder('ORIGINAL'); // 默认使用原始顺序
            setIsDialogOpen(true);
            Utils.toast({ title: `查询成功！共找到 ${data.length} 个数据集`, type: 'success' });
        } catch (err) {
            console.error(err);
            Utils.toast({ title: '查询数据集失败: ' + err.message, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    // 监听筛选和搜索状态的变化，统一处理列表数据
    useEffect(() => {
        if (!datasetList.length) return;
        
        let result = [...datasetList];

        // 1. 类型筛选
        if (filterType !== 'ALL') {
            result = result.filter(item => item.cubeSourceName === filterType);
        }

        // 2. 文本搜索
        if (searchText.trim()) {
            const lower = searchText.toLowerCase();
            result = result.filter(item => (item.name && item.name.toLowerCase().includes(lower)));
        }

        // 3. 排序 (基于名称、类型或原始顺序)
        result.sort((a, b) => {
            if (sortOrder === 'ORIGINAL') {
                return a._originalIndex - b._originalIndex;
            } else if (sortOrder === 'NAME_ASC') {
                return (a.name || '').localeCompare(b.name || '', 'zh-CN');
            } else if (sortOrder === 'NAME_DESC') {
                return (b.name || '').localeCompare(a.name || '', 'zh-CN');
            } else if (sortOrder === 'TYPE_ASC') {
                return (a.cubeSourceName || '').localeCompare(b.cubeSourceName || '', 'zh-CN');
            } else if (sortOrder === 'TYPE_DESC') {
                return (b.cubeSourceName || '').localeCompare(a.cubeSourceName || '', 'zh-CN');
            }
            return 0;
        });

        setFilteredList(result);
    }, [searchText, filterType, sortOrder, datasetList]);

    const handleSearch = () => {
        // 由于已经用 useEffect 监听了 searchText 变化并自动过滤，这里可以保持为空，
        // 或者保留以支持用户按回车时的习惯动作（实际上输入时已经实时过滤了）
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedIds(filteredList.map(item => item.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelect = (id, checked) => {
        if (checked) {
            setSelectedIds([...selectedIds, id]);
        } else {
            setSelectedIds(selectedIds.filter(i => i !== id));
        }
    };

    const handleConfirmCopy = () => {
        const selectedData = datasetList.filter(item => selectedIds.includes(item.id));
        if (selectedData.length === 0) {
            Utils.toast({ title: '请至少选择一条数据', type: 'warning' });
            return;
        }

        // 处理并附加元数据
        const enrichedData = DataMetadataModule.enrichMetadata(selectedData);

        const jsonStr = JSON.stringify(enrichedData, null, 2);
        navigator.clipboard.writeText(jsonStr).then(() => {
            Utils.toast({ title: `已成功复制 ${enrichedData.length} 条数据到剪贴板！`, type: 'success' });
            setIsDialogOpen(false);
        }).catch(err => {
            // fallback
            try {
                const textarea = document.createElement('textarea');
                textarea.value = jsonStr;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                Utils.toast({ title: `已成功复制 ${enrichedData.length} 条数据到剪贴板！`, type: 'success' });
                setIsDialogOpen(false);
            } catch (fallbackErr) {
                Utils.toast({ title: '复制失败: ' + fallbackErr.message, type: 'error' });
            }
        });
    };

    const handleImportClick = async () => {
        if (!importText.trim()) {
            Utils.toast({ title: '请输入需要导入的数据集 JSON', type: 'warn' });
            return;
        }

        let importData = [];
        try {
            importData = JSON.parse(importText);
            if (!Array.isArray(importData)) {
                importData = [importData]; // 容错：如果是单个对象转为数组
            }
        } catch (e) {
            Utils.toast({ title: 'JSON 格式解析失败', type: 'error' });
            return;
        }

        if (importData.length === 0) {
            Utils.toast({ title: '导入内容为空', type: 'warn' });
            return;
        }

        Utils.toast({ title: '开始尝试导入...', type: 'info' });

        // 预先加载并缓存全量应用结构，为后续的 ConvertModule 提供数据支撑
        if (!global.info.appStructure || global.info.appStructure.length === 0) {
            try {
                const rawStructure = await global.services.getFullAppStructure();
                global.info.appStructure = Utils.getFullStructureApps(rawStructure);
            } catch (err) {
                console.error("[DataSet] 获取 B 组织全量应用结构失败", err);
                Utils.toast({ title: '获取应用结构失败，可能影响匹配', type: 'warn' });
            }
        }

        let successCount = 0;
        let failCount = 0;

        for (const item of importData) {
            try {
                const sourceType = item.cubeSourceName;
                if (sourceType === '跨应用表单') {
                    await importCrossAppForm(item);
                    successCount++;
                } else {
                    console.warn(`[DataSet] 暂不支持导入类型: ${sourceType}`);
                    failCount++;
                }
            } catch (err) {
                console.error(`[DataSet] 导入失败:`, err);
                failCount++;
            }
        }

        if (failCount === 0) {
            Utils.toast({ title: `导入成功！共导入 ${successCount} 个数据集`, type: 'success' });
            setImportText('');
        } else {
            Utils.toast({ title: `导入完成: ${successCount} 成功, ${failCount} 失败`, type: 'warn', duration: 5000 });
        }

        // 如果成功了，尝试刷新列表
        if (successCount > 0) {
            const refreshBtn = document.querySelector('.next-btn-primary.refresh-btn');
            if (refreshBtn) refreshBtn.click();
        }
    };

    /**
     * 导入“跨应用表单”逻辑
     */
    const importCrossAppForm = async (item) => {
        const meta = item._metadata;
        if (!meta) {
            console.warn(`[DataSet] 数据缺少 _metadata，无法跨组织匹配:`, item.name);
            return false;
        }

        // 剥离 _metadata，防止后端校验多余字段报错
        const cleanItem = { ...item };
        delete cleanItem._metadata;

        const { appName, fuzzyAppName, formName, fuzzyFormName, subFormName } = meta;

        // 1. 使用 fuzzyAppName 或 appName，以及 formName/fuzzyFormName 在 B 组织中查找目标表单
        // ConvertModule.findTargetFormByName 内部已经实现了应用名的精确/模糊匹配，以及表单名的模糊匹配
        const searchAppName = fuzzyAppName || appName;
        const targetInfo = await ConvertModule.findTargetFormByName(searchAppName, formName, fuzzyFormName);

        if (!targetInfo) {
            console.warn(`[DataSet] 在当前组织未找到匹配的应用/表单: ${searchAppName} -> ${formName} (或模糊: ${fuzzyFormName})`);
            return false;
        }

        // 2. 构造 tableComment
        // 根据用户的最新发现，tableComment 只需要 "表单名.子表单名" 或 "表单名"，不需要拼接应用名！
        // targetInfo.formName 有时可能自带了应用名前缀，需要将其清理掉
        let currentFormName = targetInfo.formName || formName;
        
        // 尝试剥离可能的应用名前缀 (例如 "丹宇ERP财务管理.应付单" -> "应付单")
        const dotIndex = currentFormName.indexOf('.');
        if (dotIndex > -1) {
            // 取点号后面的部分作为纯净的表单名
            currentFormName = currentFormName.substring(dotIndex + 1).trim();
        }

        let tableComment = currentFormName;
        if (subFormName) {
            tableComment += `.${subFormName}`;
        }

        // 3. 提取所需的参数
        const currentAppId = global.info.appId; 
        const targetAppId = targetInfo.appId;
        // 跨应用数据源接口要求使用下划线代替横杠 (如 FORM_xxx 而不是 FORM-xxx)
        const formattedFormUuid = (targetInfo.formUuid || '').replace(/-/g, '_');

        console.log(`[DataSet] 准备导入跨应用表单:`, {
            "源数据名称": item.name,
            "匹配到应用": targetInfo.appName,
            "匹配到表单": targetInfo.formName,
            "最终 tableComment": tableComment
        });

        // 4. 调用接口导入
        try {
            // 这里需要将 cleanItem (除了_metadata之外的其他字段) 与匹配到的新结构结合起来发送
            // 但是对于 addDataSourceTable 接口，它实际上只需要目标表单的 schemaCode 和 tableName
            const res = await global.services.addDataSourceTable(currentAppId, targetAppId, formattedFormUuid, tableComment);
            if (res && res.success) {
                console.log(`[DataSet] 导入成功: ${tableComment}`);
                return true;
            } else {
                console.error(`[DataSet] 接口返回失败:`, res);
                return false;
            }
        } catch (e) {
            console.error(`[DataSet] 接口调用异常:`, e);
            return false;
        }
    };

    if (!target) return null;

    const allSelected = filteredList.length > 0 && selectedIds.length === filteredList.length;
    const isIndeterminate = selectedIds.length > 0 && selectedIds.length < filteredList.length;

    return createPortal(
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <input 
                type="text" 
                placeholder="粘贴数据集 JSON 导入" 
                value={importText}
                onChange={e => setImportText(e.target.value)}
                style={{
                    height: 28,
                    padding: '0 8px',
                    border: '1px solid #d9d9d9',
                    borderRadius: 4,
                    fontSize: 12,
                    width: 160
                }}
            />
            <button
                style={{
                    padding: '0 16px',
                    height: 28,
                    border: '1px solid #52c41a',
                    background: '#fff',
                    color: '#52c41a',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 12,
                }}
                onClick={handleImportClick}
            >
                导入
            </button>
            <button
                disabled={isLoading}
                style={{
                    padding: '0 16px',
                    height: 28,
                    border: '1px solid #1890ff',
                    background: '#1890ff',
                    color: '#fff',
                    borderRadius: 4,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    fontSize: 12,
                    opacity: isLoading ? 0.7 : 1
                }}
                onClick={handleBatchCopyClick}
            >
                {isLoading ? '加载中...' : '批量复制'}
            </button>

            {isDialogOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        background: '#fff', width: 600, maxHeight: '80vh',
                        borderRadius: 8, display: 'flex', flexDirection: 'column',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}>
                        {/* Header */}
                        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: 16, color: '#333' }}>批量复制数据集</h3>
                            <span style={{ cursor: 'pointer', color: '#999', fontSize: 20 }} onClick={() => setIsDialogOpen(false)}>×</span>
                        </div>

                        {/* Search & Actions */}
                        <div style={{ padding: '16px 24px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input 
                                type="text"
                                placeholder="搜索数据集名称"
                                value={searchText}
                                onChange={e => setSearchText(e.target.value)}
                                style={{ flex: 1, height: 32, padding: '0 12px', border: '1px solid #d9d9d9', borderRadius: 4 }}
                            />
                            <select 
                                value={filterType}
                                onChange={e => setFilterType(e.target.value)}
                                style={{ height: 32, padding: '0 8px', border: '1px solid #d9d9d9', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
                            >
                                <option value="ALL">全部类型</option>
                                <option value="跨应用表单">跨应用表单</option>
                                <option value="视图表">视图表</option>
                                <option value="表单">表单</option>
                                <option value="数据库">数据库</option>
                                <option value="数据准备">数据准备</option>
                            </select>
                            <select 
                                value={sortOrder}
                                onChange={e => setSortOrder(e.target.value)}
                                style={{ height: 32, padding: '0 8px', border: '1px solid #d9d9d9', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
                            >
                                <option value="ORIGINAL">默认顺序</option>
                                <option value="NAME_ASC">名称升序</option>
                                <option value="NAME_DESC">名称降序</option>
                                <option value="TYPE_ASC">类型升序</option>
                                <option value="TYPE_DESC">类型降序</option>
                            </select>
                        </div>

                        {/* List */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{ padding: '8px', borderBottom: '1px solid #f0f0f0', textAlign: 'left', width: 40 }}>
                                            <input 
                                                type="checkbox" 
                                                checked={allSelected}
                                                ref={input => { if (input) input.indeterminate = isIndeterminate; }}
                                                onChange={handleSelectAll}
                                            />
                                        </th>
                                        <th style={{ padding: '8px', borderBottom: '1px solid #f0f0f0', textAlign: 'left' }}>名称</th>
                                        <th style={{ padding: '8px', borderBottom: '1px solid #f0f0f0', textAlign: 'left', width: 120 }}>类型</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredList.map(item => (
                                        <tr key={item.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                            <td style={{ padding: '8px' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedIds.includes(item.id)}
                                                    onChange={(e) => handleSelect(item.id, e.target.checked)}
                                                />
                                            </td>
                                            <td style={{ padding: '8px', color: '#333' }}>{item.name}</td>
                                            <td style={{ padding: '8px', color: '#666', fontSize: 12 }}>{item.cubeSourceName || '-'}</td>
                                        </tr>
                                    ))}
                                    {filteredList.length === 0 && (
                                        <tr>
                                            <td colSpan="3" style={{ padding: '24px', textAlign: 'center', color: '#999' }}>暂无数据</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '16px 24px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, color: '#666' }}>已选择 {selectedIds.length} 项</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button 
                                    onClick={() => setIsDialogOpen(false)}
                                    style={{ padding: '0 16px', height: 32, border: '1px solid #d9d9d9', background: '#fff', borderRadius: 4, cursor: 'pointer' }}
                                >取消</button>
                                <button 
                                    onClick={handleConfirmCopy}
                                    style={{ padding: '0 16px', height: 32, border: 'none', background: '#1890ff', color: '#fff', borderRadius: 4, cursor: 'pointer' }}
                                >确认复制</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        target
    );
};

export default DataSetPageInjector;