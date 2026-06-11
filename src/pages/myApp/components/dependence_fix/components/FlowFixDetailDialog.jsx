import React from 'react';

const resolveText = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.zh_CN || value.en_US || value.name || value.title || '';
};

const firstText = (...values) => {
    for (const value of values) {
        const text = resolveText(value).trim();
        if (text) return text;
    }
    return '';
};

const DASH_CHAR_CODES = new Set([0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015, 0xff0d]);
const normalizeDashes = (value) => resolveText(value)
    .split('')
    .map(char => DASH_CHAR_CODES.has(char.charCodeAt(0)) ? '-' : char)
    .join('');

const getBusinessName = (value) => {
    const text = normalizeDashes(value).trim();
    if (!text) return '';
    const parts = text.split('-').map(item => item.trim()).filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : text;
};

const BUSINESS_NODE_TYPES = new Set([
    'GetSingleDataNode',
    'GetMultipleDataNode',
    'GetMultiDataNode',
    'AddDataNode',
    'UpdateDataNode',
    'DeleteDataNode',
    'UpsertDataNode',
    'ApprovalNode',
    'InitiateApprovalNode',
    'StartProcessNode',
    'StartApprovalNode'
]);
const isBusinessNodeType = (componentName) => (
    BUSINESS_NODE_TYPES.has(componentName) ||
    componentName?.startsWith('AddDataNode /') ||
    componentName?.startsWith('UpdateDataNode /')
);

const getComponentStatGroups = (components = []) => {
    const businessItems = components.filter(item => isBusinessNodeType(item.componentName));
    return businessItems.length > 0
        ? [{ key: 'business', title: '业务节点', items: businessItems }]
        : [];
};

const cellStyle = { padding: '8px', verticalAlign: 'top' };
const compactCellStyle = { padding: '6px 8px', verticalAlign: 'top', lineHeight: '16px' };
const headerStyle = { padding: '8px', textAlign: 'left', whiteSpace: 'nowrap' };
const compactHeaderStyle = { padding: '7px 8px', textAlign: 'left', whiteSpace: 'nowrap' };
const primaryLineStyle = { color: '#222', fontWeight: 500, wordBreak: 'break-word' };
const refCardStyle = {
    border: '1px solid #f0f0f0',
    borderRadius: '6px',
    background: '#fff',
    padding: '6px 8px',
    lineHeight: '18px'
};
const refLineStyle = {
    display: 'grid',
    gridTemplateColumns: '34px minmax(0, 1fr)',
    gap: '6px',
    alignItems: 'center'
};
const refLabelStyle = { color: '#999', fontSize: '11px', whiteSpace: 'nowrap' };
const refValueStyle = {
    color: '#222',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
};
const compactDetailsStyle = { marginTop: '5px', color: '#888', fontSize: '11px' };
const compactSummaryStyle = { cursor: 'pointer', color: '#888', outline: 'none', userSelect: 'none' };
const metaStackStyle = {
    marginTop: '4px',
    padding: '5px 7px',
    borderRadius: '5px',
    background: '#fafafa',
    lineHeight: '16px'
};
const metaLineStyle = {
    display: 'grid',
    gridTemplateColumns: '76px minmax(0, 1fr)',
    gap: '6px',
    alignItems: 'start'
};
const metaLabelStyle = { color: '#999', whiteSpace: 'nowrap' };
const metaValueStyle = { color: '#666', wordBreak: 'break-all' };
const emptyBadgeStyle = {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '999px',
    background: '#fff1f0',
    color: '#cf1322',
    border: '1px solid #ffa39e',
    fontSize: '11px'
};

const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== '' && String(value).trim() !== '-';

const MetaLine = ({ label, value }) => {
    if (!hasValue(value)) return null;
    return (
        <div style={metaLineStyle}>
            <span style={metaLabelStyle}>{label}</span>
            <span style={metaValueStyle}>{value}</span>
        </div>
    );
};

const CompactRefCard = ({ appName, formName, emptyText = '未匹配目标' }) => {
    const hasApp = hasValue(appName);
    const hasForm = hasValue(formName);

    if (!hasApp && !hasForm) {
        return <span style={emptyBadgeStyle}>{emptyText}</span>;
    }

    return (
        <div style={refCardStyle}>
            <div style={refLineStyle}>
                <span style={refLabelStyle}>应用</span>
                <span style={refValueStyle} title={appName || '-'}>{appName || '-'}</span>
            </div>
            <div style={refLineStyle}>
                <span style={refLabelStyle}>表单</span>
                <span style={refValueStyle} title={formName || '-'}>{formName || '-'}</span>
            </div>
        </div>
    );
};

