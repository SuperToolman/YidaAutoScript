import React, { useState, useEffect, useCallback, useMemo } from 'react';
import global from '../global';
import Config from '@/services/shared/StyleConfigService';
import Utils from '@/services/shared/BrowserUtilsService';
import { Icon, CopyButton } from './Shared';

// Tree Node for Field
const FieldNode = ({ field, formMatch, appMatch, filterText, getText }) => {
    const [expanded, setExpanded] = useState(!!filterText);

    const toList = (val) => {
        if (Array.isArray(val)) return val;
        if (val && typeof val === 'object') {
            if (Array.isArray(val.list)) return val.list;
            if (Array.isArray(val.columns)) return val.columns;
            if (Array.isArray(val.children)) return val.children;
            if (Array.isArray(val.items)) return val.items;
            const values = Object.values(val);
            if (values.length === 1 && Array.isArray(values[0])) return values[0];
            return values;
        }
        return [];
    };

    const getSubFields = (f) => {
        const potentialLists = [
            f && f.childrenFields, f && f.children, f && f.components, f && f.fields, f && f.fieldList,
            f && f.columns, f && f.props && f.props.columns, f && f.props && f.props.components,
            f && f.props && f.props.fields, f && f.props && f.props.fieldList,
            f && f.props && f.props.childrenFields, f && f.props && f.props.children, f && f.props && f.props.items
        ];
        for (const list of potentialLists) {
            const normalized = toList(list);
            if (Array.isArray(normalized) && normalized.length > 0) return normalized;
        }
        return [];
    };

    const matchField = (value) => {
        const text = getText(value).toLowerCase();
        if (!text) return false;

        // 只使用正向包含匹配（即节点的文本是否包含搜索词）
        if (text.includes(filterText)) return true;

        return false;
    };

    const fName = getText(field?.name) || getText(field?.label) || field?.fieldId || field?.componentId || field?.id;
    const fId = field?.fieldId || field?.componentId || field?.id || '';
    const fType = field?.componentName || field?.type || field?.fieldType || 'Unknown';
    const subFields = getSubFields(field);
    const hasSub = subFields.length > 0;

    // 当前节点自身是否匹配
    const isSelfMatched = !filterText || matchField(fName) || matchField(fId) || matchField(fType);

    // 如果父级（App或Form）已经匹配，或者自身匹配，则所有子节点默认都算匹配（整树保留）
    // 否则，只有子节点自身匹配的才保留
    const isParentOrSelfMatched = formMatch || appMatch || isSelfMatched;

    const filteredSubFields = (!filterText || isParentOrSelfMatched) ? subFields : subFields.filter(sub => {
        const sName = getText(sub?.name) || getText(sub?.label) || sub?.fieldId || sub?.componentId || sub?.id || sub?.title || '';
        const sId = sub?.fieldId || sub?.componentId || sub?.id || '';
        const sType = sub?.componentName || sub?.type || sub?.fieldType || '';
        return matchField(sName) || matchField(sId) || matchField(sType);
    });

    useEffect(() => {
        if (filterText) setExpanded(true);
    }, [filterText]);

    // 如果处于搜索状态，且：自身不匹配、父级不匹配、也没有任何子节点匹配，则不渲染该节点
    // 注意：一定要放在所有 Hooks 之后执行
    if (filterText && !isSelfMatched && !formMatch && !appMatch && filteredSubFields.length === 0) return null;

    return (
        <div>
            <div
                style={{
                    padding: '4px 8px 4px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: '12px', color: '#333', borderBottom: '1px dashed #f0f0f0', cursor: hasSub ? 'pointer' : 'default'
                }}
                onClick={() => hasSub && setExpanded(!expanded)}
            >
                <span style={{ fontSize: '10px', width: '12px', marginRight: '4px', color: '#999', textAlign: 'center', transition: 'transform 0.2s', flexShrink: 0, transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                    {hasSub ? '▶' : ''}
                </span>
                <Icon svgString={hasSub ? Config.ICONS.SUB_FORM : Config.ICONS.FIELD} style={{ marginRight: '6px' }} />

                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, marginRight: '8px', textAlign: 'left', display: 'flex', alignItems: 'center' }} title={fId}>
                    <span>{fName} </span>
                    <span style={{ color: '#888', marginLeft: '4px', fontSize: '11px' }}>({fType})</span>
                </div>

                <CopyButton text="复制ID" value={fId} title={`复制ID: ${fId}`} style={{ border: 'none', background: 'transparent', color: '#1890ff', opacity: 0.8 }} />
            </div>

            {hasSub && expanded && (
                <div style={{ background: '#fafafa' }}>
                    {filteredSubFields.map((sub, idx) => {
                        const sName = getText(sub?.name) || getText(sub?.label) || sub?.fieldId || sub?.componentId || sub?.id || sub?.title || '';
                        const sId = sub?.fieldId || sub?.componentId || sub?.id || '';
                        const sType = sub?.componentName || sub?.type || sub?.fieldType || 'Unknown';

                        return (
                            <div key={sId || idx} style={{ padding: '4px 8px 4px 70px', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#555', borderBottom: '1px dashed #e8e8e8' }}>
                                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, marginRight: '8px', textAlign: 'left', display: 'flex', alignItems: 'center' }} title={sId}>
                                    <span>{sName} </span>
                                    <span style={{ color: '#aaa', marginLeft: '4px', fontSize: '11px' }}>({sType})</span>
                                </div>
                                <CopyButton text="复制ID" value={sId} title={`复制ID: ${sId}`} style={{ border: 'none', background: 'transparent', color: '#1890ff', opacity: 0.8 }} />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// Tree Node for Form
const FormNode = ({ form, appMatch, filterText, getText, appId }) => {
    const [expanded, setExpanded] = useState(!!filterText);

    const matchField = (value) => {
        const text = getText(value).toLowerCase();
        if (!text) return false;

        if (text.includes(filterText)) return true;

        return false;
    };

    const title = getText(form.formName) || (form.title && form.title.zh_CN) || getText(form.title) || '未命名表单';
    const uuid = form.formId || form.formUuid || form.id || '';
    const titleLower = String(title || '').toLowerCase();

    // 表单自身是否匹配
    const formMatch = titleLower.includes(filterText) || (uuid && uuid.toLowerCase().includes(filterText));

    // 是否渲染该表单：
    // 1. 不是搜索状态
    // 2. 所属应用匹配 (appMatch) -> 渲染该应用下所有表单
    // 3. 表单自身匹配 (formMatch) -> 渲染该表单
    // 4. 表单的某个子字段匹配 -> 稍后由下级决定，但在这里必须先放行让它能计算下级
    const formFields = Array.isArray(form.fields) ? form.fields : (Array.isArray(form.fieldList) ? form.fieldList : []);

    // 提前计算一遍是否有任何子节点匹配（用于判断当 App 和 Form 都不匹配时，这个 Form 节点要不要展示）
    const hasMatchedChild = formFields.some(field => {
        const fName = getText(field?.name) || getText(field?.label) || field?.fieldId || field?.componentId || field?.id;
        const fId = field?.fieldId || field?.componentId || field?.id || '';
        const fType = field?.componentName || field?.type || field?.fieldType || 'Unknown';

        if (matchField(fName) || matchField(fId) || matchField(fType)) return true;

        // 浅层探测一下子组件
        const toList = (val) => {
            if (Array.isArray(val)) return val;
            if (val && typeof val === 'object') {
                if (Array.isArray(val.list)) return val.list;
                if (Array.isArray(val.columns)) return val.columns;
                if (Array.isArray(val.children)) return val.children;
                if (Array.isArray(val.items)) return val.items;
                const values = Object.values(val);
                if (values.length === 1 && Array.isArray(values[0])) return values[0];
                return values;
            }
            return [];
        };

        const potentialLists = [
            field?.childrenFields, field?.children, field?.components, field?.fields, field?.fieldList,
            field?.columns, field?.props?.columns, field?.props?.components,
            field?.props?.fields, field?.props?.fieldList,
            field?.props?.childrenFields, field?.props?.children, field?.props?.items
        ];
        for (const list of potentialLists) {
            const normalized = toList(list);
            if (Array.isArray(normalized) && normalized.length > 0) {
                if (normalized.some(sub => {
                    const sName = getText(sub?.name) || getText(sub?.label) || sub?.fieldId || sub?.componentId || sub?.id || sub?.title || '';
                    const sId = sub?.fieldId || sub?.componentId || sub?.id || '';
                    const sType = sub?.componentName || sub?.type || sub?.fieldType || '';
                    return matchField(sName) || matchField(sId) || matchField(sType);
                })) return true;
            }
        }
        return false;
    });

    useEffect(() => {
        if (filterText) setExpanded(true);
    }, [filterText]);

    // 核心显示逻辑：如果是搜索模式，且应用没搜到、表单没搜到、下面的字段也没搜到，就直接隐藏整个表单
    if (filterText && !appMatch && !formMatch && !hasMatchedChild) return null;

    return (
        <div style={{ borderTop: '1px solid #f0f0f0' }}>
            <div
                style={{ cursor: 'pointer', padding: '6px 8px 6px 20px', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#333' }}
                onClick={() => setExpanded(!expanded)}
            >
                <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', flex: 1, marginRight: '8px' }}>
                    <span style={{ fontSize: '10px', marginRight: '6px', color: '#999', transition: 'transform 0.2s', flexShrink: 0, transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                    <Icon svgString={Config.ICONS.FORM} style={{ marginRight: '6px' }} />
                    <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center' }}>
                        <span>{title}</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                    {uuid && appId && !uuid.startsWith('REPORT-') && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const url = `https://${global.info.domain}.aliwork.com/${appId}/admin/${uuid}`;
                                window.open(url, '_blank');
                            }}
                            style={{ border: '1px solid #b7eb8f', background: '#fff', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', color: '#52c41a', flexShrink: 0 }}
                            title="跳转到该页面"
                        >跳转页面</button>
                    )}
                    {uuid && !uuid.startsWith('REPORT-') && (
                        <CopyButton text="复制 UUID" value={uuid} title={`复制FORM_UUID: ${uuid}`} />
                    )}
                </div>
            </div>

            {expanded && (
                <div style={{ padding: '4px 0 8px 0', background: '#fff' }}>
                    {formFields.length > 0 ? (
                        formFields.map((field, idx) => (
                            <FieldNode
                                key={field.fieldId || field.componentId || field.id || idx}
                                field={field}
                                formMatch={formMatch}
                                appMatch={appMatch}
                                filterText={filterText}
                                getText={getText}
                            />
                        ))
                    ) : (
                        <div style={{ padding: '4px 0 4px 40px', color: '#ccc', fontSize: '12px' }}>无匹配字段</div>
                    )}
                </div>
            )}
        </div>
    );
};

// Tree Node for App
const AppNode = ({ appInfo, filterText }) => {
    const [expanded, setExpanded] = useState(!!filterText);

    const appId = appInfo.appId || appInfo.appType || '';
    const appName = appInfo.appName || appInfo.appOriginalName || appId || '未知应用';

    const appNameLower = appName.toLowerCase();
    const appIdLower = (appId || '').toLowerCase();
    const appMatch = !!filterText && (appNameLower.includes(filterText) || appIdLower.includes(filterText));

    const forms = Array.isArray(appInfo.forms) ? appInfo.forms : [];

    const getText = (val) => {
        if (typeof val === 'string') return val;
        if (val && typeof val === 'object') {
            if (typeof val.zh_CN === 'string') return val.zh_CN;
            if (typeof val.en_US === 'string') return val.en_US;
            const nested = val.name || val.title || val.label || val.text || val.displayName || val.value;
            if (typeof nested === 'string') return nested;
            if (nested && typeof nested === 'object') {
                return nested.zh_CN || nested.en_US || nested.text || nested.label || nested.title || nested.name || '';
            }
            return val.text || val.label || val.title || val.name || val.value || '';
        }
        return '';
    };

    const matchField = (value) => {
        const text = getText(value).toLowerCase();
        if (!text) return false;

        if (text.includes(filterText)) return true;

        return false;
    };

    // 提前计算一遍是否有任何子表单或子字段匹配（用于判断当 App 自身不匹配时，要不要展示这个 App）
    const hasMatchedChild = forms.some(form => {
        const title = getText(form.formName) || (form.title && form.title.zh_CN) || getText(form.title) || '';
        const uuid = form.formId || form.formUuid || form.id || '';
        if (String(title).toLowerCase().includes(filterText) || String(uuid).toLowerCase().includes(filterText)) return true;

        const formFields = Array.isArray(form.fields) ? form.fields : (Array.isArray(form.fieldList) ? form.fieldList : []);
        return formFields.some(field => {
            const fName = getText(field?.name) || getText(field?.label) || field?.fieldId || field?.componentId || field?.id;
            const fId = field?.fieldId || field?.componentId || field?.id || '';
            const fType = field?.componentName || field?.type || field?.fieldType || 'Unknown';
            if (matchField(fName) || matchField(fId) || matchField(fType)) return true;

            // App层级也要简单探测下第三级字段，防止深层组件命中但被App父级拦截隐藏
            const toList = (val) => {
                if (Array.isArray(val)) return val;
                if (val && typeof val === 'object') {
                    if (Array.isArray(val.list)) return val.list;
                    if (Array.isArray(val.columns)) return val.columns;
                    if (Array.isArray(val.children)) return val.children;
                    if (Array.isArray(val.items)) return val.items;
                    const values = Object.values(val);
                    if (values.length === 1 && Array.isArray(values[0])) return values[0];
                    return values;
                }
                return [];
            };
            const potentialLists = [
                field?.childrenFields, field?.children, field?.components, field?.fields, field?.fieldList,
                field?.columns, field?.props?.columns, field?.props?.components,
                field?.props?.fields, field?.props?.fieldList,
                field?.props?.childrenFields, field?.props?.children, field?.props?.items
            ];
            for (const list of potentialLists) {
                const normalized = toList(list);
                if (Array.isArray(normalized) && normalized.length > 0) {
                    if (normalized.some(sub => {
                        const sName = getText(sub?.name) || getText(sub?.label) || sub?.fieldId || sub?.componentId || sub?.id || sub?.title || '';
                        const sId = sub?.fieldId || sub?.componentId || sub?.id || '';
                        const sType = sub?.componentName || sub?.type || sub?.fieldType || '';
                        return matchField(sName) || matchField(sId) || matchField(sType);
                    })) return true;
                }
            }

            return false;
        });
    });

    useEffect(() => {
        if (filterText) setExpanded(true);
    }, [filterText]);

    if (filterText && !appMatch && !hasMatchedChild) return null;

    return (
        <div style={{ marginBottom: '4px', border: '1px solid #e8e8e8', borderRadius: '6px', overflow: 'hidden' }}>
            <div
                style={{ cursor: 'pointer', padding: '6px 8px', background: '#e6f4ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 600, fontSize: '13px', color: '#1890ff' }}
                onClick={() => setExpanded(!expanded)}
            >
                <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', flex: 1, marginRight: '8px' }}>
                    <span style={{ fontSize: '10px', marginRight: '8px', transition: 'transform 0.2s', flexShrink: 0, transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                    <Icon svgString={Config.ICONS.APP} style={{ marginRight: '8px' }} />
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center' }}>
                        <span>{appName}</span>
                        <span style={{ marginLeft: '6px', fontSize: '11px', color: '#999', fontWeight: 400, flexShrink: 0 }}>{forms.length}个表单</span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                        onClick={async (e) => {
                            e.stopPropagation();
                            if (!appId) return;
                            try {
                                const res = await global.services.getSystemToken(appId);
                                const tokenValue = res && res.content ? res.content : '';
                                if (tokenValue) await Utils.setClipboard(String(tokenValue));
                            } catch (err) {
                                console.error('获取系统Token失败:', err);
                            }
                        }}
                        style={{ border: '1px solid #91d5ff', background: '#fff', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', color: '#1890ff', flexShrink: 0 }}
                    >复制系统Token</button>
                    {appId && <CopyButton text="复制 APP_ID" value={appId} title={`复制APP_ID: ${appId}`} style={{ borderColor: '#91d5ff', color: '#1890ff' }} />}
                </div>
            </div>

            {expanded && (
                <div style={{ background: '#fff' }}>
                    {forms.map((form, idx) => (
                        <FormNode
                            key={form.formId || form.formUuid || form.id || idx}
                            form={form}
                            appMatch={appMatch}
                            filterText={filterText}
                            getText={getText}
                            appId={appId}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default function OutlinePanel() {
    const [searchText, setSearchText] = useState('');       // 搜索文本
    const [activeSearch, setActiveSearch] = useState('');   // 替代 debouncedSearch，用于保存真正点击搜索时的词
    const [structure, setStructure] = useState([]);         // 应用结构数据
    const [loading, setLoading] = useState(false);          // 加载状态

    const refreshData = useCallback(async (silent = false) => {
        const cachedData = global.info?.appStructure;
        if (!silent) {
            setLoading(true);
        } else if (cachedData && cachedData.length > 0) {
            setStructure([...cachedData]);
        }
        try {
            const rawStructure = await global.services.getFullAppStructure();
            const data = Utils.getFullStructureApps(rawStructure);
            global.info.appStructure = data;
            setStructure([...data]);
            if (!silent) {
                Utils.toast({ title: '字段大纲刷新成功', type: 'success' });
            }
            return data;
        } catch (err) {
            console.error('[OutlinePanel] 刷新大纲失败', err);
            if (!silent) {
                Utils.toast({ title: '刷新失败', type: 'error' });
            }
            setStructure([...(cachedData || [])]);
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        refreshData(true);
    }, [refreshData]);

    const handleSearch = () => {
        setActiveSearch(searchText.toLowerCase().trim());
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const handleCopyStructure = async () => {
        if (!structure || structure.length === 0) {
            Utils.toast({ title: '暂无结构数据', type: 'warn' });
            return;
        }
        await Utils.setClipboard(JSON.stringify(structure, null, 2));
    };

    const searchHitCount = useMemo(() => {
        if (!activeSearch || !structure.length) return 0;
        const filter = activeSearch.toLowerCase();
        const getText = (val) => {
            if (typeof val === 'string') return val;
            if (val && typeof val === 'object') {
                if (typeof val.zh_CN === 'string') return val.zh_CN;
                if (typeof val.en_US === 'string') return val.en_US;
                const nested = val.name || val.title || val.label || val.text || val.displayName || val.value;
                if (typeof nested === 'string') return nested;
                if (nested && typeof nested === 'object') {
                    return nested.zh_CN || nested.en_US || nested.text || nested.label || nested.title || nested.name || '';
                }
                return val.text || val.label || val.title || val.name || val.value || '';
            }
            return '';
        };
        const matchText = (text) => String(text).toLowerCase().includes(filter);

        let count = 0;
        structure.forEach(app => {
            const appId = app.appId || app.appType || '';
            const appName = getText(app.appName || app.appOriginalName || '');
            const appMatch = matchText(appName) || matchText(appId);

            const forms = Array.isArray(app.forms) ? app.forms : [];
            let appCounted = false;

            if (appMatch) {
                count++;
                appCounted = true;
            }

            if (!appCounted) {
                for (const form of forms) {
                    const formTitle = getText(form.formName) || (form.title && form.title.zh_CN) || getText(form.title) || '';
                    const formUuid = form.formId || form.formUuid || form.id || '';
                    const formMatch = matchText(formTitle) || matchText(formUuid);

                    if (formMatch) {
                        count++;
                        break;
                    }

                    const formFields = Array.isArray(form.fields) ? form.fields : (Array.isArray(form.fieldList) ? form.fieldList : []);
                    const hasFieldMatch = formFields.some(field => {
                        const fName = getText(field?.name) || getText(field?.label) || field?.fieldId || field?.componentId || field?.id || '';
                        const fId = field?.fieldId || field?.componentId || field?.id || '';
                        const fType = field?.componentName || field?.type || field?.fieldType || '';
                        return matchText(fName) || matchText(fId) || matchText(fType);
                    });

                    if (hasFieldMatch) {
                        count++;
                        break;
                    }
                }
            }
        });
        return count;
    }, [activeSearch, structure]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '8px', borderBottom: '1px solid #eee', display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center' }}>
                <button className="st-btn st-btn-primary st-btn-small" onClick={refreshData}>刷新</button>
                <button className="st-btn st-btn-small" onClick={handleCopyStructure}>复制结构</button>

                <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
                    <input
                        className="st-input"
                        placeholder="搜索应用/表单/字段..."
                        style={{ flex: 1, padding: '4px 28px 4px 8px', fontSize: '12px' }}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <div
                        onClick={handleSearch}
                        style={{
                            position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)',
                            cursor: 'pointer', color: '#999', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                        title="点击或按回车搜索"
                    >
                        <svg viewBox="0 0 1024 1024" width="14" height="14" fill="currentColor">
                            <path d="M909.6 854.5L649.9 594.8C690.2 542.7 712 479 712 412c0-80.2-31.3-155.4-87.9-212.1-56.6-56.7-132-87.9-212.1-87.9s-155.5 31.3-212.1 87.9C143.2 256.5 112 331.8 112 412c0 80.1 31.3 155.5 87.9 212.1C256.5 680.8 331.8 712 412 712c67 0 130.6-21.8 182.7-62l259.7 259.6a8.2 8.2 0 0 0 11.6 0l43.6-43.5a8.2 8.2 0 0 0 0-11.6zM570.4 570.4C528 612.7 471.8 636 412 636s-116-23.3-158.4-65.6C211.3 528 188 471.8 188 412s23.3-116.1 65.6-158.4C296 211.3 352.2 188 412 188s116.1 23.2 158.4 65.6S636 352.2 636 412s-23.3 116.1-65.6 158.4z" />
                        </svg>
                    </div>
                </div>
                {activeSearch && (
                    <span style={{ fontSize: '11px', color: '#1890ff', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        命中 {searchHitCount} 个应用
                    </span>
                )}
            </div>
            <div className="st-field-tree" style={{ flex: 1, overflowY: 'auto', padding: '0px', color: '#000' }}>
                {loading ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>加载中...</div>
                ) : structure.length === 0 ? (
                    <div style={{ padding: '12px', textAlign: 'center', color: '#999' }}>暂无表单数据，请尝试刷新</div>
                ) : (
                    structure.map((appInfo, idx) => (
                        <AppNode
                            key={appInfo.appId || appInfo.appType || idx}
                            appInfo={appInfo}
                            filterText={activeSearch}
                        />
                    ))
                )}
            </div>
        </div>
    );
};