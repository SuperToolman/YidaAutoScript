import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import SidebarLayout from './SidebarLayout';
import UIModule from '@/services/ui/UiMountService';
import { useExternalDom } from '../hooks/useExternalDom';

const ToolboxContainer = ({ title, tabs, defaultTab, targetSelector = '.lc-top-area-right', insertPosition = 'prepend', renderTrigger }) => {
    const [visible, setVisible] = useState(false);
    const [panelContainer, setPanelContainer] = useState(null);
    const [triggerContainer, setTriggerContainer] = useState(null);

    const targetNav = useExternalDom(targetSelector);

    useEffect(() => {
        // 创建面板容器
        const panel = document.createElement('div');
        panel.className = 'st-react-panel-container';
        panel.style.display = 'none';
        panel.style.position = 'fixed';
        panel.style.top = '80px';
        panel.style.right = '24px';
        panel.style.zIndex = '999999';
        panel.style.background = 'white';
        panel.style.border = '1px solid #e8e8e8';
        panel.style.borderRadius = '8px';
        panel.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        document.body.appendChild(panel);
        setPanelContainer(panel);

        // 创建触发按钮容器
        const trigger = document.createElement('div');
        trigger.className = 'st-sidebar-trigger engine-actionitem';
        trigger.title = "宜搭脚本工具箱";
        trigger.style = "display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:#666;";
        setTriggerContainer(trigger);

        return () => {
            if (panel.parentNode) panel.parentNode.removeChild(panel);
            if (trigger.parentNode) trigger.parentNode.removeChild(trigger);
        };
    }, []);

    // 挂载触发按钮到导航栏
    useEffect(() => {
        if (!triggerContainer) return;
        
        if (targetNav) {
            triggerContainer.style.position = 'relative';
            triggerContainer.style.bottom = 'auto';
            triggerContainer.style.right = 'auto';
            triggerContainer.style.background = 'transparent';
            triggerContainer.style.borderRadius = '0';
            triggerContainer.style.padding = '0';
            triggerContainer.style.boxShadow = 'none';
            triggerContainer.style.zIndex = 'auto';
            
            if (!triggerContainer.parentNode || triggerContainer.parentNode !== targetNav) {
                if (insertPosition === 'append') {
                    targetNav.appendChild(triggerContainer);
                } else if (targetNav.firstChild) {
                    targetNav.insertBefore(triggerContainer, targetNav.firstChild);
                } else {
                    targetNav.appendChild(triggerContainer);
                }
            }
        } else {
            // 兜底悬浮右下角
            triggerContainer.style.position = 'fixed';
            triggerContainer.style.bottom = '20px';
            triggerContainer.style.right = '20px';
            triggerContainer.style.background = '#fff';
            triggerContainer.style.borderRadius = '50%';
            triggerContainer.style.padding = '10px';
            triggerContainer.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
            triggerContainer.style.zIndex = '99999';
            document.body.appendChild(triggerContainer);
        }
    }, [targetNav, triggerContainer]);

    // 控制显示隐藏与拖拽
    useEffect(() => {
        if (panelContainer) {
            panelContainer.style.display = visible ? 'block' : 'none';
            if (visible) {
                setTimeout(() => {
                    const header = panelContainer.querySelector('.st-header');
                    if (header && !panelContainer.dataset.dragBind) {
                        // UIModule.makeDraggable(header, panelContainer);
                        panelContainer.dataset.dragBind = '1';
                    }
                }, 100);
            }
        }
    }, [visible, panelContainer]);

    if (!panelContainer || !triggerContainer) return null;

    const togglePanel = (e) => {
        e.stopPropagation();
        if (!panelContainer.dataset.positioned) {
            panelContainer.style.top = '80px';
            panelContainer.style.right = '24px';
            panelContainer.style.left = 'auto';
            panelContainer.style.bottom = 'auto';
        }
        setVisible(v => !v);
    };

    return (
        <>
            {createPortal(
                renderTrigger
                    ? renderTrigger({ togglePanel, visible })
                    : (
                        <span className="lc-title lc-dock has-tip only-icon" style={{ cursor: 'pointer' }} onClick={togglePanel}>
                            <b className="lc-title-icon">👾</b>
                        </span>
                    ),
                triggerContainer
            )}
            {createPortal(
                <SidebarLayout tabs={tabs} defaultTab={defaultTab} onClose={() => setVisible(false)} title={title} />,
                panelContainer
            )}
        </>
    );
};

export default ToolboxContainer;