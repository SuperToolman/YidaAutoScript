/**
 * 配置模块
 * 提供脚本的全局配置，如图标、颜色等。
 */

import Utils from './BrowserUtilsService.js';

export default class Config {
    static ICONS = {
        APP: `<svg viewBox="0 0 1024 1024" width="14" height="14"><path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z" fill="#1890ff"/><path d="M512 140c-205.4 0-372 166.6-372 372s166.6 372 372 372 372-166.6 372-372-166.6-372-372-372zm0 668c-163.6 0-296-132.4-296-296s132.4-296 296-296 296 132.4 296 296-132.4 296-296 296z" fill="#e6f7ff" opacity="0.3"/><path d="M512 232c-154.6 0-280 125.4-280 280s125.4 280 280 280 280-125.4 280-280-125.4-280-280-280zm0 484c-112.8 0-204-91.2-204-204s91.2-204 204-204 204 91.2 204 204-91.2 204-204 204z" fill="#1890ff"/></svg>`,
        FORM: `<svg viewBox="0 0 1024 1024" width="14" height="14"><path d="M854.6 288.7L639.4 73.4c-6-6-14.2-9.4-22.7-9.4H192c-17.7 0-32 14.3-32 32v832c0 17.7 14.3 32 32 32h640c17.7 0 32-14.3 32-32V311.3c0-8.5-3.4-16.6-9.4-22.6zM790.2 326H602V137.8L790.2 326z m1.8 562H232V136h302v216c0 23.2 18.8 42 42 42h216v494z" fill="#666"/></svg>`,
        FIELD: `<svg viewBox="0 0 1024 1024" width="12" height="12"><path d="M880 112H144c-17.7 0-32 14.3-32 32v736c0 17.7 14.3 32 32 32h736c17.7 0 32-14.3 32-32V144c0-17.7-14.3-32-32-32z m-40 728H184V184h656v656z" fill="#999"/><path d="M184 840h656V184H184v656zM320 360h384v64H320z m0 176h384v64H320z" fill="#ccc"/></svg>`,
        SUB_FORM: `<svg viewBox="0 0 1024 1024" width="12" height="12"><path d="M880 112H144c-17.7 0-32 14.3-32 32v736c0 17.7 14.3 32 32 32h736c17.7 0 32-14.3 32-32V144c0-17.7-14.3-32-32-32z m-40 728H184V184h656v656z" fill="#1890ff"/><path d="M328 328h368v368H328z" fill="#e6f7ff"/><path d="M368 368h288v64H368z m0 104h288v64H368z m0 104h288v64H368z" fill="#91d5ff"/></svg>`,
        code: `<svg t="1770346286966" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="7377" width="200" height="200"><path d="M516 673c0 4.4 3.4 8 7.5 8h185c4.1 0 7.5-3.6 7.5-8v-48c0-4.4-3.4-8-7.5-8h-185c-4.1 0-7.5 3.6-7.5 8v48zM321.1 679.1l192-161c3.8-3.2 3.8-9.1 0-12.3l-192-160.9c-5.2-4.4-13.1-0.7-13.1 6.1v62.7c0 2.4 1 4.6 2.9 6.1L420.7 512l-109.8 92.2c-1.8 1.5-2.9 3.8-2.9 6.1V673c0 6.8 7.9 10.5 13.1 6.1z" p-id="7378"></path><path d="M880 112H144c-17.7 0-32 14.3-32 32v736c0 17.7 14.3 32 32 32h736c17.7 0 32-14.3 32-32V144c0-17.7-14.3-32-32-32z m-40 728H184V184h656v656z" p-id="7379"></path></svg>`,
        loading: `<svg viewBox="0 0 1024 1024" width="14" height="14" class="st-spin"><path d="M512 64c247.4 0 448 200.6 448 448S759.4 960 512 960 64 759.4 64 512 264.6 64 512 64zm0 820c205.4 0 372-166.6 372-372s-166.6-372-372-372-372 166.6-372 372 166.6 372 372 372z" fill="#e6f7ff"/><path d="M512 64c-247.4 0-448 200.6-448 448 0 12.6 10.2 22.8 22.8 22.8s22.8-10.2 22.8-22.8c0-222.2 180.2-402.4 402.4-402.4S914.4 289.8 914.4 512c0 12.6 10.2 22.8 22.8 22.8s22.8-10.2 22.8-22.8C960 264.6 759.4 64 512 64z" fill="#1890ff"/></svg>`
    };