const MoreDetails = ({ title = '定位信息', children }) => {
    const items = React.Children.toArray(children).filter(Boolean);
    if (items.length === 0) return null;

    return (
        <details style={compactDetailsStyle}>
            <summary style={compactSummaryStyle}>{title}</summary>
            <div style={metaStackStyle}>{items}</div>
        </details>
    );
};

export default function FlowFixDetailDialog({ node, onClose, onOpenFlowDesigner }) {
    if (!node) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.35)',
                zIndex: 10000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
            onClick={onClose}
        >
            <div
                style={{
                    width: '1360px',
                    maxWidth: '96vw',
                    maxHeight: '86vh',
                    background: '#fff',
                    borderRadius: '8px',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
                    padding: '16px',
                    overflow: 'auto'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                    <div>
                        <div style={{ fontSize: '15px', fontWeight: 600, color: '#222' }}>扫描明细</div>
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                            {`${node.processName || node.processCode || '-'} / ${node.appName || '-'}${node.flowFormName ? ` / ${node.flowFormName}` : ''}`}
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                            type="button"
                            onClick={() => onOpenFlowDesigner?.(node)}
                            style={{ height: '28px', padding: '0 10px', borderRadius: '4px', border: '1px solid #91caff', background: '#e6f4ff', color: '#005fb8', cursor: 'pointer' }}
                        >
                            访问
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{ height: '28px', padding: '0 10px', borderRadius: '4px', border: '1px solid #d9d9d9', background: '#fff', cursor: 'pointer' }}
                        >
                            关闭
                        </button>
                    </div>
                </div>

                <div style={{ marginBottom: '6px', fontSize: '13px', color: '#333', fontWeight: 600 }}>业务节点统计</div>
                <div style={{ marginBottom: '14px', fontSize: '12px', color: '#666', lineHeight: '18px' }}>
                    这里只统计集成自动化流程中的业务节点。纳入校验表示该业务节点已识别出可检查的应用/表单依赖；校验通过表示纳入校验后没有发现问题；未纳入校验表示该业务节点当前规则未覆盖，不等同于通过。
                </div>
                {getComponentStatGroups(node.scanStats?.components || []).map(group => (
                    <div key={group.key} style={{ marginBottom: '14px' }}>
                        <div style={{ marginBottom: '6px', fontSize: '12px', color: '#666', fontWeight: 600 }}>{group.title}</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #f0f0f0' }}>
                            <thead>
                                <tr style={{ background: '#fafafa', borderBottom: '1px solid #ebebeb' }}>
                                    <th style={headerStyle}>组件类型</th>
                                    <th style={{ ...headerStyle, textAlign: 'right' }}>节点数</th>
                                    <th style={{ ...headerStyle, textAlign: 'right' }}>纳入校验</th>
                                    <th style={{ ...headerStyle, textAlign: 'right' }}>校验通过</th>
                                    <th style={{ ...headerStyle, textAlign: 'right' }}>未纳入校验</th>
                                    <th style={{ ...headerStyle, textAlign: 'right' }}>问题数</th>
                                </tr>
                            </thead>
                            <tbody>
                                {group.items.map(item => (
                                    <tr key={`${group.key}-${item.componentName}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                        <td style={{ ...cellStyle, color: '#222' }}>{item.componentName}</td>
                                        <td style={{ ...cellStyle, textAlign: 'right' }}>{item.total}</td>
                                        <td style={{ ...cellStyle, textAlign: 'right', color: item.extracted > 0 ? '#005fb8' : '#999' }}>{item.extracted}</td>
                                        <td style={{ ...cellStyle, textAlign: 'right', color: item.passed > 0 ? '#389e0d' : '#999' }}>{item.passed || 0}</td>
                                        <td style={{ ...cellStyle, textAlign: 'right', color: item.skipped > 0 ? '#fa8c16' : '#999' }}>{item.skipped}</td>
                                        <td style={{ ...cellStyle, textAlign: 'right', color: item.issues > 0 ? '#f04134' : '#999' }}>{item.issues}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}

                <div style={{ marginBottom: '10px', fontSize: '13px', color: '#333', fontWeight: 600 }}>问题明细</div>
                <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #f0f0f0' }}>
                    <colgroup>
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '16%' }} />
                        <col style={{ width: '32%' }} />
                        <col style={{ width: '22%' }} />
                        <col style={{ width: '20%' }} />
                    </colgroup>
                    <thead>
                        <tr style={{ background: '#fafafa', borderBottom: '1px solid #ebebeb' }}>
                            <th style={compactHeaderStyle}>节点名称</th>
                            <th style={compactHeaderStyle}>组件类型</th>
                            <th style={compactHeaderStyle}>依赖应用&表单</th>
                            <th style={compactHeaderStyle}>匹配结果</th>
                            <th style={compactHeaderStyle}>问题</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(node.issues || []).map((issue, index) => {
                            const dependency = issue.dependency || {};
                            const matchedAppName = issue.matchedApp ? firstText(issue.matchedApp.appName) : '';
                            const matchedFormName = issue.matchedForm ? firstText(issue.matchedForm.formName, issue.matchedForm.title) : '';
                            const sourceAppBizName = getBusinessName(dependency.appName);
                            const sourceFormBizName = getBusinessName(dependency.formTitle);
                            const normalizedSourceName = sourceAppBizName || sourceFormBizName
                                ? `${sourceAppBizName || '-'} / ${sourceFormBizName || '-'}`
                                : '';
                            return (
                                <tr key={`${issue.componentName}-${index}`} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                    <td style={{ ...compactCellStyle, color: '#005fb8', fontWeight: 500, wordBreak: 'break-word' }}>{issue.nodeName || '-'}</td>
                                    <td style={compactCellStyle}>
                                        {dependency.sourceKind && (
                                            <div style={{
                                                display: 'inline-block',
                                                padding: '1px 6px',
                                                borderRadius: '3px',
                                                background: dependency.sourceKind === '公式' ? '#fff7e6' : '#e6f4ff',
                                                color: dependency.sourceKind === '公式' ? '#d46b08' : '#005fb8',
                                                border: `1px solid ${dependency.sourceKind === '公式' ? '#ffd591' : '#91caff'}`,
                                                fontSize: '10px',
                                                marginBottom: '4px'
                                            }}>
                                                {dependency.sourceKind}
                                            </div>
                                        )}
                                        <div style={{ ...primaryLineStyle, fontWeight: 400 }}>{issue.componentName}</div>
                                    </td>
                                    <td style={compactCellStyle}>
                                        <CompactRefCard appName={dependency.appName} formName={dependency.formTitle} emptyText="未记录源依赖" />
                                        <MoreDetails>
                                            {hasValue(normalizedSourceName) && <MetaLine label="归一化" value={normalizedSourceName} />}
                                            {hasValue(dependency.appNameSource) && <MetaLine label="来源" value={dependency.appNameSource} />}
                                            {hasValue(dependency.sourcePath) && <MetaLine label="路径" value={dependency.sourcePath} />}
                                            {hasValue(dependency.appType) && <MetaLine label="AppID" value={dependency.appType} />}
                                            {hasValue(dependency.formUuid) && <MetaLine label="FormUUID" value={dependency.formUuid} />}
                                            {hasValue(dependency.parentNodeId) && <MetaLine label="ParentNode" value={dependency.parentNodeId} />}
                                            {hasValue(dependency.processCode) && <MetaLine label="ProcessCode" value={dependency.processCode} />}
                                        </MoreDetails>
                                    </td>
                                    <td style={compactCellStyle}>
                                        <CompactRefCard appName={matchedAppName} formName={matchedFormName} />
                                        <MoreDetails title="目标ID">
                                            {hasValue(issue.targetAppId) && <MetaLine label="AppID" value={issue.targetAppId} />}
                                            {hasValue(issue.targetFormId) && <MetaLine label="FormUUID" value={issue.targetFormId} />}
                                            {hasValue(issue.targetProcessCode) && <MetaLine label="ProcessCode" value={issue.targetProcessCode} />}
                                        </MoreDetails>
                                    </td>
                                    <td style={compactCellStyle}>
                                        <span style={{
                                            display: 'inline-block',
                                            padding: '1px 6px',
                                            borderRadius: '3px',
                                            background: issue.canFix ? '#fff7e6' : '#fff1f0',
                                            color: issue.canFix ? '#fa8c16' : '#f04134',
                                            border: `1px solid ${issue.canFix ? '#ffd591' : '#ffa39e'}`,
                                            fontSize: '10px',
                                            marginRight: '6px'
                                        }}>{issue.type}</span>
                                        <span style={{ wordBreak: 'break-word' }}>{issue.message}</span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
