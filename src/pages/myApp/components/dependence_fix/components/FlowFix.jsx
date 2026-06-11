import React, { useState } from 'react';
import Utils from '@/services/shared/BrowserUtilsService';
import global from '@/global';
import ProcessService from '@/services/ProcessService';
import FlowFixDetailDialog from './FlowFixDetailDialog.jsx';

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
const normalizeText = (value) => normalizeDashes(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
const getBusinessName = (value) => {
    const text = normalizeDashes(value).trim();
    if (!text) return '';
    const parts = text.split('-').map(item => item.trim()).filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : text;
};
const normalizeBusinessName = (value) => normalizeText(getBusinessName(value));
const isFuzzyMatch = (sourceName, targetName) => {
    const source = normalizeBusinessName(sourceName);
    const target = normalizeBusinessName(targetName);
    if (!source || !target) return false;
    return source === target || source.includes(target) || target.includes(source);
};
const isFormNameMatch = (sourceName, targetName) => {
    const source = resolveText(sourceName).trim();
    const target = resolveText(targetName).trim();
    return Boolean(source && target && source === target);
};
const extractBracketText = (value) => {
    const text = resolveText(value).trim();
    const match = text.match(/[\[【]([^\]】]+)[\]】]/);
    return match ? match[1].trim() : '';
};
const getFormId = (form) => form?.formId || form?.formUuid || form?.id || '';
const getNodeName = (node) => firstText(node?.props?.name?.zh_CN, node?.title, node?.props?.name, node?.props?.nodeName, node?.componentName) || '-';
const createRef = (holder, key) => ({ holder, key, value: holder?.[key] || '' });
const createStringTokenRef = (holder, key, value) => ({ holder, key, value, replaceInString: true });
const isValidFormUuid = (value) => typeof value === 'string' && value.startsWith('FORM-');
const createFormRefIfValid = (holder, key) => {
    const ref = createRef(holder, key);
    return isValidFormUuid(ref.value) ? ref : null;
};
const getTargetForm = (targetItem) => targetItem?.formItem || {};
const FLOW_FIX_DEBUG = false;
const EXTRACTABLE_DEPENDENCY_COMPONENTS = new Set([
    'GetSingleDataNode',
    'AddDataNode',
    'UpdateDataNode',
    'InitiateApprovalNode'
]);
const isExtractableDependencyComponent = (componentName) => (
    EXTRACTABLE_DEPENDENCY_COMPONENTS.has(componentName) ||
    componentName?.startsWith('AddDataNode /') ||
    componentName?.startsWith('UpdateDataNode /')
);
const debugFlowFix = (...args) => {
    if (FLOW_FIX_DEBUG) console.debug(...args);
};

const extractGetSingleDataNode = (node) => {
    const getData = node?.props?.getData;
    const targetItem = getData?.targetItem || {};
    const formItem = getTargetForm(targetItem);
    if (!getData || !targetItem) return null;

    const appName = firstText(targetItem.appName);
    const formTitle = firstText(formItem.title, formItem.formName, formItem.tableName);
    const formUuid = isValidFormUuid(getData.sourceId)
        ? getData.sourceId
        : isValidFormUuid(formItem.formUuid)
            ? formItem.formUuid
            : '';
    const formRefs = [
        createFormRefIfValid(getData, 'sourceId'),
        createFormRefIfValid(formItem, 'formUuid')
    ].filter(Boolean);

    if (!appName || !formTitle || !formUuid) return null;

    return {
        componentName: 'GetSingleDataNode',
        nodeName: getNodeName(node),
        appNameSource: 'direct',
        dependency: {
            appName,
            formTitle,
            appType: getData.appType || targetItem.appType || '',
            formUuid
        },
        appRefs: [
            createRef(getData, 'appType'),
            createRef(targetItem, 'appType')
        ],
        formRefs
    };
};

const extractAddDataNode = (node, context = {}) => {
    const rules = node?.props?.addDataRules;
    const crossForm = rules?.crossForm || {};
    const crossFormItem = crossForm?.formItem || {};
    if (!rules) return null;

    const isSubTableInsert = rules.insertType === 'sub_table';
    let parentDependency = null;
    if (isSubTableInsert && rules.formUuid && context?.nodeById && !context?.resolvingNodeIds?.has(rules.formUuid)) {
        const parentNode = context.nodeById.get(rules.formUuid);
        if (parentNode && parentNode !== node) {
            const resolvingNodeIds = new Set(context.resolvingNodeIds || []);
            resolvingNodeIds.add(rules.formUuid);
            parentDependency = extractDependencyFromNode(parentNode, { ...context, resolvingNodeIds })?.dependency || null;
        }
    }

    const directAppName = firstText(crossForm.appName, rules.appName);
    const appName = firstText(directAppName, parentDependency?.appName);
    const formTitle = firstText(
        crossForm.formTitle,
        rules.formTitle,
        crossFormItem.title,
        crossFormItem.formName,
        crossFormItem.tableName,
        parentDependency?.formTitle
    );
    const formUuid = isValidFormUuid(rules.formUuid)
        ? rules.formUuid
        : isValidFormUuid(crossFormItem.formUuid)
            ? crossFormItem.formUuid
            : parentDependency?.formUuid || '';
    const formRefs = [
        createFormRefIfValid(rules, 'formUuid'),
        createFormRefIfValid(crossFormItem, 'formUuid')
    ].filter(Boolean);

    if (!formTitle && !(isSubTableInsert && rules.formUuid)) return null;
    if (!formUuid && !isSubTableInsert) return null;

    const appRefs = [createRef(rules, 'appType')];
    if (!isSubTableInsert || firstText(crossForm.appName, crossForm.formTitle) || isValidFormUuid(crossForm.formUuid)) {
        appRefs.push(createRef(crossForm, 'appType'));
    }

    return {
        componentName: 'AddDataNode',
        nodeName: getNodeName(node),
        allowContextAppNameFallback: false,
        appNameSource: directAppName ? 'direct' : (parentDependency?.appName ? 'parent' : ''),
        dependency: {
            appName,
            contextAppName: firstText(context?.appName),
            formTitle,
            appType: rules.appType || parentDependency?.appType || crossForm.appType || '',
            formUuid,
            parentNodeId: isSubTableInsert ? rules.formUuid || '' : '',
            parentNodeResolved: isSubTableInsert ? Boolean(parentDependency) : true
        },
        appRefs,
        formRefs
    };
};

