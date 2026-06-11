import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useExternalDom } from '../../../hooks/useExternalDom';

const DataFillingInjector = () => {
    // 监听数据填充弹窗的 header 容器
    const headerNode = useExternalDom('.vs-data-filling-dialog .relation-group-header');

    if (!headerNode) return null;

    return <AutoFillButtonPortal container={headerNode} />;
};

const AutoFillButtonPortal = ({ container }) => {
    const [target, setTarget] = useState(null);
    const matchesRef = React.useRef(null);
    const matchIndexRef = React.useRef(0);
    const rowIndexRef = React.useRef(0);
    const [fillStatus, setFillStatus] = useState('idle'); // 'idle' | 'running' | 'paused'
    const statusRef = React.useRef('idle');

    const setStatus = (s) => {
        setFillStatus(s);
        statusRef.current = s;
    };

    useEffect(() => {
        if (!container) return;
        
        // 创建一个用于挂载的容器
        let div = container.querySelector('.yida-auto-fill-btn-container');
        if (!div) {
            div = Utils.create('div', {
                className: 'yida-auto-fill-btn-container',
                style: 'display: inline-block; margin-left: 12px;'
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

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const getActiveMenuOptions = async (retries = 3) => {
        for (let i = 0; i < retries; i++) {
            // 反向遍历，确保获取到最新挂载/显示的菜单
            const menus = Array.from(document.querySelectorAll('.next-overlay-wrapper .next-select-menu')).reverse();
            const activeMenu = menus.find(m => {
                if (m.offsetParent !== null) return true;
                const wrapper = m.closest('.next-overlay-wrapper');
                if (wrapper) {
                    const style = window.getComputedStyle(wrapper);
                    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
                }
                return false;
            });

            if (activeMenu) {
                const items = Array.from(activeMenu.querySelectorAll('.next-menu-item'));
                if (items.length > 0) {
                    return items.map(item => ({
                        text: item.textContent.trim(),
                        element: item
                    })).filter(item => item.text && !item.text.includes('请选择'));
                }
            }
            // 如果没找到，稍微等一下再试
            await sleep(50);
        }
        return [];
    };

    const executeSearch = async (searchInput, searchText) => {
        if (!searchInput) return;
        console.log(`[搜索过滤] 在搜索框中输入: "${searchText}"`);
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(searchInput, searchText);
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(300); // 给点时间让搜索结果渲染出来
    };

    const attemptSelect = async (textToMatch, isTarget, searchInput) => {
        let activeMenu = null;
        let items = [];
        
        for (let i = 0; i < 10; i++) { // 最多等 500ms
            const menus = Array.from(document.querySelectorAll('.next-overlay-wrapper .next-select-menu')).reverse();
            activeMenu = menus.find(m => {
                if (m.offsetParent !== null) return true;
                const wrapper = m.closest('.next-overlay-wrapper');
                if (wrapper) {
                    const style = window.getComputedStyle(wrapper);
                    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
                }
                return false;
            });

            if (activeMenu) {
                items = Array.from(activeMenu.querySelectorAll('.next-menu-item'));
                if (items.length > 0 || searchInput) {
                    break;
                }
            }
            await sleep(50);
        }

        if (activeMenu) {
            if (items.length === 0) return false;

            // 去空格精确匹配
            const cleanText = textToMatch.replace(/\s+/g, '');
            let itemToClick = items.find(el => el.textContent.replace(/\s+/g, '') === cleanText);

            // 如果是子表单（目标）且由于搜索框有输入，存在结果但没精确匹配到，则盲取第一个（因为搜索结果可能是唯一的/最接近的）
            if (!itemToClick && searchInput && isTarget && items.length > 0) {
                console.log(`[模糊搜索锁定] 未找到精确匹配的 DOM，锁定过滤后的第一个结果: "${items[0].textContent.trim()}"`);
                itemToClick = items[0];
            }

            if (itemToClick) {
                console.log(`[匹配成功] 准备点击选项: "${itemToClick.textContent.trim()}"`);
                itemToClick.scrollIntoView({ block: 'nearest' });
                await sleep(50);
                
                itemToClick.click();
                
                const mouseEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
                itemToClick.dispatchEvent(mouseEvent);
                const mouseUpEvent = new MouseEvent('mouseup', { bubbles: true, cancelable: true });
                itemToClick.dispatchEvent(mouseUpEvent);
                
                await sleep(200);
                return true;
            }
        }
        return false;
    };

    const searchAndSelectMenuItem = async (trigger, textToMatch, isTarget = false, cleanTextToMatch = null) => {
        // 1. 点击展开下拉框
        trigger.click();
        
        // 2. 寻找搜索框
        let searchInput = null;
        for (let i = 0; i < 5; i++) {
            searchInput = trigger.querySelector('.next-select-trigger-search input');
            if (searchInput) break;
            await sleep(50);
        }

        // 3. 直接使用清洗后的文本进行搜索，避免全文本特殊字符导致搜索失败
        const searchText = cleanTextToMatch || textToMatch;
        if (searchInput) {
            await executeSearch(searchInput, searchText);
        }

        // 尝试选中，优先匹配原文本
        let isSuccess = await attemptSelect(textToMatch, isTarget, searchInput);

        // 如果原文本选不中，再尝试直接使用清洗文本进行匹配（无需重新输入搜索）
        if (!isSuccess && cleanTextToMatch && cleanTextToMatch !== textToMatch) {
            console.log(`[降级策略] 完整文本 "${textToMatch}" 匹配失败，尝试选中清洗后的文本 "${cleanTextToMatch}"`);
            isSuccess = await attemptSelect(cleanTextToMatch, isTarget, searchInput);
        }

        if (!isSuccess) {
            console.warn(`[最终失败] 无论原文本还是清洗文本，均未找到/选中选项: "${textToMatch}"`);
        }
        
        return isSuccess;
    };

    const closeAllMenus = async () => {
        // 优先点击弹窗内部的安全区域（如标题栏），避免点击到弹窗外部导致弹窗整体关闭
        const safeArea = document.querySelector('.vs-data-filling-dialog .relation-group-header') || document.querySelector('.vs-data-filling-dialog');
        if (safeArea) {
            safeArea.click();
        } else {
            document.body.click();
        }
        // 不再发送 Escape 键，因为这会触发宜搭 Dialog 本身的 onClose 事件
        await sleep(150);
    };

    const getTriggerText = (trigger) => {
        if (!trigger) return null;
        const inner = trigger.querySelector('.next-select-inner');
        const text = inner ? inner.textContent.trim() : trigger.textContent.trim();
        if (!text || text.includes('请选择') || text.includes('请输入')) return null;
        return text;
    };

    const handleAutoFill = async (mode = 'all') => {
        if (statusRef.current === 'running') return;
        setStatus('running');

        try {
            console.log(`开始自动匹配填充... (模式: ${mode})`);
            
            const dialog = document.querySelector('.vs-data-filling-dialog');
            if (!dialog) {
                console.warn('未找到数据填充弹窗');
                setStatus('idle');
                return;
            }
            
            const rowsContainer = dialog.querySelector('.relation-rows');
            if (!rowsContainer) {
                setStatus('idle');
                return;
            }
            
            if (!matchesRef.current) {
                const initialRows = Array.from(rowsContainer.querySelectorAll('.relation-row'));
                if (initialRows.length === 0) {
                    setStatus('idle');
                    return;
                }
                
                // 收集已经填充的项目，避免重复覆盖
                const alreadyFilledSources = new Set();
                const alreadyFilledTargets = new Set();
                initialRows.forEach(row => {
                    const sTrigger = row.querySelector('.relation-source-select .next-select-trigger');
                    const tTrigger = row.querySelector('.relation-target-select .next-select-trigger');
                    const sText = getTriggerText(sTrigger);
                    const tText = getTriggerText(tTrigger);
                    if (sText && tText) {
                        alreadyFilledSources.add(sText);
                        alreadyFilledTargets.add(tText);
                    }
                });

                const firstRow = initialRows[0];
                
                // 1. 获取主表字段（源）
                const sourceTrigger = firstRow.querySelector('.relation-source-select .next-select-trigger');
                if (!sourceTrigger) {
                    setStatus('idle');
                    return;
                }
                
                sourceTrigger.click(); // 打开菜单
                await sleep(300); // 等待动画
                
                const sourceOptions = await getActiveMenuOptions();
                console.log('读取到主表字段:', sourceOptions.map(o => o.text));
                
                await closeAllMenus();
                
                // 2. 获取子表字段（目标）
                const targetTrigger = firstRow.querySelector('.relation-target-select .next-select-trigger');
                if (!targetTrigger) {
                    setStatus('idle');
                    return;
                }
                
                targetTrigger.click();
                await sleep(300);
                
                const targetOptions = await getActiveMenuOptions();
                console.log('读取到子表字段:', targetOptions.map(o => o.text));
                
                await closeAllMenus();
                
                if (sourceOptions.length === 0 || targetOptions.length === 0) {
                    console.warn('无法读取到完整的字段列表，请手动展开一次下拉框后再试');
                    setStatus('idle');
                    return;
                }

                // 过滤掉已填充的项目，不参与匹配
                const pendingTargetOptions = targetOptions.filter(o => !alreadyFilledTargets.has(o.text));
                let availableSourceOptions = sourceOptions.filter(o => !alreadyFilledSources.has(o.text));

                // 3. 模糊匹配逻辑
                const matches = [];
                
                // 清理字符串用于匹配
                const cleanString = (str) => {
                    return str
                        .replace(/^[A-Z]\./, '') // 去除前缀 "D." 等
                        .replace(/文本$/, '')    // 去除后缀 "文本"
                        .replace(/数值$/, '')
                        .replace(/日期$/, '')
                        .replace(/下拉$/, '')    // 扩展常见的组件后缀
                        .replace(/单选$/, '')
                        .replace(/多选$/, '')
                        .replace(/\s+/g, '')     // 去除空格
                        .toLowerCase();
                };

                for (const targetOpt of pendingTargetOptions) {
                    const targetText = targetOpt.text;
                    const cleanTarget = cleanString(targetText);
                    
                    let bestMatchIndex = -1;
                    let bestMatchText = null;
                    let maxScore = 0;

                    for (let j = 0; j < availableSourceOptions.length; j++) {
                        const sourceOpt = availableSourceOptions[j];
                        const sourceText = sourceOpt.text;
                        const cleanSource = cleanString(sourceText);
                        
                        let score = 0;
                        if (cleanSource === cleanTarget) {
                            score = 100;
                        } else if (cleanSource.includes(cleanTarget) || cleanTarget.includes(cleanSource)) {
                            // 如果互相包含，根据长度差异来打分，长度越接近分数越高
                            const lenDiff = Math.abs(cleanSource.length - cleanTarget.length);
                            score = 80 - lenDiff * 5; // 基础分 80，长度差一个字扣 5 分
                        } else {
                            // 如果都不包含，但可能有公共前缀/子串，比如 "归属公司.名称中文" 和 "归属公司文本" -> 清洗后 "归属公司.名称中文" vs "归属公司"
                            // 我们计算最长公共前缀或包含的字数占比
                            let matchCount = 0;
                            for (let char of cleanTarget) {
                                if (cleanSource.includes(char)) matchCount++;
                            }
                            const matchRatio = matchCount / Math.max(cleanTarget.length, cleanSource.length);
                            if (matchRatio > 0.6) { // 至少有 60% 的字能对上
                                score = 40 + (matchRatio * 20);
                            }
                        }

                        if (score > maxScore && score >= 60) { // 将及格线提高到 60 分，减少误匹配
                            maxScore = score;
                            bestMatchText = sourceText;
                            bestMatchIndex = j;
                        }
                    }

                    if (bestMatchText) {
                        matches.push({ 
                            target: targetText, 
                            source: bestMatchText,
                            cleanTarget: cleanTarget, // 把清理过的文本也存下来用于搜索
                            cleanSource: cleanString(bestMatchText)
                        });
                        // 从可用池中移除已匹配的主表字段，避免一对多重复匹配
                        availableSourceOptions.splice(bestMatchIndex, 1);
                    }
                }

                console.log('模糊匹配结果:', matches);

                if (matches.length === 0) {
                    console.log('没有匹配的字段');
                    setStatus('idle');
                    return;
                }

                matchesRef.current = matches;
                matchIndexRef.current = 0;
                rowIndexRef.current = 0;
            }

            const matches = matchesRef.current;

            // 4 & 5. 边检测边添加行并逐行填充
            while (matchIndexRef.current < matches.length) {
                if (statusRef.current === 'paused') {
                    console.log('填充已暂停');
                    break;
                }

                const i = matchIndexRef.current;
                const match = matches[i];
                let rows = Array.from(rowsContainer.querySelectorAll('.relation-row'));
                
                // 跳过已经填好的行
                while (rowIndexRef.current < rows.length) {
                    const checkRow = rows[rowIndexRef.current];
                    const sText = getTriggerText(checkRow.querySelector('.relation-source-select .next-select-trigger'));
                    const tText = getTriggerText(checkRow.querySelector('.relation-target-select .next-select-trigger'));
                    if (sText && tText) {
                        console.log(`[跳过] 第 ${rowIndexRef.current} 行已存在填充: [源:${sText} -> 目标:${tText}]`);
                        rowIndexRef.current++;
                    } else {
                        break;
                    }
                }

                let currentRowIndex = rowIndexRef.current;
                
                // 如果当前没有足够的行，则点击一次添加按钮
                if (currentRowIndex >= rows.length) {
                    const addBtns = rowsContainer.querySelectorAll('.next-icon-add-circled');
                    if (addBtns.length > 0) {
                        const lastAddBtn = addBtns[addBtns.length - 1];
                        lastAddBtn.click();
                        
                        // 循环等待新行渲染出来
                        let newRows = rows;
                        for(let wait = 0; wait < 15; wait++) {
                            await sleep(100); // 增加等待间隔，防止 React 渲染太慢被跳过
                            newRows = Array.from(rowsContainer.querySelectorAll('.relation-row'));
                            if(newRows.length > rows.length) break;
                        }
                        
                        if (newRows.length === rows.length) {
                            console.warn('添加新行超时，可能是渲染过慢或点击无效');
                        }
                        
                        rows = newRows;
                    } else {
                        console.warn('找不到添加按钮，停止填充');
                        setStatus('idle');
                        break;
                    }
                }
                
                const row = rows[currentRowIndex];
                if (!row) {
                    console.error(`无法获取到第 ${currentRowIndex} 行，可能是添加失败`);
                    setStatus('idle');
                    break;
                }
                
                let isRowValid = true;

                // 填充主表字段（源）
                const sTrigger = row.querySelector('.relation-source-select .next-select-trigger');
                if (sTrigger) {
                    const sourceClicked = await searchAndSelectMenuItem(sTrigger, match.source, false, match.cleanSource);
                    if (!sourceClicked) {
                        console.error(`主表字段 "${match.source}" 匹配点击失败`);
                        isRowValid = false;
                    }
                    await closeAllMenus(); // 确保菜单已关闭
                }

                // 填充子表字段（目标）
                if (isRowValid) {
                    const tTrigger = row.querySelector('.relation-target-select .next-select-trigger');
                    if (tTrigger) {
                        const targetClicked = await searchAndSelectMenuItem(tTrigger, match.target, true, match.cleanTarget);
                        if (!targetClicked) {
                            console.error(`子表单字段 "${match.target}" 匹配点击失败`);
                            isRowValid = false;
                        }
                        await closeAllMenus(); // 确保菜单已关闭
                    }
                }

                // 处理无效/匹配失败的行
                if (!isRowValid) {
                    const delBtn = row.querySelector('.next-icon-ashbin');
                    if (delBtn) {
                        delBtn.click();
                        console.log(`已清理无匹配的目标行: [源:${match.source} -> 目标:${match.target}]`);
                        // 等待直到行数真正减少
                        let newRows = rows;
                        for (let wait = 0; wait < 10; wait++) {
                            await sleep(50);
                            newRows = Array.from(rowsContainer.querySelectorAll('.relation-row'));
                            if (newRows.length < rows.length) break;
                        }
                        rows = newRows;
                    } else {
                        // 如果连垃圾桶都没有（比如只剩最后一行不允许删），那只能放任它留着，然后游标前进
                        rowIndexRef.current++;
                    }
                } else {
                    // 如果填充成功，指向下一行
                    rowIndexRef.current++;
                }

                matchIndexRef.current++;

                if (mode === 'one') {
                    setStatus('paused');
                    break;
                }
            }

            if (matchIndexRef.current >= matches.length) {
                console.log('自动匹配填充完成');
                setStatus('idle');
                matchesRef.current = null;
                matchIndexRef.current = 0;
                rowIndexRef.current = 0;
            }

        } catch (error) {
            console.error('自动填充出错:', error);
            setStatus('idle');
        }
    };

    if (!target) return null;

    return createPortal(
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button 
                className="next-btn next-small next-btn-primary yida-auto-fill-btn"
                style={{ padding: '0 8px', height: '24px', lineHeight: '22px' }}
                onClick={() => handleAutoFill('all')}
                disabled={fillStatus === 'running'}
            >
                {fillStatus === 'paused' ? '继续填充' : '全部填充（Beta）'}
            </button>
            <button 
                className="next-btn next-small next-btn-normal yida-auto-fill-btn"
                style={{ padding: '0 8px', height: '24px', lineHeight: '22px' }}
                onClick={() => handleAutoFill('one')}
                disabled={fillStatus === 'running'}
            >
                填充一条
            </button>
            <button 
                className="next-btn next-small next-btn-warning yida-auto-fill-btn"
                style={{ padding: '0 8px', height: '24px', lineHeight: '22px' }}
                onClick={() => setStatus('paused')}
                disabled={fillStatus !== 'running'}
            >
                暂停
            </button>
            {matchesRef.current && (
                <span style={{ fontSize: '12px', color: '#666' }}>
                    {matchIndexRef.current} / {matchesRef.current.length}
                </span>
            )}
        </div>,
        target
    );
};

export default DataFillingInjector;