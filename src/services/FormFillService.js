import global from '../global.js';
import Utils from '@/services/shared/BrowserUtilsService';
import StateModule from '@/services/shared/RuntimeStateService';
import DataSourceModule from '@/services/datasource/DataSourceService';

export default class FormFillService {
    static async setFieldName(ruleItem) {
        try {
            const fieldDiv = ruleItem.querySelector('.field-name .next-select');
            if (!fieldDiv) return false;
            
            // 提前拦截：如果输入框里已经有值（不是占位符），则直接跳过选择
            const inputEl = fieldDiv.querySelector('input');
            const hasTag = fieldDiv.querySelector('.next-tag');
            const emText = fieldDiv.querySelector('em') ? fieldDiv.querySelector('em').textContent.trim() : '';
            
            // 判断是否已有真实值：有 tag，或者 input 里有非空文本，且没有占位符
            if (hasTag || (inputEl && inputEl.value.trim() !== '') || (emText !== '' && emText !== '请配置字段/变量' && !emText.includes('请选择'))) {
                Utils.log('字段名已存在，跳过选择');
                return true;
            }

            const ok = await Utils.selectFirstOption(fieldDiv);
            return !!ok;
        } catch (_) {
            document.body.click();
            return false;
        }
    }
    static async setValueTypeToField(ruleItem, typeText = '字段') {
        const selectDiv = ruleItem.querySelector('.value-type .next-select');
        if (!selectDiv) return false;
        
        const input = selectDiv.querySelector('input');
        // 提前拦截：如果当前已经是目标类型，直接返回成功，跳过所有动画和下拉菜单点击
        if (input && input.getAttribute('aria-valuetext') === typeText) {
            return true;
        }

        await Utils.openSelect(selectDiv);
        const menu = await Utils.waitVisibleMenu();
        if (!menu) { document.body.click(); return false; }
        const ok = Utils.selectMenuItemByTitle(menu, typeText);
        const isSuccess = await Utils.waitInputAriaValueText(input, typeText, 600);
        document.body.click();
        await Utils.raf();
        document.body.click();
        return ok && isSuccess;
    }
    static async setTargetValue(ruleItem) {
        if (!ruleItem) ruleItem = Utils.getLastRuleItem();
        if (!ruleItem) return false;
        const triggerSearches = ruleItem.querySelectorAll('.next-select-trigger-search');
        if (!triggerSearches || triggerSearches.length < 3) return false;
        const fieldInput = triggerSearches[0].querySelector('input');
        const fieldText = fieldInput ? fieldInput.getAttribute('aria-valuetext') : null;
        if (!fieldText) return false;

        const targetInput = triggerSearches[2].querySelector('input');
        if (!targetInput) return false;

        targetInput.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        targetInput.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        targetInput.focus();
        targetInput.click();
        targetInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown', code: 'ArrowDown' }));
        await Utils.raf();
        
        // 修复 panel 获取：总是获取当前最新激活的面板，防止取到旧的隐藏面板
        const getActivePanel = () => {
            const panels = Array.from(document.querySelectorAll('.select-field-panel'));
            return panels.reverse().find(p => p.offsetParent !== null) || panels[panels.length - 1];
        };

        const panelReady = await Utils.waitFor(() => {
            const p = getActivePanel();
            return p && p.offsetParent !== null;
        }, 800, 20);
        
        const panel = getActivePanel();
        if (!panel || !panelReady) return false;

        const dataSourceLabels = DataSourceModule.getDataSourceLabels();
        let dataSourceNode = DataSourceModule.findDataSourceNode(panel, dataSourceLabels);
        
        const ensureExpanded = async () => {
            if (!dataSourceNode) return;
            const switcher = dataSourceNode.querySelector('.next-tree-switcher');
            const tryExpandOnce = async () => {
                const expandedByClass = dataSourceNode.classList.contains('next-tree-node-expanded');
                const expandedByAttr = switcher && switcher.getAttribute('aria-expanded') === 'true';
                const isClosed = switcher && switcher.classList.contains('next-close');
                const hasChildTree = !!dataSourceNode.querySelector('ul.next-tree-child-tree');
                if ((expandedByClass || expandedByAttr) && hasChildTree && !isClosed) return true;
                
                const inner = dataSourceNode.querySelector('.next-tree-node-inner');
                const label = dataSourceNode.querySelector('.single-item-label');
                
                if (switcher) {
                    Utils.triggerReactEvent(switcher, 'mousedown');
                    Utils.triggerReactEvent(switcher, 'click');
                }
                if (label) {
                    Utils.triggerReactEvent(label, 'mousedown');
                    Utils.triggerReactEvent(label, 'click');
                } else if (inner) {
                    Utils.triggerReactEvent(inner, 'mousedown');
                    Utils.triggerReactEvent(inner, 'click');
                }
                await Utils.raf();
                
                return await Utils.waitFor(() => {
                    const node = DataSourceModule.findDataSourceNode(panel, dataSourceLabels);
                    const expandedClass = node && node.classList.contains('next-tree-node-expanded');
                    const expandedAttr = node && node.querySelector('.next-tree-switcher')?.getAttribute('aria-expanded') === 'true';
                    const nestedCount = node ? node.querySelectorAll('li.next-tree-node').length : 0;
                    const childTree = node && node.querySelector('ul.next-tree-child-tree');
                    return expandedClass || expandedAttr || nestedCount > 0 || !!childTree;
                }, 800, 20);
            };
            
            let ok = await tryExpandOnce();
            if (!ok) {
                await Utils.raf();
                ok = await tryExpandOnce();
            }
            dataSourceNode = DataSourceModule.findDataSourceNode(panel, dataSourceLabels) || dataSourceNode;
        };

        if (dataSourceNode) {
            await ensureExpanded();
            await Utils.raf();
        }

        const getSearchNodes = () => {
            const allNodes = Array.from(panel.querySelectorAll('li.next-tree-node'));
            if (dataSourceNode) {
                const nested = Array.from(dataSourceNode.querySelectorAll('li.next-tree-node'));
                if (nested.length) return nested;
            }
            if (dataSourceLabels && dataSourceLabels.length > 0) return [];
            return allNodes;
        };
        const findNodeByLabel = (label) => {
            const nodes = getSearchNodes();
            const normalizedLabel = Utils.normalizeLabel(label);
            return nodes.find(li => Utils.getNodeLabel(li) === normalizedLabel && li.offsetParent);
        };
        
        const findTargetNode = async () => {
            if (StateModule.fillRule === 'C') {
                const labelA = `${fieldText}文本`;
                const labelB = fieldText;
                let target = findNodeByLabel(labelA) || findNodeByLabel(labelB);
                if (!target) {
                    await Utils.waitFor(() => findNodeByLabel(labelA) || findNodeByLabel(labelB), 600, 20);
                    target = findNodeByLabel(labelA) || findNodeByLabel(labelB);
                }
                return target;
            }
            
            let target = findNodeByLabel(fieldText);
            if (!target) {
                await Utils.waitFor(() => findNodeByLabel(fieldText), 600, 20);
                target = findNodeByLabel(fieldText);
            }
            return target;
        };
        
        const targetNode = await findTargetNode();
        if (!targetNode) {
            // 如果没找到，并且是模式 B，则转为公式
            if (StateModule.fillRule === 'B') {
                await FormFillService.setValueTypeToField(ruleItem, '公式');
                let formulaSuccess = false;
                if (StateModule.fillSameField) {
                    formulaSuccess = await FormFillService.fillFormulaWithSameField(ruleItem, fieldText);
                }
                if (!formulaSuccess) {
                    ruleItem.dataset.fillFailed = 'true';
                    Utils.log(`字段 [${fieldText}] 在公式中也未找到匹配项，已放弃回填`, 'warn');
                }
                return formulaSuccess;
            }
            // 模式 A 和 C 没找到时，保留下拉框打开或者点击空白处关闭
            document.body.click(); // 关闭下拉框，避免遗留
            ruleItem.dataset.fillFailed = 'true';
            Utils.log(`字段 [${fieldText}] 未找到匹配项，已放弃回填`, 'warn');
            return false;
        }

        const clickableElement = targetNode.querySelector('.next-tree-node-label-selectable') ||
            targetNode.querySelector('.next-tree-node-label-wrapper') ||
            targetNode.querySelector('.next-tree-node-inner');
        if (!clickableElement) {
            ruleItem.dataset.fillFailed = 'true';
            return false;
        }
        Utils.triggerReactEvent(clickableElement, 'mousedown');
        const success = Utils.triggerReactEvent(clickableElement, 'click');
        await Utils.raf();
        if (!success) {
            ruleItem.dataset.fillFailed = 'true';
        } else {
            // 成功则清除失败标记
            delete ruleItem.dataset.fillFailed;
        }
        return success;
    }
    static async fillEmptyRules(onlyFillOne = false) {
        const ruleItems = document.querySelectorAll(".action-rules-editor .rules-group .rule-item");
        if (!ruleItems || ruleItems.length === 0) return 0;

        let filledCount = 0;
        
        for (let i = 0; i < ruleItems.length; i++) {
            if (StateModule.fillAllPaused) break; // 支持在填充过程中暂停

            // 因为前面填充可能会引起React重绘，每次都要重新获取一遍当前位置的节点
            const currentRuleItems = document.querySelectorAll(".action-rules-editor .rules-group .rule-item");
            if (i >= currentRuleItems.length) break;
            
            const item = currentRuleItems[i];
            const mainContainer = item.querySelector('.rule-item-main');
            if (!mainContainer) continue;

            const targetValueWrapper = mainContainer.querySelector('.target-value');
            if (!targetValueWrapper) continue;

            const inputEl = targetValueWrapper.querySelector('input');
            const isInputValueEmpty = !inputEl || inputEl.value.trim() === '';
            const hasTag = !!targetValueWrapper.querySelector('.next-tag');
            
            const emEl = targetValueWrapper.querySelector('em');
            const emText = emEl ? emEl.textContent.trim() : '';
            const isEmPlaceholder = emText === '' || emText.startsWith('请') || (emEl && emEl.classList.contains('next-select-em'));

            const isValueEmpty = isInputValueEmpty && !hasTag && isEmPlaceholder;
            // 避免无限死循环：如果之前尝试回填但失败了的，不再重复尝试
            const isFailed = item.dataset.fillFailed === 'true';

            if (isValueEmpty && !isFailed) {
                Utils.log(`正在尝试填充第 ${i + 1} 项的空值...`);
                try {
                    // 如果左侧字段名还没选，也一并选上
                    await FormFillService.setFieldName(item);
                    await FormFillService.setValueTypeToField(item, '字段');
                    const success = await FormFillService.setTargetValue(item);
                    if (success) {
                        filledCount++;
                        await Utils.sleep(200);
                        // 如果限制只填充一条空值，且当前成功填充了一条，则立刻返回
                        if (onlyFillOne) {
                            return filledCount;
                        }
                    } else {
                        await Utils.sleep(200);
                    }
                } catch (e) {
                    console.error("填充空值异常:", e);
                }
            }
        }
        
        return filledCount;
    }