const extractDirectFormRulesNode = (node, context, ruleKeys, componentName) => {
    for (const key of ruleKeys) {
        const rules = node?.props?.[key];
        if (!rules || rules.type !== 'direct_form') continue;

        const formUuid = isValidFormUuid(rules.sourceId)
            ? rules.sourceId
            : isValidFormUuid(rules.formUuid)
                ? rules.formUuid
                : '';
        const formRefs = [
            createFormRefIfValid(rules, 'sourceId'),
            createFormRefIfValid(rules, 'formUuid')
        ].filter(Boolean);
        const directAppName = firstText(rules.appName);
        const appName = firstText(directAppName, context?.appName);
        const formTitle = firstText(rules.formTitle, context?.flowFormName);

        if (!formTitle || !formUuid) return null;

        return {
            componentName,
            nodeName: getNodeName(node),
            appNameSource: directAppName ? 'direct' : (appName ? 'context' : ''),
            dependency: {
                appName,
                formTitle,
                appType: rules.appType || context?.appId || '',
                formUuid
            },
            appRefs: [createRef(rules, 'appType')],
            formRefs
        };
    }

    return null;
};

const extractUpdateDataNode = (node, context) => {
    const directFormRecord = extractDirectFormRulesNode(node, context, ['updateDataRules'], 'UpdateDataNode');
    if (directFormRecord) return directFormRecord;
    return null;
};

const getEmbeddedFormUuid = (value) => {
    if (isValidFormUuid(value?.formUuid)) return { key: 'formUuid', value: value.formUuid };
    if (isValidFormUuid(value?.formId)) return { key: 'formId', value: value.formId };
    return null;
};
const getUniquePatternMatches = (text, pattern) => Array.from(new Set((text.match(pattern) || [])));
const isFormulaDependencyString = (text) => (
    typeof text === 'string' &&
    /APP_[A-Z0-9]+/.test(text) &&
    /FORM-[A-Z0-9]+/.test(text) &&
    (text.includes('${') || text.includes('#{') || /\b(IF|CONCATENATE|ISEMPTY)\s*\(/i.test(text))
);

const collectDataRuleEmbeddedDependencies = (node, context = {}, ruleKey, scopeKeys = []) => {
    const dataRules = node?.props?.[ruleKey] || {};
    const records = [];
    const seen = new WeakSet();
    const getEmbeddedComponentName = (label, fallback) => `${node?.componentName || 'DataNode'} / ${label || fallback}`;
    const appendRecord = (record) => {
        const dependency = record.dependency || {};
        const key = [
            record.componentName,
            dependency.sourceKind || '',
            dependency.appType || '',
            dependency.formUuid || '',
            dependency.appName || '',
            dependency.formTitle || ''
        ].join('|');
        const existing = records.find(item => item._mergeKey === key);
        if (!existing) {
            records.push({ ...record, _mergeKey: key });
            return;
        }

        existing.appRefs.push(...(record.appRefs || []));
        existing.formRefs.push(...(record.formRefs || []));
        existing.processRefs.push(...(record.processRefs || []));
        const sourcePaths = new Set([
            ...(existing.dependency.sourcePaths || [existing.dependency.sourcePath].filter(Boolean)),
            ...(dependency.sourcePaths || [dependency.sourcePath].filter(Boolean))
        ]);
        existing.dependency.sourcePaths = Array.from(sourcePaths);
        existing.dependency.sourcePath = existing.dependency.sourcePaths.join(' | ');
    };

    const walk = (value, path = '', inAssociationFormField = false, ownerLabel = '') => {
        if (!value || typeof value !== 'object') return;
        if (seen.has(value)) return;
        seen.add(value);

        if (Array.isArray(value)) {
            value.forEach((item, index) => walk(item, `${path}[${index}]`, inAssociationFormField, ownerLabel));
            return;
        }

        const shouldScanDependency = inAssociationFormField || value.componentName === 'AssociationFormField';
        const currentLabel = firstText(value.label, value.props?.label, value.name, value.fieldId, ownerLabel);
        const formRef = shouldScanDependency ? getEmbeddedFormUuid(value) : null;
        const appType = shouldScanDependency ? value.appType || '' : '';
        if (shouldScanDependency && appType && formRef) {
            const appName = firstText(value.appName);
            const formTitle = firstText(value.formTitle, value.title, value.formName, value.tableName);
            appendRecord({
                componentName: getEmbeddedComponentName(currentLabel, '\u5173\u8054\u7ec4\u4ef6'),
                nodeName: getNodeName(node),
                appNameSource: appName ? 'direct' : '',
                allowContextAppNameFallback: false,
                dependency: {
                    appName,
                    contextAppName: firstText(context?.appName),
                    formTitle,
                    appType,
                    formUuid: formRef.value,
                    sourceKind: '\u5173\u8054\u7ec4\u4ef6',
                    sourcePath: path
                },
                appRefs: [createRef(value, 'appType')],
                formRefs: [createRef(value, formRef.key)],
                processRefs: []
            });
        }

        Object.entries(value).forEach(([key, child]) => {
            const childPath = path ? `${path}.${key}` : key;
            if ((shouldScanDependency || isFormulaDependencyString(child)) && typeof child === 'string') {
                const appTypes = getUniquePatternMatches(child, /APP_[A-Z0-9]+/g);
                const formUuids = getUniquePatternMatches(child, /FORM-[A-Z0-9]+/g);
                if (appTypes.length === 1 && formUuids.length === 1) {
                    appendRecord({
                        componentName: getEmbeddedComponentName(currentLabel, '\u516c\u5f0f'),
                        nodeName: getNodeName(node),
                        appNameSource: '',
                        allowContextAppNameFallback: false,
                        dependency: {
                            appName: '',
                            contextAppName: firstText(context?.appName),
                            formTitle: '',
                            appType: appTypes[0],
                            formUuid: formUuids[0],
                            sourceKind: '\u516c\u5f0f',
                            sourcePath: childPath
                        },
                        appRefs: [createStringTokenRef(value, key, appTypes[0])],
                        formRefs: [createStringTokenRef(value, key, formUuids[0])],
                        processRefs: []
                    });
                }
            } else if (child && typeof child === 'object') {
                walk(child, childPath, shouldScanDependency, currentLabel);
            }
        });
    };

    scopeKeys.forEach(key => walk(dataRules?.[key], `${ruleKey}.${key}`));
    return records.map(({ _mergeKey, ...record }) => record);
};
const collectAddDataEmbeddedDependencies = (node, context = {}) => (
    collectDataRuleEmbeddedDependencies(node, context, 'addDataRules', ['inputs', 'rules'])
);

const collectUpdateDataEmbeddedDependencies = (node, context = {}) => (
    collectDataRuleEmbeddedDependencies(node, context, 'updateDataRules', [
        'assignments',
        'condition',
        'subCondition',
        'rulesFilter',
        'tableRulesFilter'
    ])
);

const extractInitiateApprovalNode = (node, context = {}) => {
    const rules = node?.props?.initiateApprovalRules;
    if (!rules) return null;

    const formTitle = firstText(rules.formTitle, extractBracketText(rules.description));
    const formUuid = isValidFormUuid(rules.formUuid) ? rules.formUuid : '';
    if (!formTitle || !formUuid) return null;

    return {
        componentName: 'InitiateApprovalNode',
        nodeName: getNodeName(node),
        allowContextAppNameFallback: false,
        appNameSource: firstText(rules.appName) ? 'direct' : '',
        dependency: {
            appName: firstText(rules.appName),
            contextAppName: firstText(context?.appName),
            formTitle,
            processName: formTitle,
            appType: rules.appType || '',
            formUuid,
            processCode: rules.processCode || ''
        },
        appRefs: [createRef(rules, 'appType')],
        formRefs: [createFormRefIfValid(rules, 'formUuid')].filter(Boolean),
        processRefs: [createRef(rules, 'processCode')].filter(ref => ref.value)
    };
};

const extractDependencyFromNode = (node, context = {}) => {
    switch (node.componentName) {
        case 'GetSingleDataNode':
            return extractGetSingleDataNode(node);
        case 'AddDataNode':
            return extractAddDataNode(node, context);
        case 'UpdateDataNode':
            return extractUpdateDataNode(node, context);
        case 'InitiateApprovalNode':
            return extractInitiateApprovalNode(node, context);
        default:
            return null;
    }
};

const collectDependencies = (root, records = [], unhandled = new Map(), context = {}, seen = new WeakSet()) => {
    if (!root || typeof root !== 'object') return { records, unhandled };
    if (seen.has(root)) return { records, unhandled };
    seen.add(root);

    if (Array.isArray(root)) {
        root.forEach(item => collectDependencies(item, records, unhandled, context, seen));
        return { records, unhandled };
    }

    const componentName = root.componentName;
    if (componentName) {
        const record = extractDependencyFromNode(root, context);
        if (record) {
            records.push(record);
        } else if (componentName !== 'CanvasEngine' && componentName !== 'StartNode' && componentName !== 'EndNode') {
            if (!unhandled.has(componentName)) unhandled.set(componentName, root);
        }
        if (componentName === 'AddDataNode') {
            records.push(...collectAddDataEmbeddedDependencies(root, context));
        }
        if (componentName === 'UpdateDataNode') {
            records.push(...collectUpdateDataEmbeddedDependencies(root, context));
        }
    }

    Object.values(root).forEach(value => {
        if (value && typeof value === 'object') collectDependencies(value, records, unhandled, context, seen);
    });

    return { records, unhandled };
};

const collectNodesById = (root, nodeById = new Map(), seen = new WeakSet()) => {
    if (!root || typeof root !== 'object') return nodeById;
    if (seen.has(root)) return nodeById;
    seen.add(root);

    if (Array.isArray(root)) {
        root.forEach(item => collectNodesById(item, nodeById, seen));
        return nodeById;
    }

    if (root.id && root.componentName) nodeById.set(root.id, root);
    Object.values(root).forEach(value => {
        if (value && typeof value === 'object') collectNodesById(value, nodeById, seen);
    });
    return nodeById;
};

const collectComponentCounts = (root) => {
    const counts = new Map();
    const walk = (node) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
            node.forEach(walk);
            return;
        }
        if (node.componentName) {
            counts.set(node.componentName, (counts.get(node.componentName) || 0) + 1);
        }
        Object.values(node).forEach(value => {
            if (value && typeof value === 'object') walk(value);
        });
    };
    walk(root);
    return counts;
};

