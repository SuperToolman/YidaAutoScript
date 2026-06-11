/**
 * UI 模块
 * 提供用户界面相关功能，现在主要作为 React 根组件的挂载点
 */

import Config from '../shared/StyleConfigService.js';
import Utils from '../shared/BrowserUtilsService.js';

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../App.jsx';

export default class UiMountService {
    /**
     * 使元素可拖拽
     * @param {HTMLElement} handle 拖拽手柄
     * @param {HTMLElement} target 拖拽目标
     */
    static makeDraggable(handle, target) {
        let isDragging = false, offsetX = 0, offsetY = 0;
        handle.addEventListener('mousedown', e => {
            if (['BUTTON', 'INPUT'].includes(e.target.tagName) || e.target.classList.contains('st-icon-btn')) return;
            isDragging = true;
            const rect = target.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            document.addEventListener('mousemove', onDrag);
            document.addEventListener('mouseup', stopDrag);
            e.preventDefault();
        });
        function onDrag(e) {
            if (!isDragging) return;
            target.style.left = `${e.clientX - offsetX}px`;
            target.style.top = `${e.clientY - offsetY}px`;
            if (target.style.right) target.style.right = 'auto';
            if (target.style.bottom) target.style.bottom = 'auto';
            target.dataset.positioned = '1';
        }
        function stopDrag() {
            isDragging = false;
            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('mouseup', stopDrag);
        }
    }

    /**
     * 启动 React 应用（所有基于 React 的页面通用入口）
     * 创建一个隐藏的根节点，并将控制权交给 App.jsx 进行路由分发
     * @returns {void}
     */
    static initReactApp() {
        if (document.getElementById('yida-auto-script-root')) return;

        Config.injectStyles();

        // 统一创建一个隐藏的容器作为 React 的挂载点
        const container = Utils.create('div', { id: 'yida-auto-script-root', style: 'display: none;' });
        document.body.appendChild(container);

        const root = createRoot(container);
        root.render(<App />);
    }
}
