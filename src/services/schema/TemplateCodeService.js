/**
 * 模板代码模块
 * 提供模板代码相关功能，如获取一般审批设置的 JSON 代码等。
 */
export default class TemplateCodeModule {
    /**
     * 获取一般审批设置的 JSON 代码
     * @param {string} formUuid - 表单 UUID
     * @param {string} formName - 表单名称
     * @param {object} targetFiled - 目标字段信息
     * @param {array} abstractSettings - 摘要设置
     * @param {array} auditFields - 审核字段列表
     * @returns {string} - 生成的 JSON 代码
     */
    static getGeneralApprovalSettingsJson(originProcessJsonStr, originViewJsonStr, originFormUuid, originFormName, targetFiled, abstractSettings, auditFields, newProcessCode, newFormUuid, appId) {
        console.log("开始修改已有流程的模板代码", originFormUuid, targetFiled, abstractSettings);

        let templateJson = {};
        let viewJson = {};
        try {
            templateJson = typeof originProcessJsonStr === 'string' ? JSON.parse(originProcessJsonStr) : originProcessJsonStr;
            viewJson = typeof originViewJsonStr === 'string' ? JSON.parse(originViewJsonStr) : originViewJsonStr;
        } catch(e) {
            console.error("解析已有流程 json 失败", e);
            return null;
        }

        // 确保基本结构存在
        if (!templateJson.props) templateJson.props = {};
        templateJson.props.processCode = newProcessCode;
        templateJson.props.bindingForm = newFormUuid;

        if (!templateJson.nodes || templateJson.nodes.length === 0) {
            console.log("检测到流程节点为空，注入默认审批节点树...");
            templateJson.nodes = [
                { "name": { "en_US": "start", "zh_CN": "发起", "type": "i18n" }, "type": "apply", "nodeId": "sid_instStart", "prevId": "", "nextId": ["node_ockpz6phx73"], "props": {}, "childNodes": [] },
                { "name": { "en_US": "ApprovalNode", "zh_CN": "审批人", "type": "i18n" }, "description": { "en_US": "Sponsor approval", "zh_CN": "发起人审批", "type": "i18n" }, "type": "approval", "approvalType": "ext_target_approval_originator", "nodeId": "node_ockpz6phx73", "prevId": "", "nextId": ["node_ockpz6phx78"], "props": { "approvals": [["originator"]], "actions": [{ "hidden": false, "name": { "en_US": "agree", "zh_CN": "同意", "type": "i18n" }, "text": { "en_US": "agree", "zh_CN": "同意", "type": "i18n" }, "action": "agree", "alias": { "en_US": "agree", "zh_CN": "同意", "type": "i18n" } }, { "hidden": false, "name": { "en_US": "disagree", "zh_CN": "拒绝", "type": "i18n" }, "text": { "en_US": "disagree", "zh_CN": "拒绝", "type": "i18n" }, "action": "disagree", "alias": { "en_US": "disagree", "zh_CN": "拒绝", "type": "i18n" } }, { "hidden": true, "name": { "en_US": "save", "zh_CN": "保存", "type": "i18n" }, "text": { "en_US": "save", "zh_CN": "保存", "type": "i18n" }, "action": "save", "alias": { "en_US": "save", "zh_CN": "保存", "type": "i18n" } }] }, "childNodes": [] },
                { "name": { "en_US": "end", "zh_CN": "结束", "type": "i18n" }, "type": "finish", "nodeId": "node_ockpz6phx78", "prevId": "", "nextId": [], "props": {}, "childNodes": [] }
            ];
        }

        // 确保 formulaRules 结构存在
        if (!templateJson.formulaRules) {
            templateJson.formulaRules = [];
        }

        // 找到审批节点(approvalType存在即认为是审批节点) 以提取它的 nodeId 作为关联规则的 activityId
        let approvalNodeId = "";
        if (templateJson.nodes && Array.isArray(templateJson.nodes)) {
            const approvalNode = templateJson.nodes.find(n => n.type === 'approval');
            if (approvalNode) {
                approvalNodeId = approvalNode.nodeId;
            }
        }

        if (!auditFields) {
            console.error("缺少审核状态字段");
        } else {
            // 找到是否已经有通过和拒绝的规则，如果没有则追加
            const agreeRule = templateJson.formulaRules.find(r => r.activityAction && r.activityAction.includes("agree"));
            const disagreeRule = templateJson.formulaRules.find(r => r.activityAction && r.activityAction.includes("disagree"));

            const agreeContent = `UPDATE(\"${originFormUuid}\",QUERYEQ(\"${targetFiled.fieldId}\",#{${targetFiled.fieldId}}),\"\",\"${auditFields}\",\"通过\")`;
            const agreeDisplay = `UPDATE(${originFormName},EQ(${originFormName}.${targetFiled.label},${targetFiled.label}),\"\",${originFormName}.审核状态,\"通过\")`;
            const agreeSource = `UPDATE(#{${originFormUuid}/},EQ(#{${originFormUuid}/${targetFiled.fieldId}},#{${targetFiled.fieldId}}),\"\",#{${originFormUuid}/${auditFields}},\"通过\")`;

            const disagreeContent = `UPDATE(\"${originFormUuid}\",QUERYEQ(\"${targetFiled.fieldId}\",#{${targetFiled.fieldId}}),\"\",\"${auditFields}\",\"保存\")`;
            const disagreeDisplay = `UPDATE(${originFormName},EQ(${originFormName}.${targetFiled.label},${targetFiled.label}),\"\",${originFormName}.审核状态,\"保存\")`;
            const disagreeSource = `UPDATE(#{${originFormUuid}/},EQ(#{${originFormUuid}/${targetFiled.fieldId}},#{${targetFiled.fieldId}}),\"\",#{${originFormUuid}/${auditFields}},\"保存\")`;

            if (agreeRule) {
                agreeRule.activityId = approvalNodeId ? [approvalNodeId] : [];
                agreeRule.rule = { "content": agreeContent, "displayRule": agreeDisplay, "source": agreeSource };
            } else {
                templateJson.formulaRules.push({
                    "name": { "en_US": "Agree Rule", "zh_CN": "通过规则", "type": "i18n" },
                    "nodeType": "FINISH",
                    "ruleType": "ASSOCIATION",
                    "triggerMode": null,
                    "block": "n",
                    "message": null,
                    "i18nMessage": null,
                    "activityId": approvalNodeId ? [approvalNodeId] : [],
                    "activityAction": ["agree"],
                    "rule": { "content": agreeContent, "displayRule": agreeDisplay, "source": agreeSource }
                });
            }

            if (disagreeRule) {
                disagreeRule.activityId = approvalNodeId ? [approvalNodeId] : [];
                disagreeRule.rule = { "content": disagreeContent, "displayRule": disagreeDisplay, "source": disagreeSource };
            } else {
                templateJson.formulaRules.push({
                    "name": { "en_US": "Disagree Rule", "zh_CN": "拒绝规则", "type": "i18n" },
                    "nodeType": "FINISH",
                    "ruleType": "ASSOCIATION",
                    "triggerMode": null,
                    "block": "n",
                    "message": null,
                    "i18nMessage": null,
                    "activityId": approvalNodeId ? [approvalNodeId] : [],
                    "activityAction": ["disagree", "terminated"],
                    "rule": { "content": disagreeContent, "displayRule": disagreeDisplay, "source": disagreeSource }
                });
            }
        }

        // 处理摘要字段 (从 [{fieldId, label, titleName}] 转换成 {title: {...}, value: fieldId, type: 'variable'})
        let summaryList = [];
        if (abstractSettings && Array.isArray(abstractSettings)) {
            summaryList = abstractSettings.map(field => ({
                title: { zh_CN: field.label, en_US: "TextField", type: "i18n" },
                value: field.fieldId,
                type: "variable"
            }));
        }
        
        // 关键修复点：将 summaryList 包装在 globalSettings 中
        if (!templateJson.globalSettings) {
            templateJson.globalSettings = {};
        }
        templateJson.globalSettings.approvalSummary = summaryList;

        // 同步 viewJson，防止宜搭解析时因不一致导致"系统异常"
        viewJson.formulaRules = JSON.parse(JSON.stringify(templateJson.formulaRules));
        viewJson.bindingForm = newFormUuid;
        
        if (!viewJson.schema || !viewJson.schema.children || viewJson.schema.children.length === 0) {
            console.log("检测到前端画布 schema 为空，注入默认画布节点...");
            viewJson.schema = {
                "componentName": "CanvasEngine",
                "id": "node_ockpz6phx71",
                "props": {},
                "children": [
                    { "componentName": "ApplyNode", "id": "node_ockpz6phx72", "props": { "nodeName": "ApplyNode", "name": { "en_US": "start", "zh_CN": "发起", "type": "i18n" } } },
                    { "componentName": "ApprovalNode", "id": "node_ockpz6phx73", "props": { "nodeName": "ApprovalNode", "name": { "en_US": "ApprovalNode", "zh_CN": "审批人", "type": "i18n" }, "description": { "en_US": "Sponsor approval", "zh_CN": "发起人审批", "type": "i18n" }, "actions": { "normalActions": [{ "hidden": false, "name": { "en_US": "agree", "zh_CN": "同意", "type": "i18n" }, "text": { "en_US": "agree", "zh_CN": "同意", "type": "i18n" }, "action": "agree" }, { "hidden": false, "name": { "en_US": "disagree", "zh_CN": "拒绝", "type": "i18n" }, "text": { "en_US": "disagree", "zh_CN": "拒绝", "type": "i18n" }, "action": "disagree" }] }, "approverRules": { "type": "ext_target_approval_originator", "description": { "en_US": "Sponsor himself", "zh_CN": "发起人本人", "type": "i18n" }, "mode": "ApprovalNode_rules_only", "approverList": [{ "type": "ext_target_approval" }], "multiApproverType": "all", "conditionalMode": "conditional" } }, "title": { "en_US": "ApprovalNode", "zh_CN": "审批人", "type": "i18n" } },
                    { "componentName": "EndNode", "id": "node_ockpz6phx78", "props": { "name": { "en_US": "end", "zh_CN": "结束", "type": "i18n" } } }
                ]
            };
        }

        if (!viewJson.globalSetting) {
            viewJson.globalSetting = {};
        }
        viewJson.globalSetting.approvalSummary = JSON.parse(JSON.stringify(summaryList));

        return { json: templateJson, viewJson: viewJson };
    }

    static getGeneralApprovalSettingsViewJson(formUuid, targetFiled, abstractSettings) {
        return null
    }
}