const buildScanStats = (content, records, issues) => {
    const totalCounts = collectComponentCounts(content);
    const extractedCounts = new Map();
    const issueCounts = new Map();

    records.forEach(record => {
        const name = record.componentName || 'Unknown';
        extractedCounts.set(name, (extractedCounts.get(name) || 0) + 1);
    });
    issues.forEach(issue => {
        const name = issue.componentName || 'Unknown';
        issueCounts.set(name, (issueCounts.get(name) || 0) + 1);
    });

    const names = Array.from(new Set([
        ...Array.from(totalCounts.keys()),
        ...Array.from(extractedCounts.keys()),
        ...Array.from(issueCounts.keys())
    ])).sort();
    const components = names.map(name => {
        const total = totalCounts.get(name) || 0;
        const extracted = extractedCounts.get(name) || 0;
        const issueCount = issueCounts.get(name) || 0;
        return {
            componentName: name,
            total,
            extracted,
            passed: Math.max(extracted - issueCount, 0),
            skipped: Math.max(total - extracted, 0),
            issues: issueCount
        };
    });
    const byComponent = {};
    components.forEach(item => {
        byComponent[item.componentName] = item;
    });

    return {
        components,
        byComponent,
        totals: components.reduce((acc, item) => ({
            total: acc.total + item.total,
            extracted: acc.extracted + item.extracted,
            passed: acc.passed + item.passed,
            skipped: acc.skipped + item.skipped,
            issues: acc.issues + item.issues
        }), { total: 0, extracted: 0, passed: 0, skipped: 0, issues: 0 })
    };
};

const createDependencyIndex = () => ({
    appNameByAppType: new Map(),
    formTitleByFormUuid: new Map(),
    appTypeByFormUuid: new Map()
});

const collectDependencyHints = (root, index = createDependencyIndex(), seen = new WeakSet()) => {
    if (!root || typeof root !== 'object') return index;
    if (seen.has(root)) return index;
    seen.add(root);

    if (Array.isArray(root)) {
        root.forEach(item => collectDependencyHints(item, index, seen));
        return index;
    }

    const formItem = root.formItem || {};
    const appType = root.appType || '';
    const appName = firstText(root.appName);
    const formUuid = root.formUuid || root.formId || formItem.formUuid || formItem.formId || '';
    const directFormTitle = firstText(root.formTitle, root.formName, root.tableName);
    const formTitle = firstText(directFormTitle, formItem.title, formItem.formName, formItem.tableName, root.title);
    const canLinkAppName = Boolean(
        appType &&
        appName &&
        (root.formItem || root.formUuid || root.formId || directFormTitle)
    );

    if (canLinkAppName && !index.appNameByAppType.has(appType)) {
        index.appNameByAppType.set(appType, appName);
    }
    if (isValidFormUuid(formUuid) && formTitle && !index.formTitleByFormUuid.has(formUuid)) {
        index.formTitleByFormUuid.set(formUuid, formTitle);
    }
    if (isValidFormUuid(formUuid) && appType && !index.appTypeByFormUuid.has(formUuid)) {
        index.appTypeByFormUuid.set(formUuid, appType);
    }

    Object.values(root).forEach(value => {
        if (value && typeof value === 'object') collectDependencyHints(value, index, seen);
    });

    return index;
};