    /**
     * 获取SVG图标字符串
     * @param {string} svgString SVG字符串
     * @returns {string} 处理后的SVG字符串
     */
    static getIcon(svgString) {
        return svgString;
    }

    /**
     * 注入自定义样式
     * @returns {void}
     */
    static injectStyles() {
        const styleId = 'yida-toolbox-styles';
        if (document.getElementById(styleId)) return;
        const css = `
        #script-toolbox {
            position: fixed;
            top: 60px;
            left: 20px;
            z-index: 9999;
            background: white;
            border: 1px solid #e8e8e8;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            width: 300px;
            height: 80vh;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transition: opacity 0.2s, transform 0.2s;
        }
        .st-header {
            display: flex;
            align-items: center;
            background: #f5f5f5;
            border-bottom: 1px solid #e8e8e8;
            height: 36px;
            padding: 0 8px 0 12px;
            cursor: move;
            user-select: none;
        }
        .st-title {
            flex: 1;
            font-weight: 600;
            font-size: 13px;
            color: #333;
        }
        .st-controls {
            display: flex;
            gap: 4px;
        }
        .st-icon-btn {
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            border-radius: 4px;
            color: #1890ff;
            transition: background 0.2s;
            font-size: 16px;
            line-height: 1;
        }
        .st-icon-btn > span {
            width: 16px;
            height: 16px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }
        .st-icon-btn svg {
            width: 16px !important;
            height: 16px !important;
            display: block;
            pointer-events: none;
            fill: currentColor !important;
            stroke: currentColor !important;
        }
        .st-icon-btn svg path,
        .st-icon-btn svg circle,
        .st-icon-btn svg rect,
        .st-icon-btn svg polygon,
        .st-icon-btn svg line,
        .st-icon-btn svg polyline {
            fill: currentColor !important;
            stroke: currentColor !important;
        }
        .st-icon-btn:hover {
            background: #e6e6e6;
            color: #1677ff;
        }
        .st-tabs {
            display: flex;
            border-bottom: 1px solid #e8e8e8;
            background: #fff;
        }
        .st-tab {
            flex: 1;
            text-align: center;
            padding: 10px 0;
            cursor: pointer;
            font-size: 13px;
            color: #666;
            transition: all 0.2s;
            border-bottom: 2px solid transparent;
            background: #fafafa;
        }
        .st-tab:hover {
            color: #1890ff;
            background: #fff;
        }
        .st-tab.active {
            color: #1890ff;
            border-bottom-color: #1890ff;
            background: #fff;
            font-weight: 500;
        }
        .st-content-area {
            padding: 12px;
            background: #fff;
            flex: 1;
            min-height: 0;
            overflow-y: auto;
        }
        .st-row {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
            gap: 8px;
        }
        .st-label {
            font-size: 12px;
            color: #666;
            white-space: nowrap;
        }
        .st-select, .st-input {
            flex: 1;
            padding: 5px 8px;
            border: 1px solid #d9d9d9;
            border-radius: 4px;
            font-size: 12px;
            outline: none;
            transition: all 0.2s;
            min-width: 0;
            box-sizing: border-box;
        }
        .st-select:focus, .st-input:focus {
            border-color: #40a9ff;
            box-shadow: 0 0 0 2px rgba(24,144,255,0.2);
        }
        .st-btn {
            padding: 6px 12px;
            border-radius: 4px;
            border: none;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s;
            outline: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            user-select: none;
        }
        .st-btn:active {
            transform: translateY(1px);
        }
        .st-btn-primary { background: #1890ff; color: white; }
        .st-btn-primary:hover { background: #40a9ff; }
        .st-btn-purple { background: #722ed1; color: white; }
        .st-btn-purple:hover { background: #9254de; }
        .st-btn-success { background: #52c41a; color: white; }
        .st-btn-success:hover { background: #73d13d; }
        .st-btn-warn { background: #fa8c16; color: white; }
        .st-btn-warn:hover { background: #ffc069; }
        .st-btn-danger { background: #f5222d; color: white; }
        .st-btn-danger:hover { background: #ff4d4f; }
        .st-btn-small { padding: 4px 8px; font-size: 11px; }
        .st-btn-block { width: 100%; margin-bottom: 8px; }
        .st-btn-icon { padding: 4px 8px; background: #f0f0f0; color: #666; border: 1px solid #d9d9d9; }
        .st-btn-icon:hover { background: #e6e6e6; color: #333; }
        [data-yida-copy-btn="1"] { margin-right: 6px; }
        .st-captured-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .st-captured-item {
            transition: all 0.2s;
        }
        .st-captured-item:hover {
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transform: translateY(-1px);
        }
        .st-modal-mask {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.45);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        }
        .st-modal {
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.2);
            width: 420px;
            max-width: calc(100vw - 32px);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .st-modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            border-bottom: 1px solid #f0f0f0;
            font-weight: 600;
            color: #333;
        }
        .st-modal-title {
            font-size: 14px;
        }
        .st-modal-body {
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .st-modal-footer {
            padding: 12px 16px 16px;
            display: flex;
            justify-content: flex-end;
        }

        .st-log-title {
            padding: 0 12px 4px;
            font-size: 12px;
            color: #333;
            font-weight: 500;
            border-top: 1px solid #f0f0f0;
            padding-top: 8px;
        }
        .st-log-area {
            margin: 0 12px 12px;
            padding: 8px;
            background: #fafafa;
            border: 1px solid #e8e8e8;
            border-radius: 4px;
            height: 150px;
            overflow-y: auto;
            font-size: 11px;
            line-height: 1.5;
            color: #666;
            font-family: monospace;
        }
        .st-log-area::-webkit-scrollbar { width: 6px; height: 6px; }
        .st-log-area::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }
        .st-log-area::-webkit-scrollbar-track { background: transparent; }

        .st-floater {
            position: fixed;
            top: 120px;
            left: 0;
            z-index: 9998;
            width: 36px;
            height: 36px;
            background: #1890ff;
            border-radius: 0 4px 4px 0;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 2px 2px 8px rgba(0,0,0,0.15);
            transition: all 0.2s;
            color: white;
            font-size: 20px;
            opacity: 0.8;
        }
        .st-floater:hover {
            width: 44px;
            opacity: 1;
        }

        /* Designer Panel Styles */
        .st-designer-panel {
            position: fixed;
            top: 48px;
            right: 48px;
            bottom: 0;
            width: 700px;
            height: 80vh;
            background: white;
            border-left: 1px solid #e8e8e8;
            z-index: 999;
            display: none;
            flex-direction: column;
            box-shadow: -2px 0 8px rgba(0,0,0,0.1);
        }
        .lc-panel-title.actived {
            height: 48px;
            display: flex;
            align-items: center;
            padding: 0 16px;
            border-bottom: 1px solid #e8e8e8;
            font-weight: 500;
            font-size: 14px;
            color: #111;
        }

        /* Sidebar Layout Styles */
        .st-sidebar-layout {
            display: flex;
            flex: 1;
            overflow: hidden;
        }
        .st-sidebar {
            width: 80px;
            background: #f5f5f5;
            border-right: 1px solid #e8e8e8;
            display: flex;
            flex-direction: column;
        }
        .st-sidebar-item {
            padding: 12px 4px;
            text-align: center;
            cursor: pointer;
            font-size: 12px;
            color: #666;
            border-bottom: 1px solid #eee;
            transition: all 0.2s;
        }
        .st-sidebar-item:hover {
            background: #fff;
            color: #1890ff;
        }
        .st-sidebar-item.active {
            background: #fff;
            color: #1890ff;
            font-weight: 500;
            border-right: 2px solid #1890ff;
            margin-right: -1px;
        }
        .st-sidebar-content {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
            background: #fff;
            display: flex;
            flex-direction: column;
            min-height: 0;
        }
        .st-schema-editor-host {
            height: 100%;
        }
        .st-schema-editor-host .CodeMirror {
            height: 100%;
        }
        .st-schema-editor-host .CodeMirror-scroll {
            overflow: auto;
        }
        .st-schema-editor-textarea {
            width: 100%;
            height: 100%;
            overflow: auto;
            white-space: pre;
        }
    `;
        Utils.addStyle(css, styleId);
    }
}

