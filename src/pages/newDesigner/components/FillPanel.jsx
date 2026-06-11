import React, { useState, useEffect } from 'react';
import global from '../../../global';
import StateModule from '@/services/shared/RuntimeStateService';
import DataSourceModule from '@/services/datasource/DataSourceService';
import FormFillService from '../../../services/FormFillService';
import Utils from '@/services/shared/BrowserUtilsService';

const FillPanel = () => {
    const [mode, setMode] = useState(StateModule.fillRule || 'A');
    const [dataSource, setDataSource] = useState(StateModule.fillDataSource || '');
    const [dataSourceOptions, setDataSourceOptions] = useState(StateModule.fillDataSourceOptions || []);
    const [isFillingAll, setIsFillingAll] = useState(false);
    const [isLoadingDS, setIsLoadingDS] = useState(false);
    const [fillSameField, setFillSameField] = useState(StateModule.fillSameField || false);

    useEffect(() => {
        StateModule.fillRule = mode;
    }, [mode]);

    useEffect(() => {
        StateModule.fillDataSource = dataSource;
    }, [dataSource]);

    useEffect(() => {
        StateModule.fillSameField = fillSameField;
    }, [fillSameField]);

    const handleRefreshDS = async () => {
        if (isLoadingDS) return;
        setIsLoadingDS(true);
        const log = (text, level = 'info') => {
            if (typeof StateModule.logAppend === 'function') StateModule.logAppend(text, level);
            console.log(`[FillPanel] ${text}`);
        };

        log('开始刷新数据源');
        const addButton = document.querySelector(".action-rules-editor .rules-group .rules-add-btn");
        let ruleItem = Utils.getLastRuleItem();

        if (!ruleItem && addButton) {
            const beforeCount = document.querySelectorAll(".action-rules-editor .rules-group .rule-item").length;
            addButton.click();
            const added = await Utils.waitFor(() => {
                const nowCount = document.querySelectorAll(".action-rules-editor .rules-group .rule-item").length;
                return nowCount > beforeCount;
            }, 1000, 20);
            if (!added) {
                setIsLoadingDS(false);
                return;
            }
            ruleItem = Utils.getLastRuleItem();
            const count = document.querySelectorAll(".action-rules-editor .rules-group .rule-item").length;
            log(`已添加规则项，当前数量：${count}`);
        }

        if (!ruleItem) {
            setIsLoadingDS(false);
            return;
        }
        const ok = await FormFillService.setValueTypeToField(ruleItem, '字段');
        log(ok ? '赋值类型设置为“字段”成功' : '赋值类型设置为“字段”失败', ok ? 'info' : 'error');
        if (!ok) {
            setIsLoadingDS(false);
            return;
        }

        const trigger_searchs = ruleItem.querySelectorAll('.next-select-trigger-search');
        if (!trigger_searchs || trigger_searchs.length < 3) {
            setIsLoadingDS(false);
            return;
        }
        const input = trigger_searchs[2].querySelector('input');
        if (!input) {
            setIsLoadingDS(false);
            return;
        }

        const selectContainer = input.closest('.next-select');
        if (selectContainer) {
            selectContainer.setAttribute('data-expanded', 'true');
            selectContainer.classList.add('next-open', 'expanded');
        }

        input.focus();
        await Utils.raf();
        input.click();
        await Utils.raf();

        const panelReady = await Utils.waitFor(() => document.querySelector('.select-field-panel'), 800, 20);
        log(panelReady ? '下拉面板已打开' : '下拉面板打开失败', panelReady ? 'info' : 'warn');
        if (!panelReady) {
            setIsLoadingDS(false);
            return;
        }

        const dynamic = DataSourceModule.readFieldPanelOptions();
        log(`已读取数据源：${dynamic.length}项：${dynamic.map(d => d.text).join('，')}`);

        if (dynamic.length > 0) {
            StateModule.fillDataSourceOptions = dynamic;
            setDataSourceOptions(dynamic);
            if (!dynamic.find(d => d.value === dataSource)) {
                setDataSource(dynamic[0].value);
            }
            log(`已应用数据源选项，当前选择：${StateModule.fillDataSource}`);
        }

        setIsLoadingDS(false);
    };

    const handleClearEmpty = async () => {
        const log = (text, level = 'info') => {
            if (typeof StateModule.logAppend === 'function') StateModule.logAppend(text, level);
            console.log(`[FillPanel] ${text}`);
        };

        const ruleItems = document.querySelectorAll(".action-rules-editor .rules-group .rule-item");
        if (!ruleItems || ruleItems.length === 0) {
            Utils.toast({ title: '当前没有规则项可清理', type: 'warn' });
            return;
        }

        let removedCount = 0;
        log('开始清理空值规则项...');

        // 使用 while 循环动态查找，因为每次点击删除后，React 都会重新渲染 DOM 树
        let keepChecking = true;
        while (keepChecking) {
            keepChecking = false; // 假设本次没有找到可删的
            const currentRuleItems = document.querySelectorAll(".action-rules-editor .rules-group .rule-item");
            
            // 一次性找出当前页面上所有满足条件的空值项的删除按钮
            let btnsToClick = [];
            for (let i = currentRuleItems.length - 1; i >= 0; i--) {
                const item = currentRuleItems[i];
                const mainContainer = item.querySelector('.rule-item-main');
                if (!mainContainer) continue;

                const targetValueWrapper = mainContainer.querySelector('.target-value');
                if (!targetValueWrapper) continue;

                // 核心修复：精准嗅探空值节点
                // 1. 判断真实 input 的 value
                const inputEl = targetValueWrapper.querySelector('input');
                const isInputValueEmpty = !inputEl || inputEl.value.trim() === '';

                // 2. 判断有没有被选中实体的 tag (如人员、部门等复杂组件)
                const hasTag = !!targetValueWrapper.querySelector('.next-tag');

                // 3. 判断有没有只读文本，且必须不能是灰色的 placeholder 提示文本（如 "请选择", "请输入"）
                const emEl = targetValueWrapper.querySelector('em');
                // 宜搭的空值占位符通常会带有某些特征类名（如 next-select-em 等），或者其文本就是固定的提示语。
                // 最稳妥的方法是：只要有 em 且不是提示语，就认为有值。
                const emText = emEl ? emEl.textContent.trim() : '';
                const isEmPlaceholder = emText === '' || emText.startsWith('请') || emEl.classList.contains('next-select-em');

                // 只有当 input 是空的，且没有实体 tag，且显示的文字是占位符时，才判定为“空值项”
                const isValueEmpty = isInputValueEmpty && !hasTag && isEmPlaceholder;

                if (isValueEmpty) {
                    const delBtn = mainContainer.querySelector('.rules-delect-btn') || mainContainer.querySelector('.rules-delect-div img');
                    if (delBtn) {
                        btnsToClick.push(delBtn);
                    }
                }
            }

            // 批量执行删除
            if (btnsToClick.length > 0) {
                for (const btn of btnsToClick) {
                    btn.click();
                    removedCount++;
                    await Utils.sleep(100); // 给每次点击留出极短的处理时间
                }
                // 全部点击完后，由于 DOM 结构会大变，所以标记继续大循环去重新嗅探是否还有遗漏
                keepChecking = true;
                await Utils.sleep(300); // 批量删除完后多等一会儿，让宜搭完成重绘
            }
        }

        if (removedCount > 0) {
            log(`清理完成，共移除了 ${removedCount} 个空值项`, 'success');
            Utils.toast({ title: `已清理 ${removedCount} 个空值项`, type: 'success' });
        } else {
            log('清理完成，没有发现空值项');
            Utils.toast({ title: '没有发现空值项', type: 'info' });
        }
    };

    const handleFillOne = async () => {
        // 每次手动点击前，清除之前可能存在的失败标记，允许重试
        document.querySelectorAll(".action-rules-editor .rules-group .rule-item").forEach(item => {
            delete item.dataset.fillFailed;
        });
        await FormFillService.event_fillOne();
    };

    const handleFillAll = async () => {
        setIsFillingAll(true);
        StateModule.fillAllPaused = false;

        // 覆盖原生的状态回调函数以便更新 React UI
        StateModule.fillAllToggleButtons = (running) => {
            setIsFillingAll(running);
        };

        // 每次手动点击前，清除之前可能存在的失败标记，允许重试
        document.querySelectorAll(".action-rules-editor .rules-group .rule-item").forEach(item => {
            delete item.dataset.fillFailed;
        });

        await FormFillService.event_fillAll();

    };

    const handlePause = () => {
        StateModule.fillAllPaused = true;
        setIsFillingAll(false);
        if (StateModule.logAppend) StateModule.logAppend('已请求暂停填充全部');
    };

    const MODES = [
        { 
            value: 'A', 
            label: 'A：忽略缺失', 
            tips: '适合完全匹配字段的处理。将不匹配的值设置为空白，不做任何处理。' 
        },
        { 
            value: 'B', 
            label: 'B：转为公式', 
            tips: '适合明细表类型，将匹配的值使用字段的方式填充，不匹配的值转换为公式类型，并尝试从公式中获取值。' 
        },
        { 
            value: 'C', 
            label: 'C：文本优先', 
            tips: '适合发起审批类型的表单，优先匹配带有“文本”后缀的字段（如：审批状态 -> 审批状态文本）。' 
        }
    ];

    const currentModeTips = MODES.find(m => m.value === mode)?.tips || '';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px 12px 34px 12px', height: '100%', boxSizing: 'border-box' }}>
            <div style={{ fontWeight: 600, color: '#333', fontSize: '14px' }}>字段规则自动填充</div>
            {/*             
            <div style={{ color: '#666', fontSize: '12px', lineHeight: 1.5 }}>
                本功能专用于 `newDesigner` 下的数据源规则配置自动填充。
            </div> */}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#666' }}>模式：</span>
                    <select
                        className="st-select"
                        value={mode}
                        onChange={e => setMode(e.target.value)}
                        style={{ flex: 1 }}
                    >
                        {MODES.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                </div>
                <div style={{ fontSize: '12px', color: '#999', paddingLeft: '44px' }}>
                    * {currentModeTips}
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#666', whiteSpace: 'nowrap' }}>数据源：</span>
                <div style={{ display: 'flex', flex: 1, gap: '8px', minWidth: 0 }}>
                    <select
                        className="st-select"
                        value={dataSource}
                        onChange={e => setDataSource(e.target.value)}
                        style={{ flex: 1, minWidth: 0 }}
                    >
                        {dataSourceOptions.length === 0 && <option value="">无数据源选项</option>}
                        {dataSourceOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.text}</option>
                        ))}
                    </select>
                    <button 
                        className="st-btn" 
                        onClick={handleRefreshDS}
                        disabled={isLoadingDS}
                        style={{ padding: '0 12px', fontSize: '12px', height: '28px', whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                        {isLoadingDS ? '刷新中...' : '刷新'}
                    </button>
                    <button 
                        className="st-btn" 
                        onClick={handleClearEmpty}
                        disabled={isFillingAll}
                        style={{ padding: '0 12px', fontSize: '12px', height: '28px', whiteSpace: 'nowrap', flexShrink: 0, color: '#ff4d4f', borderColor: '#ff4d4f' }}
                        title="移除当前规则列表中所有的空值（未配置值）项"
                    >
                        清空缺失值
                    </button>
                </div>
            </div>

            {mode === 'B' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '12px', color: '#666', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={fillSameField}
                            onChange={e => setFillSameField(e.target.checked)}
                        />
                        （Beta）填充公式为主表相同字段（如果字段不匹配则设置为空白）
                    </label>
                </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                    className="st-btn st-btn-primary"
                    style={{ flex: 1 }}
                    onClick={handleFillOne}
                    disabled={isFillingAll}
                >
                    填充一条数据
                </button>

                {!isFillingAll ? (
                    <button
                        className="st-btn"
                        style={{ flex: 1, background: '#722ed1', color: '#fff' }}
                        onClick={handleFillAll}
                    >
                        填充全部数据
                    </button>
                ) : (
                    <button
                        className="st-btn st-btn-warn"
                        style={{ flex: 1 }}
                        onClick={handlePause}
                    >
                        暂停
                    </button>
                )}
            </div>
        </div>
    );
};

export default FillPanel;