const findMatchedApp = (fullStructure, sourceAppName) => {
    if (!sourceAppName) return null;
    return fullStructure.find(app => isFuzzyMatch(sourceAppName, firstText(app.appName, app.appOriginalName, app.name))) || null;
};

const findMatchedForms = (fullStructure, sourceFormTitle, targetApp = null) => {
    if (!sourceFormTitle) return [];
    const apps = targetApp ? [targetApp] : fullStructure;
    const matches = [];
    for (const app of apps) {
        for (const form of app.forms || []) {
            if (isFormNameMatch(sourceFormTitle, firstText(form.formName, form.title))) {
                matches.push({ app, form });
            }
        }
    }
    return matches;
};

const findAppById = (fullStructure, appId) => {
    if (!appId) return null;
    return fullStructure.find(app => app.appId === appId || app.appType === appId) || null;
};
const findFormById = (app, formId) => {
    if (!app || !formId) return null;
    return (app.forms || []).find(form => getFormId(form) === formId) || null;
};
const findFormMatchesById = (fullStructure, formId) => {
    if (!formId) return [];
    const matches = [];
    for (const app of fullStructure || []) {
        const form = findFormById(app, formId);
        if (form) matches.push({ app, form });
    }
    return matches;
};
const findFlowMatchesByProcessCode = (fullStructure, flowsByAppId = new Map(), processCode) => {
    if (!processCode) return [];
    const matches = [];
    for (const [appId, flows] of flowsByAppId.entries()) {
        const flow = (flows || []).find(item => item.processCode === processCode);
        if (!flow) continue;
        const app = findAppById(fullStructure, appId);
        const formId = getFlowFormUuid(flow);
        const form = findFormById(app, formId);
        matches.push({ app, form, flow, formId });
    }
    return matches.filter(item => item.app);
};
const hasSingleValue = (values) => values.length > 0 && new Set(values).size === 1;
const isRecordAlreadyResolved = (record, fullStructure, flowsByAppId = new Map()) => {
    const appIds = record.appRefs.map(ref => ref.value).filter(Boolean);
    const formIds = record.formRefs.map(ref => ref.value).filter(Boolean);
    const processCodes = (record.processRefs || []).map(ref => ref.value).filter(Boolean);

    if (!hasSingleValue(appIds) || !hasSingleValue(formIds)) return false;

    const currentAppId = appIds[0];
    const currentFormId = formIds[0];
    const currentApp = findAppById(fullStructure, currentAppId);
    const currentForm = findFormById(currentApp, currentFormId);
    if (!currentApp || !currentForm) return false;

    if (!processCodes.length) return true;
    if (!hasSingleValue(processCodes)) return false;

    const flows = flowsByAppId.get(currentApp.appId || currentApp.appType || '') || [];
    if (!flows.length) return true;

    const formRelatedFlows = flows.filter(flow => getFlowFormUuid(flow) === currentFormId);
    if (!formRelatedFlows.length) return true;

    return formRelatedFlows.some(flow =>
        flow.processCode === processCodes[0] &&
        (!getFlowFormUuid(flow) || getFlowFormUuid(flow) === currentFormId)
    );
};

const validateRecordByCurrentFormId = (record, fullStructure, flowsByAppId = new Map()) => {
    const formIds = record.formRefs.map(ref => ref.value).filter(Boolean);
    const processCodes = (record.processRefs || []).map(ref => ref.value).filter(Boolean);
    if (!hasSingleValue(formIds) && !hasSingleValue(processCodes)) return null;

    const formMatches = hasSingleValue(formIds) ? findFormMatchesById(fullStructure, formIds[0]) : [];
    const processMatches = formMatches.length === 1 || !hasSingleValue(processCodes)
        ? []
        : findFlowMatchesByProcessCode(fullStructure, flowsByAppId, processCodes[0]);
    if (formMatches.length !== 1 && processMatches.length !== 1) return null;

    const idMatch = formMatches.length === 1 ? formMatches[0] : processMatches[0];
    const { app: targetApp, form: targetForm } = idMatch;
    const targetAppId = targetApp.appId || targetApp.appType || '';
    const targetFormId = getFormId(targetForm) || idMatch.formId || '';
    const currentAppIds = record.appRefs.map(ref => ref.value).filter(Boolean);
    const currentFormIds = formIds;
    const currentProcessCodes = processCodes;
    const matchedFlow = idMatch.flow || (record.processRefs?.length
        ? findMatchedFlow(flowsByAppId, targetAppId, record.dependency?.processName || record.dependency?.formTitle, targetFormId)
        : null);
    const targetProcessCode = matchedFlow?.processCode || '';
    const appNeedsFix = currentAppIds.some(id => id !== targetAppId);
    const formNeedsFix = currentFormIds.some(id => id !== targetFormId);
    const processNeedsFix = Boolean(targetProcessCode && currentProcessCodes.some(code => code !== targetProcessCode));

    if (!appNeedsFix && !formNeedsFix && !processNeedsFix) return null;

    return {
        ...record,
        type: [
            appNeedsFix ? 'APP' : '',
            formNeedsFix ? 'FORM' : '',
            processNeedsFix ? 'PROCESS' : ''
        ].filter(Boolean).join('_') + '_ID_MISMATCH',
        message: 'ID mismatch with current organization',
        matchedApp: targetApp,
        matchedForm: targetForm,
        matchedFlow,
        targetAppId,
        targetFormId,
        targetProcessCode,
        canFix: Boolean(targetAppId && targetFormId)
    };
};

const getFlowName = (flow) => firstText(flow?.name, flow?.title, flow?.flowName);
const getFlowFormUuid = (flow) => flow?.formUuid || flow?.formId || flow?.id || '';
const findMatchedFlow = (flowsByAppId, targetAppId, sourceProcessName, targetFormId) => {
    const flows = flowsByAppId?.get(targetAppId) || [];
    if (!flows.length) return null;

    const byFormAndName = flows.find(flow => {
        const sameForm = targetFormId && getFlowFormUuid(flow) === targetFormId;
        const flowName = getFlowName(flow);
        return sameForm && (!sourceProcessName || isFormNameMatch(sourceProcessName, flowName) || isFuzzyMatch(sourceProcessName, flowName));
    });
    if (byFormAndName) return byFormAndName;

    if (targetFormId) {
        const byForm = flows.find(flow => getFlowFormUuid(flow) === targetFormId);
        if (byForm) return byForm;
    }

    if (!sourceProcessName) return null;
    return flows.find(flow => {
        const flowName = getFlowName(flow);
        return isFormNameMatch(sourceProcessName, flowName) || isFuzzyMatch(sourceProcessName, flowName);
    }) || null;
};