    static async event_fillOne() {
        // 尝试填充“一条”空值
        const emptyFilledCount = await FormFillService.fillEmptyRules(true);
        if (emptyFilledCount > 0) {
            Utils.log(`检测到空值项，已自动回填 1 个空值项。`, 'success');
            return true;
        }

        const addButton = document.querySelector(".action-rules-editor .rules-group .rules-add-btn");
        if (!addButton) {
            return false;
        }
        const beforeCount = document.querySelectorAll(".action-rules-editor .rules-group .rule-item").length;
        addButton.click();
        const added = await Utils.waitFor(() => {
            const nowCount = document.querySelectorAll(".action-rules-editor .rules-group .rule-item").length;
            return nowCount > beforeCount;
        }, 800, 20); // 缩短等待添加的时间
        if (!added) return false;
        const last_item = Utils.getLastRuleItem();
        if (!last_item) return false;
        try {
            await FormFillService.setFieldName(last_item);
            await FormFillService.setValueTypeToField(last_item, '字段');
            await FormFillService.setTargetValue(last_item);
            return true;
        } catch (_) {
            return false;
        }
    }
    static async fillFormulaWithSameField(ruleItem, fieldText) {
        // 赋值类型切换为“公式”后，DOM 结构会改变，需要等待“请配置公式”的输入框或 fx 图标出现
        let formulaTrigger = null;
        const foundTrigger = await Utils.waitFor(() => {
            // 宜搭的公式输入框通常是一个带有 'formula' class 的组件，或者 placeholder="请配置公式"
            const els = ruleItem.querySelectorAll('.formula-editor-trigger, .value-formula, input[placeholder*="配置公式"]');
            for (const el of els) {
                if (el.offsetParent !== null) {
                    formulaTrigger = el;
                    return true;
                }
            }
            // 降级方案：找包含 fx 字符或特定 icon 的元素
            const nextInputs = ruleItem.querySelectorAll('.next-input');
            if (nextInputs.length >= 2) {
                const lastInput = nextInputs[nextInputs.length - 1];
                if (lastInput && lastInput.offsetParent !== null) {
                    formulaTrigger = lastInput;
                    return true;
                }
            }
            return false;
        }, 1500, 50);

        if (!foundTrigger || !formulaTrigger) {
            Utils.log('未找到公式配置框，无法点击打开公式弹窗', 'warn');
            return false;
        }

        // 模拟点击以打开弹窗
        Utils.triggerReactEvent(formulaTrigger, 'mousedown');
        Utils.triggerReactEvent(formulaTrigger, 'click');
        formulaTrigger.click();

        // 等待公式弹窗出现
        const modalReady = await Utils.waitFor(() => document.querySelector('.yida-formula-editor-modal, .formula-editor-modal-container, .next-dialog'), 1500, 50);
        if (!modalReady) {
            Utils.log('未能打开公式编辑器弹窗', 'warn');
            return false;
        }

        const dialog = document.querySelector('.yida-formula-editor-modal') || 
                      document.querySelector('.formula-editor-modal-container') || 
                      document.querySelector('.next-dialog');

        try {
            // 等待左侧变量树渲染
            // 宜搭的公式面板左侧通常是一个 tree 或者 collapse
            const getLeftTree = () => {
                const trees = dialog.querySelectorAll('.next-tree');
                if (trees.length > 0) return trees[0];
                
                // 也有可能是 Collapse 折叠面板
                const collapse = dialog.querySelector('.next-collapse');
                if (collapse) return collapse;
                
                // 或者是自定义的列表
                const list = dialog.querySelector('.formula-field-list, .variable-list');
                if (list) return list;

                // 尝试找包含“当前表单提交后的数据”的容器
                const allDivs = Array.from(dialog.querySelectorAll('div'));
                const targetDiv = allDivs.find(div => div.textContent.includes('当前表单提交后的数据') && div.children.length > 0);
                if (targetDiv) return targetDiv.closest('.next-box') || targetDiv.parentElement;

                return null;
            };

            const treeReady = await Utils.waitFor(() => {
                const tree = getLeftTree();
                if (!tree) return false;
                return tree.querySelectorAll('.next-tree-node, .next-collapse-panel, li, [role="treeitem"], [role="listitem"]').length > 0 || tree.textContent.includes(fieldText);
            }, 1500, 50);

            const leftTree = getLeftTree();

            if (treeReady && leftTree) {
                // 尝试展开所有折叠的父节点
                const expandSwitchers = leftTree.querySelectorAll('.next-tree-switcher.next-close, .next-collapse-panel-icon, i.next-icon-arrow-right');
                for (const switcher of expandSwitchers) {
                    Utils.triggerReactEvent(switcher, 'click');
                }
                if (expandSwitchers.length > 0) {
                    await Utils.sleep(300); // 等待展开动画和渲染
                }

                // 查找目标节点
                // 提取所有的可点击项
                const items = Array.from(leftTree.querySelectorAll('.next-tree-node, li, [role="treeitem"], [role="listitem"], .formula-field-item, .field-item')).filter(el => {
                    // 排除显然是分组标题的元素
                    if (el.classList.contains('next-collapse-panel-title')) return false;
                    const childTree = el.querySelector('ul.next-tree-child-tree, .next-collapse-panel-content');
                    if (childTree && childTree.children.length > 0) return false;
                    return true;
                });
                
                let targetNode = null;
                
                for (const node of items) {
                    let labelText = '';
                    
                    // 尝试找到专门显示文字的子元素
                    const labelEl = node.querySelector('.next-tree-node-label, .single-item-label, .next-tree-node-title, .title, span');
                    
                    if (labelEl) {
                        // 尝试获取纯文本，排除右侧可能带有的“时间戳”等标签 span
                        const textNodes = Array.from(labelEl.childNodes).filter(n => n.nodeType === 3);
                        if (textNodes.length > 0) {
                            labelText = textNodes.map(n => n.textContent).join('').trim();
                        } else {
                            labelText = labelEl.getAttribute('title') || labelEl.textContent || '';
                        }
                    } else {
                        // 如果没有特定的 span，直接取 textContent，但要去掉可能的标签文字
                        labelText = node.textContent || '';
                    }

                    // 过滤掉常见的类型后缀干扰
                    const cleanText = labelText.replace(/时间戳|文本|数字|布尔|数组|对象|人员|部门|附件/g, '').trim();

                    if (Utils.normalizeLabel(labelText) === Utils.normalizeLabel(fieldText) || 
                        Utils.normalizeLabel(cleanText) === Utils.normalizeLabel(fieldText) ||
                        labelText.startsWith(fieldText)) {
                        
                        targetNode = node;
                        
                        // 优先匹配“当前表单提交后的数据”或“主表”
                        let parentLabel = '';
                        const parentUl = node.closest('ul.next-tree-child-tree');
                        if (parentUl && parentUl.previousElementSibling) {
                            parentLabel = parentUl.previousElementSibling.textContent;
                        } else {
                            const panel = node.closest('.next-collapse-panel');
                            if (panel) {
                                const titleEl = panel.querySelector('.next-collapse-panel-title');
                                if (titleEl) parentLabel = titleEl.textContent;
                            }
                        }
                        
                        if (parentLabel.includes('当前表单提交后的数据') || parentLabel.includes('主表')) {
                            break; // 找到最完美的匹配，跳出循环
                        }
                    }
                }

                if (targetNode) {
                    // 点击节点注入公式
                    const clickable = targetNode.querySelector('.next-tree-node-inner') || targetNode;
                    
                    // 特殊处理宜搭的 Collapse 结构内部列表点击
                    if (!clickable.onclick) {
                        Utils.triggerReactEvent(clickable, 'mousedown');
                        Utils.triggerReactEvent(clickable, 'click');
                        clickable.click();
                    } else {
                        clickable.click();
                    }
                    
                    await Utils.sleep(150);

                    // 找到确定按钮并点击
                    const confirmBtn = Array.from(dialog.querySelectorAll('button')).find(btn => btn.textContent.includes('确定') || btn.classList.contains('next-btn-primary'));
                    if (confirmBtn) {
                        confirmBtn.click();
                        Utils.log(`已自动注入公式字段: ${fieldText}`, 'success');
                        return true;
                    } else {
                        Utils.log('未找到公式弹窗的确定按钮', 'warn');
                    }
                } else {
                    Utils.log(`未在公式变量面板中找到同名字段: ${fieldText}`, 'warn');
                }
            } else {
                Utils.log('未能找到公式变量树', 'warn');
            }
        } catch (e) {
            console.error("注入公式失败:", e);
        }

        // 如果上面失败了，记得关掉弹窗
        const closeBtn = dialog.querySelector('.next-dialog-close');
        if (closeBtn) closeBtn.click();
        
        return false;
    }