const buildDependencyIndex = (records, hintIndex = createDependencyIndex()) => {
    const appNameByAppType = new Map(hintIndex.appNameByAppType || []);
    const formTitleByFormUuid = new Map(hintIndex.formTitleByFormUuid || []);
    const appTypeByFormUuid = new Map(hintIndex.appTypeByFormUuid || []);
    records.forEach(record => {
        const dependency = record.dependency || {};
        if (dependency.formUuid && dependency.formTitle && !formTitleByFormUuid.has(dependency.formUuid)) {
            formTitleByFormUuid.set(dependency.formUuid, dependency.formTitle);
        }
        if (dependency.formUuid && dependency.appType && !appTypeByFormUuid.has(dependency.formUuid)) {
            appTypeByFormUuid.set(dependency.formUuid, dependency.appType);
        }
    });
    return { appNameByAppType, formTitleByFormUuid, appTypeByFormUuid };
};

const enrichRecordByDependencyIndex = (record, dependencyIndex) => {
    const dependency = { ...(record.dependency || {}) };
    const indexedAppType = dependency.appType || dependencyIndex.appTypeByFormUuid.get(dependency.formUuid) || '';
    let appNameSource = record.appNameSource || (dependency.appName ? 'direct' : '');
    if (!dependency.appType && indexedAppType) dependency.appType = indexedAppType;
    if (!dependency.appName && indexedAppType) {
        const indexedAppName = dependencyIndex.appNameByAppType.get(indexedAppType) || '';
        if (indexedAppName) {
            dependency.appName = indexedAppName;
            appNameSource = 'index';
        }
    }
    if (!dependency.appName && dependency.contextAppName && record.allowContextAppNameFallback !== false) {
        dependency.appName = dependency.contextAppName;
        appNameSource = 'context';
    }
    if (!dependency.formTitle && dependency.formUuid) dependency.formTitle = dependencyIndex.formTitleByFormUuid.get(dependency.formUuid) || '';
    dependency.appNameSource = appNameSource;
    return { ...record, dependency };
};

const validateRecord = (record, fullStructure, flowsByAppId = new Map()) => {
    const { dependency } = record;
    if (isRecordAlreadyResolved(record, fullStructure, flowsByAppId)) return null;

    if (dependency.parentNodeId && dependency.parentNodeResolved === false) {
        return {
            ...record,
            type: 'NOT_PARENT_NODE',
            message: `sub_table parent node not found or not extractable: ${dependency.parentNodeId}`,
            matchedApp: null,
            matchedForm: null,
            canFix: false
        };
    }

    const currentFormIdIssue = validateRecordByCurrentFormId(record, fullStructure, flowsByAppId);
    if (currentFormIdIssue) return currentFormIdIssue;

    const matchedApp = findMatchedApp(fullStructure, dependency.appName);

    if (!dependency.appName) {
        return {
            ...record,
            type: 'NOT_APP_NAME',
            message: '未记录源应用名称，无法先匹配应用',
            matchedApp: null,
            matchedForm: null,
            canFix: false
        };
    }

    if (dependency.appName && !matchedApp) {
        return {
            ...record,
            type: 'NOT_APP',
            message: `未找到目标应用 ${getBusinessName(dependency.appName)}`,
            matchedApp: null,
            matchedForm: null,
            canFix: false
        };
    }

    if (!dependency.formTitle) {
        return {
            ...record,
            type: 'NOT_FORM_NAME',
            message: '未记录源表单名称，无法按名称匹配',
            matchedApp,
            matchedForm: null,
            canFix: false
        };
    }

    const formMatches = findMatchedForms(fullStructure, dependency.formTitle, matchedApp);

    if (formMatches.length === 0) {
        return {
            ...record,
            type: 'NOT_FORM',
            message: `未找到目标表单 ${dependency.appName || '-'} / ${getBusinessName(dependency.formTitle)}`,
            matchedApp,
            matchedForm: null,
            canFix: false
        };
    }

    if (formMatches.length > 1) {
        return {
            ...record,
            type: 'AMBIGUOUS_FORM',
            message: `应用内存在多个同名表单 ${firstText(matchedApp.appName)} / ${getBusinessName(dependency.formTitle)}`,
            matchedApp,
            matchedForm: null,
            canFix: false
        };
    }

    const { app: targetApp, form: targetForm } = formMatches[0];
    const targetAppId = targetApp.appId || targetApp.appType || '';
    const targetFormId = getFormId(targetForm);
    const matchedFlow = record.processRefs?.length
        ? findMatchedFlow(flowsByAppId, targetAppId, dependency.processName || dependency.formTitle, targetFormId)
        : null;
    const targetProcessCode = matchedFlow?.processCode || '';
    const currentAppIds = record.appRefs.map(ref => ref.value).filter(Boolean);
    const currentFormIds = record.formRefs.map(ref => ref.value).filter(Boolean);
    const currentProcessCodes = (record.processRefs || []).map(ref => ref.value).filter(Boolean);
    const appNeedsFix = currentAppIds.some(id => id !== targetAppId);
    const formNeedsFix = currentFormIds.some(id => id !== targetFormId);
    const processNeedsFix = currentProcessCodes.some(code => code !== targetProcessCode);

    if (currentProcessCodes.length > 0 && !targetProcessCode) {
        return {
            ...record,
            type: 'NOT_PROCESS',
            message: `未找到目标流程 ${dependency.processName || dependency.formTitle || dependency.processCode || '-'}`,
            matchedApp: targetApp,
            matchedForm: targetForm,
            matchedFlow: null,
            targetAppId,
            targetFormId,
            targetProcessCode: '',
            canFix: false
        };
    }

    if (!appNeedsFix && !formNeedsFix && !processNeedsFix) return null;

    return {
        ...record,
        type: [
            appNeedsFix ? 'APP' : '',
            formNeedsFix ? 'FORM' : '',
            processNeedsFix ? 'PROCESS' : ''
        ].filter(Boolean).join('_') + '_ID_MISMATCH',
        message: '源组件 ID 与当前组织匹配结果不一致',
        matchedApp: targetApp,
        matchedForm: targetForm,
        matchedFlow,
        targetAppId,
        targetFormId,
        targetProcessCode,
        canFix: Boolean(targetAppId && targetFormId && (currentProcessCodes.length === 0 || targetProcessCode))
    };
};

const validateDependencies = (records, fullStructure, flowsByAppId = new Map(), hintIndex = createDependencyIndex()) => {
    const dependencyIndex = buildDependencyIndex(records, hintIndex);
    return records
        .map(record => validateRecord(enrichRecordByDependencyIndex(record, dependencyIndex), fullStructure, flowsByAppId))
        .filter(Boolean);
};

const replaceRefValues = (refs, newValue) => {
    let changed = 0;
    refs.forEach(ref => {
        if (ref.holder && ref.key && ref.value && newValue && ref.replaceInString && typeof ref.holder[ref.key] === 'string') {
            const nextValue = ref.holder[ref.key].split(ref.value).join(newValue);
            if (nextValue !== ref.holder[ref.key]) {
                ref.holder[ref.key] = nextValue;
                ref.value = newValue;
                changed++;
            }
            return;
        }
        if (ref.holder && ref.key && ref.value && newValue && ref.holder[ref.key] !== newValue) {
            ref.holder[ref.key] = newValue;
            ref.value = newValue;
            changed++;
        }
    });
    return changed;
};

export default function FlowFix() {
    const [searching, setSearching] = useState(false);
    const [fixing, setFixing] = useState(false);
    const [fixProgress, setFixProgress] = useState({ current: 0, total: 0, flowName: '', appName: '', formName: '' });
    const [fixSummary, setFixSummary] = useState({ total: 0, success: 0, failed: 0 });
    const [fixNodes, setFixNodes] = useState([]);
    const [onlyShowFailed, setOnlyShowFailed] = useState(false);
    const [detailNode, setDetailNode] = useState(null);

    const handleSearch = async () => {
        setSearching(true);
        setFixNodes([]);
        setFixSummary({ total: 0, success: 0, failed: 0 });
        setFixProgress({ current: 0, total: 0, flowName: '', appName: '', formName: '' });

        await global.services.getFullAppStructureByInitialization();
        const fullStructure = global.info.appStructure || [];
        if (!fullStructure.length) {
            Utils.toast({ title: '检索失败，应用结构为空', type: 'error' });
            setSearching(false);
            return;
        }

        const allForms = fullStructure.flatMap(app =>
            (app.forms || []).map(form => ({
                ...form,
                _parentAppId: app.appId,
                _parentAppName: firstText(app.appName),
            }))
        );

        const results = [];
        const unhandledComponents = new Map();
        const flowsByAppId = new Map();
        const scannedFlows = [];
        const globalDependencyHints = createDependencyIndex();

        for (const app of fullStructure) {
            let flows;
            try {
                flows = await global.services.getAllFlows(app.appId);
            } catch (e) {
                console.warn(`获取应用 [${firstText(app.appName)}] 的集成自动化列表失败:`, e.message);
                continue;
            }
            flowsByAppId.set(app.appId || app.appType || '', flows || []);

            if (!flows || !flows.length) continue;

            for (const flow of flows) {
                if (!flow.processCode) continue;

                let processInfoRes;
                try {
                    processInfoRes = await global.services.getProcess(flow.processCode, app.appId);
                } catch (e) {
                    console.warn(`获取流程 [${firstText(flow.name) || flow.processCode}] 失败:`, e.message);
                    continue;
                }

                if (!processInfoRes || !processInfoRes.content) continue;

                let parsed;
                try {
                    parsed = typeof processInfoRes.content === 'string'
                        ? JSON.parse(processInfoRes.content)
                        : processInfoRes.content;
                } catch (e) {
                    console.warn(`解析流程 [${firstText(flow.name) || flow.processCode}] 失败:`, e.message);
                    continue;
                }

                const flowName = firstText(flow.name) || flow.processCode;
                const flowForm = allForms.find(form => form.formId === flow.formUuid || form.formUuid === flow.formUuid || form.id === flow.formUuid);
                const flowFormName = flowForm ? firstText(flowForm.formName, flowForm.title) : '';
                const flowContext = {
                    appId: app.appId,
                    appName: firstText(app.appName),
                    flowFormUuid: flow.formUuid || '',
                    flowFormName,
                    nodeById: collectNodesById(parsed)
                };

                const { records, unhandled } = collectDependencies(parsed, [], new Map(), flowContext);
                collectDependencyHints(parsed, globalDependencyHints);
                unhandled.forEach((node, componentName) => {
                    if (!unhandledComponents.has(componentName)) unhandledComponents.set(componentName, node);
                });

                scannedFlows.push({
                    processCode: flow.processCode,
                    processName: flowName,
                    appId: app.appId,
                    appName: firstText(app.appName),
                    formUuid: flow.formUuid || "",
                    flowFormName,
                    content: parsed,
                    records
                });
            }
        }

        scannedFlows.forEach(flowItem => {
            const issues = validateDependencies(flowItem.records, fullStructure, flowsByAppId, globalDependencyHints);
            const scanStats = buildScanStats(flowItem.content, flowItem.records, issues);
            const extractableSkippedStats = scanStats.components.filter(item =>
                item.skipped > 0 && isExtractableDependencyComponent(item.componentName)
            );
            if (extractableSkippedStats.length > 0) {
                debugFlowFix('[FlowFix] extractable dependency node coverage', {
                    flowName: flowItem.processName,
                    processCode: flowItem.processCode,
                    stats: extractableSkippedStats
                });
            }

            const coverageSkippedStats = scanStats.components.filter(item =>
                item.skipped > 0 && !isExtractableDependencyComponent(item.componentName)
            );
            if (coverageSkippedStats.length > 0) {
                debugFlowFix('[FlowFix] node coverage', {
                    flowName: flowItem.processName,
                    processCode: flowItem.processCode,
                    stats: coverageSkippedStats
                });
            }
            if (issues.length === 0) return;

            results.push({
                ...flowItem,
                issues,
                scanStats,
                fixStatus: 'pending',
                fixMessage: ''
            });
        });

        if (unhandledComponents.size > 0) {
            debugFlowFix('[FlowFix] 未处理的集成自动化组件类型:', Array.from(unhandledComponents.keys()));
        }

        setFixNodes(results);
        setFixSummary({ total: results.length, success: 0, failed: 0 });
        setSearching(false);
        Utils.toast({
            title: `检索完成，共发现 ${results.length} 个存在依赖问题的集成自动化`,
            type: results.length > 0 ? 'warn' : 'success'
        });
    };

    const handleFix = async () => {
        if (fixing || fixNodes.length === 0) return;

        const total = fixNodes.length;
        let successCount = 0;
        let failedCount = 0;
        const fixNodesSuccess = [];

        setFixing(true);
        setFixSummary({ total, success: 0, failed: 0 });
        setFixProgress({ current: 0, total, flowName: '', appName: '', formName: '' });
        setFixNodes(prev => prev.map(node => ({ ...node, fixStatus: 'pending', fixMessage: '' })));

        for (let nodeIndex = 0; nodeIndex < fixNodes.length; nodeIndex++) {
            const node = fixNodes[nodeIndex];
            const prevAppId = global.info.appId;
            let changedRefCount = 0;

            setFixProgress({
                current: nodeIndex + 1,
                total,
                flowName: node.processName || node.processCode || '',
                appName: node.appName || '',
                formName: node.flowFormName || ''
            });
            setFixNodes(prev => prev.map(item => item.processCode === node.processCode ? { ...item, fixStatus: 'running', fixMessage: '正在分析依赖并生成映射...' } : item));

            for (const issue of node.issues) {
                const dependency = issue.dependency || {};
                const issueAppName = issue.appName || dependency.appName || '';
                const issueFormTitle = issue.formTitle || dependency.formTitle || '';
                let targetAppId = issue.targetAppId || '';
                let targetFormId = issue.targetFormId || '';
                let targetProcessCode = issue.targetProcessCode || '';

                if ((!targetAppId || !targetFormId) && issueAppName && issueFormTitle) {
                    const matchedApp = findMatchedApp(global.info.appStructure || [], issueAppName);
                    const formMatches = matchedApp
                        ? findMatchedForms(global.info.appStructure || [], issueFormTitle, matchedApp)
                        : [];

                    if (formMatches.length === 1) {
                        const { app: targetApp, form: matchedForm } = formMatches[0];
                        targetAppId = targetApp.appId || targetApp.appType || targetAppId;
                        targetFormId = getFormId(matchedForm) || targetFormId;
                    }
                }

                changedRefCount += replaceRefValues(issue.appRefs || [], targetAppId);
                changedRefCount += replaceRefValues(issue.formRefs || [], targetFormId);
                changedRefCount += replaceRefValues(issue.processRefs || [], targetProcessCode);
            }

            if (changedRefCount === 0) {
                const message = `流程 [${node.processName}] 无可匹配项，跳过`;
                failedCount++;
                setFixNodes(prev => prev.map(item => item.processCode === node.processCode ? { ...item, fixStatus: 'failed', fixMessage: message } : item));
                setFixSummary({ total, success: successCount, failed: failedCount });
                Utils.toast({ title: message, type: 'warn' });
                continue;
            }

            global.info.appId = node.appId;
            try {
                const jsonStr = JSON.stringify(node.content);
                const res = await ProcessService.saveProcess(node.formUuid, node.processCode, jsonStr, jsonStr, 'true');
                if (res && res.success) {
                    fixNodesSuccess.push(node);
                    successCount++;
                    setFixNodes(prev => prev.map(item => item.processCode === node.processCode ? { ...item, fixStatus: 'success', fixMessage: '已更新并保存成功' } : item));
                } else {
                    failedCount++;
                    const message = `保存流程 [${node.processName}] 失败: ${res?.errorMsg || '未知错误'}`;
                    setFixNodes(prev => prev.map(item => item.processCode === node.processCode ? { ...item, fixStatus: 'failed', fixMessage: message } : item));
                    Utils.toast({ title: message, type: 'error' });
                }
            } catch (e) {
                failedCount++;
                const message = `保存流程 [${node.processName}] 失败: ${e.message}`;
                console.error(message, e);
                setFixNodes(prev => prev.map(item => item.processCode === node.processCode ? { ...item, fixStatus: 'failed', fixMessage: message } : item));
                Utils.toast({ title: message, type: 'error' });
            } finally {
                global.info.appId = prevAppId;
                setFixSummary({ total, success: successCount, failed: failedCount });
            }
        }

        if (fixNodesSuccess.length > 0) {
            const successCodes = new Set(fixNodesSuccess.map(node => node.processCode));
            setFixNodes(prev => prev.filter(node => !successCodes.has(node.processCode)));
        }

        setFixing(false);
        setFixProgress(prev => ({ ...prev, current: total, flowName: '', appName: '', formName: '' }));
        Utils.toast({ title: `修复完成: ${successCount}/${total}`, type: successCount > 0 ? 'success' : 'warn' });
    };

    const statusStyleMap = {
        pending: { text: '待处理', color: '#999', bg: '#f5f5f5', border: '#d9d9d9' },
        running: { text: '修复中', color: '#1890ff', bg: '#f0f5ff', border: '#91d5ff' },
        success: { text: '已成功', color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f' },
        failed: { text: '修复失败', color: '#f04134', bg: '#fff1f0', border: '#ffa39e' }
    };

    const visibleFixNodes = onlyShowFailed
        ? fixNodes.filter(node => node.fixStatus === 'failed' || node.issues.some(issue => !issue.canFix))
        : fixNodes;
    const getFlowDesignerUrl = (node) => {
        const domain = global.info?.domain || '';
        const appId = node?.appId || '';
        const processCode = node?.processCode || '';
        if (!domain || !appId || !processCode) return '';
        return `https://${domain}.aliwork.com/${appId}/design/newDesigner.html?processCode=${encodeURIComponent(processCode)}&isLogic=true`;
    };
    const openFlowDesigner = (node) => {
        const url = getFlowDesignerUrl(node);
        if (!url) {
            Utils.toast({ title: '缺少应用或流程信息，无法打开集成自动化', type: 'warn' });
            return;
        }
        window.open(url, '_blank', 'noopener,noreferrer');
    };
    const getFlowAdminUrl = (node) => {
        const domain = global.info?.domain || '';
        const appId = node?.appId || '';
        if (!domain || !appId) return '';
        return `https://${domain}.aliwork.com/${appId}/admin/logicFlow`;
    };
    const openFlowAdmin = (node) => {
        const url = getFlowAdminUrl(node);
        if (!url) {
            Utils.toast({ title: '缺少应用信息，无法打开集成自动化管理页', type: 'warn' });
            return;
        }
        window.open(url, '_blank', 'noopener,noreferrer');
    };
    const getFixStatusMeta = (status) => {
        if (status === 'running') return { text: '修复中', color: '#005fb8', bg: '#e6f4ff', border: '#91caff' };
        if (status === 'success') return { text: '成功', color: '#237804', bg: '#f6ffed', border: '#b7eb8f' };
        if (status === 'failed') return { text: '失败', color: '#cf1322', bg: '#fff1f0', border: '#ffa39e' };
        return { text: '待处理', color: '#666', bg: '#fafafa', border: '#d9d9d9' };
    };

    return (
        <div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <button
                    onClick={handleSearch}
                    disabled={searching || fixing}
                    style={{ padding: '8px 20px', background: (searching || fixing) ? '#d9d9d9' : '#005fb8', color: '#fff', border: 'none', borderRadius: '4px', cursor: (searching || fixing) ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                    {searching ? '检索中...' : '开始检索依赖内容'}
                </button>
                <button
                    onClick={handleFix}
                    disabled={searching || fixing || fixNodes.length === 0}
                    style={{ padding: '8px 20px', background: (searching || fixing || fixNodes.length === 0) ? '#d9d9d9' : '#f04134', color: '#fff', border: 'none', borderRadius: '4px', cursor: (searching || fixing || fixNodes.length === 0) ? 'not-allowed' : 'pointer', fontSize: '14px', minWidth: '110px' }}>
                    {fixing ? '修复中...' : '尝试修复'}
                </button>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#666', userSelect: 'none' }}>
                    <input
                        type="checkbox"
                        checked={onlyShowFailed}
                        onChange={(e) => setOnlyShowFailed(e.target.checked)}
                        disabled={searching}
                    />
                    只看失败项
                </label>
            </div>

            {(fixing || fixSummary.total > 0) && (
                <div style={{ marginBottom: '16px', padding: '12px 14px', border: '1px solid #ebebeb', borderRadius: '6px', background: '#fafafa' }}>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: '#333', marginBottom: fixing ? '10px' : 0 }}>
                        <span>总数: <strong>{fixSummary.total}</strong></span>
                        <span style={{ color: '#52c41a' }}>成功: <strong>{fixSummary.success}</strong></span>
                        <span style={{ color: '#f04134' }}>失败: <strong>{fixSummary.failed}</strong></span>
                        {fixing && <span style={{ color: '#1890ff' }}>进度: <strong>{fixProgress.current}/{fixProgress.total}</strong></span>}
                    </div>
                    {fixing && (
                        <>
                            <div style={{ width: '100%', height: '6px', borderRadius: '999px', background: '#e8e8e8', overflow: 'hidden', marginBottom: '10px' }}>
                                <div style={{
                                    width: `${fixProgress.total ? Math.max((fixProgress.current / fixProgress.total) * 100, 6) : 0}%`,
                                    height: '100%',
                                    background: 'linear-gradient(90deg, #1890ff 0%, #40a9ff 100%)',
                                    transition: 'width 0.25s ease'
                                }} />
                            </div>
                            <div style={{ fontSize: '12px', color: '#666' }}>
                                正在修复：{fixProgress.flowName || '-'}
                                {fixProgress.appName ? ` / ${fixProgress.appName}` : ''}
                                {fixProgress.formName ? ` / ${fixProgress.formName}` : ''}
                            </div>
                        </>
                    )}
                </div>
            )}

            {fixNodes.length > 0 && (
                <div>
                    <div style={{ marginBottom: '12px', fontSize: '13px', color: '#666' }}>
                        当前显示 <strong style={{ color: '#f04134' }}>{visibleFixNodes.length}</strong> / <strong>{fixNodes.length}</strong> 个存在依赖问题的集成自动化
                        {onlyShowFailed ? '（仅失败项）' : ''}:
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '10px' }}>
                        <thead>
                            <tr style={{ background: '#fafafa', borderBottom: '2px solid #ebebeb' }}>
                                <th style={{ padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>流程名称</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>所属应用 / 表单</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>问题数</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>修复状态</th>
                                <th style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleFixNodes.map((node, nodeIdx) => {
                                const bgColor = nodeIdx % 2 === 0 ? '#fff' : '#fafafa';
                                const ownerLabel = node.flowFormName ? `${node.appName} / ${node.flowFormName}` : node.appName;
                                const issueCount = node.issues.length;
                                const statusMeta = getFixStatusMeta(node.fixStatus);

                                return (
                                    <tr key={node.processCode || nodeIdx} style={{ borderBottom: '1px solid #ebebeb', background: bgColor }}>
                                        <td style={{ padding: '8px 12px', color: '#005fb8', verticalAlign: 'top' }}>
                                            <div>{node.processName}</div>
                                            <div style={{ color: '#999', fontSize: '11px', marginTop: '3px' }}>{node.processCode}</div>
                                        </td>
                                        <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>{ownerLabel}</td>
                                        <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>{issueCount}</td>
                                        <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '1px 8px',
                                                borderRadius: '999px',
                                                background: statusMeta.bg,
                                                color: statusMeta.color,
                                                border: `1px solid ${statusMeta.border}`,
                                                fontSize: '11px'
                                            }}>
                                                {statusMeta.text}
                                            </span>
                                            {node.fixMessage && (
                                                <div style={{ color: '#999', fontSize: '11px', marginTop: '4px', maxWidth: '260px' }}>{node.fixMessage}</div>
                                            )}
                                        </td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                                            <button
                                                type="button"
                                                onClick={() => openFlowDesigner(node)}
                                                style={{
                                                    height: '24px',
                                                    padding: '0 8px',
                                                    borderRadius: '4px',
                                                    border: '1px solid #91caff',
                                                    background: '#e6f4ff',
                                                    color: '#005fb8',
                                                    cursor: 'pointer',
                                                    fontSize: '12px',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                访问
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => openFlowAdmin(node)}
                                                style={{
                                                    height: '24px',
                                                    padding: '0 8px',
                                                    marginLeft: '6px',
                                                    borderRadius: '4px',
                                                    border: '1px solid #b7eb8f',
                                                    background: '#f6ffed',
                                                    color: '#237804',
                                                    cursor: 'pointer',
                                                    fontSize: '12px',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                管理
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDetailNode(node)}
                                                style={{
                                                    height: '24px',
                                                    padding: '0 8px',
                                                    marginLeft: '6px',
                                                    borderRadius: '4px',
                                                    border: '1px solid #d9d9d9',
                                                    background: '#fff',
                                                    color: '#333',
                                                    cursor: 'pointer',
                                                    fontSize: '12px',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                明细
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <FlowFixDetailDialog
                node={detailNode}
                onClose={() => setDetailNode(null)}
                onOpenFlowDesigner={openFlowDesigner}
            />

            {!searching && !fixing && fixNodes.length === 0 && (
                <div style={{ textAlign: 'center', color: '#999', paddingTop: '60px', fontSize: '13px' }}>
                    点击上方按钮开始检索
                </div>
            )}
        </div>
    );
}