    static async event_fillAll() {
        let count = 0;
        const maxAttempts = 100;
        StateModule.fillAllPaused = false;
        if (typeof StateModule.logAppend === 'function') StateModule.logAppend('开始填充全部数据');
        if (typeof StateModule.fillAllToggleButtons === 'function') StateModule.fillAllToggleButtons(true);
        
        // 阶段 1：先集中处理页面上所有现存的空值项
        if (typeof StateModule.logAppend === 'function') StateModule.logAppend('正在扫描并回填空值项...');
        const emptyFilledCount = await FormFillService.fillEmptyRules(false);
        if (emptyFilledCount > 0) {
            if (typeof StateModule.logAppend === 'function') StateModule.logAppend(`成功回填了 ${emptyFilledCount} 个空值项`);
            count += emptyFilledCount;
        }

        // 阶段 2：继续追加新的项，直到填满或达到最大限制
        while (count < maxAttempts) {
            if (StateModule.fillAllPaused) {
                if (typeof StateModule.logAppend === 'function') StateModule.logAppend('已暂停填充', 'warn');
                break;
            }
            
            const success = await FormFillService.event_fillOne();
            if (success) {
                count++;
                await Utils.sleep(300); // 给点时间让界面响应
            } else {
                if (typeof StateModule.logAppend === 'function') StateModule.logAppend('没有更多字段可填充或填充已完成', 'success');
                break;
            }
        }

        if (count >= maxAttempts && typeof StateModule.logAppend === 'function') {
            StateModule.logAppend(`已达到最大填充次数 ${maxAttempts}，自动停止`, 'warn');
        }

        if (typeof StateModule.fillAllToggleButtons === 'function') StateModule.fillAllToggleButtons(false);
    }
}