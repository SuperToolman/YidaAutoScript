/**
 * 工具模块
 * 提供通用工具函数，如创建 DOM元素、注入样式等。
 */
import StateModule from './RuntimeStateService.js';

export default class Utils {
    /**
     * 创建DOM元素
     * @param {string} tag 标签名
     * @param {Object} attrs 属性对象 (支持 className, text/textContent, style 等)
     * @returns {Element} 创建的DOM元素
     */
    static create(tag, attrs = {}) {
        const el = document.createElement(tag);

        Object.entries(attrs).forEach(([k, v]) => {
            if (k === 'onclick') el.onclick = v;
            else if (k === 'className') el.className = v;
            else if (k === 'textContent' || k === 'text') el.textContent = v;
            else if (k === 'style') {
                if (typeof v === 'string') el.style.cssText = v;
                else if (typeof v === 'object' && v !== null) {
                    Object.assign(el.style, v);
                }
            }
            else if (k === 'attributes' && v && typeof v === 'object') {
                Object.entries(v).forEach(([ak, av]) => el.setAttribute(ak, av));
            }
            else if (k.startsWith('data-')) el.dataset[k.substring(5)] = v;
            else el[k] = v;
        });
        return el;
    }

    /**
     * 注入样式
     * @param {string} cssText CSS字符串
     * @param {string} styleId 样式标签ID
     * @returns {void}
     */
    static addStyle(cssText, styleId) {
        if (styleId && document.getElementById(styleId)) return;
        if (typeof GM_addStyle === 'function') {
            GM_addStyle(cssText);
            if (styleId) {
                const marker = Utils.create('meta', {
                    id: styleId,
                    attributes: { 'data-type': 'gm_addStyle_marker' }
                });
                document.head.appendChild(marker);
            }
            return;
        }
        const style = Utils.create('style', {
            textContent: cssText,
            ...(styleId ? { id: styleId } : {})
        });
        document.head.appendChild(style);
    }

    /**
     * 打印日志
     * @param {string} msg 日志消息
     * @param {string} level 日志级别（可选，默认：'info'）
     * @returns {void}
     */
    static log(msg, level = 'info') {
        console.log(msg);
    }

    /**
     * 发送JSON请求并处理响应
     * @param {string} url 请求URL
     * @param {Object} options 请求选项
     * @returns {Promise<any>} 响应数据
     */
    static async fetchJson(url, options) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                Utils.log(`[宜搭脚本] 请求失败: ${url} (${response.status})`, 'warn');
                return null;
            }
            return await response.json();
        } catch (e) {
            Utils.log(`[宜搭脚本] 网络请求异常: ${url}`, e, 'error');
            return null;
        }
    }

    /**
     * 复制文本到剪贴板并提供反馈
     * @param {HTMLElement} btn 触发按钮
     * @param {string} text 要复制的文本
     * @param {Object} options 选项 { delay: 1500, emptyText: '内容为空', apply: (btn, state) => {} }
     */
    static async copyWithFeedback(btn, text, options = {}) {
        const { delay = 1500, emptyText = '内容为空', apply } = options;
        if (!text) {
            if (apply) apply(btn, 'empty');
            else {
                const originalText = btn.textContent;
                btn.textContent = emptyText;
                setTimeout(() => { btn.textContent = originalText; }, delay);
            }
            return;
        }

        const success = await Utils.setClipboard(text);
        if (apply) {
            apply(btn, success ? 'success' : 'fail');
            setTimeout(() => { apply(btn, 'restore'); }, delay);
        } else {
            const originalText = btn.textContent;
            const originalColor = btn.style.color;
            const originalBorder = btn.style.borderColor;

            if (success) {
                btn.textContent = '已复制';
                btn.style.color = '#52c41a';
                btn.style.borderColor = '#52c41a';
            } else {
                btn.textContent = '失败';
                btn.style.color = '#ff4d4f';
                btn.style.borderColor = '#ff4d4f';
            }

            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.color = originalColor;
                btn.style.borderColor = originalBorder;
            }, delay);
        }
    }

    /**
     * 写入剪贴板
     * @param {string} text 要写入的文本
     * @returns {Promise<boolean>} 是否成功写入剪贴板
     */
    static async setClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('Failed to copy: ', err);
            // Fallback
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                document.body.removeChild(textArea);
                return true;
            } catch (err2) {
                console.error('Fallback copy failed', err2);
                document.body.removeChild(textArea);
                return false;
            }
        }
    }

    static activeToasts = [];

    /**
     * 显示轻量提示 (Toast)，支持堆叠显示和动画
     * @param {Object|string} options 选项 { title: string, type: 'info'|'success'|'warn'|'error', duration: number } 或者直接传入字符串
     */
    static toast(options) {
        let title = '', type = 'info', duration = 3000;
        if (typeof options === 'string') {
            title = options;
        } else {
            title = options.title || '';
            type = options.type || 'info';
            duration = options.duration || 3000;
        }

        const div = document.createElement('div');
        const bgColor = type === 'error' ? '#ff4d4f' : type === 'success' ? '#52c41a' : type === 'warn' ? '#faad14' : '#1890ff';
        
        div.style.cssText = `
            position: fixed;
            left: 50%;
            transform: translate(-50%, -20px);
            padding: 10px 20px;
            border-radius: 4px;
            color: white;
            z-index: 10001;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            background: ${bgColor};
            transition: all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1);
            opacity: 0;
            display: flex;
            align-items: center;
            pointer-events: none;
        `;
        div.textContent = title;
        document.body.appendChild(div);

        // 强制重绘以应用初始样式
        div.offsetHeight;

        const toastItem = { el: div, height: 0 };
        Utils.activeToasts.push(toastItem);

        // 重新计算所有 toast 的位置
        Utils._recalcToasts();

        // 出现动画
        div.style.opacity = '1';
        div.style.transform = 'translate(-50%, 0)';

        setTimeout(() => {
            div.style.opacity = '0';
            div.style.transform = 'translate(-50%, -20px)';
            setTimeout(() => {
                if (div.parentNode) document.body.removeChild(div);
                Utils.activeToasts = Utils.activeToasts.filter(t => t !== toastItem);
                Utils._recalcToasts();
            }, 300);
        }, duration);
    }

    static _recalcToasts() {
        let currentTop = 20;
        for (const item of Utils.activeToasts) {
            item.el.style.top = currentTop + 'px';
            // 获取实际高度，如果没有获取到则预估一个高度 (比如 40)
            const h = item.el.offsetHeight || 40;
            item.height = h;
            currentTop += h + 16; // 16px 的间距
        }
    }

    /**
     * 暂停执行指定毫秒数
     * @param {number} ms 暂停时间（毫秒）
     * @returns {Promise<void>}
     */
    static sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    /**
     * 等待下一个动画帧
     * @returns {Promise<void>}
     */
    static raf() { return new Promise(r => requestAnimationFrame(r)); }

    /**
     * 等待条件满足或超时
     * @param {Function} fn 检查函数
     * @param {number} timeout 超时时间（毫秒）
     * @param {number} interval 检查间隔（毫秒）
     * @returns {Promise<boolean>} 是否满足条件
     */
    static async waitFor(fn, timeout = 800, interval = 20) {
        const start = Date.now();
        return new Promise(resolve => {
            const check = () => {
                try {
                    if (fn()) {
                        resolve(true);
                        return;
                    }
                } catch (e) {
                    // ignore error
                }
                if (Date.now() - start >= timeout) {
                    resolve(false);
                    return;
                }
                setTimeout(check, interval);
            };
            check();
        });
    }

    /**
     * 获取最后一个规则项
     * @returns {Element|null} 最后一个规则项DOM节点
     */
    static getLastRuleItem() {
        const group = document.querySelector('.action-rules-editor .rules-group');
        if (!group) return null;
        const items = group.querySelectorAll('.rule-item');
        return items.length ? items[items.length - 1] : null;
    }

    static getVisibleSelectMenus() {
        return Array.from(document.querySelectorAll('.next-select-menu'))
            .filter(menu => menu.offsetParent && getComputedStyle(menu).display !== 'none');
    }

    static async openSelect(selectDiv) { 
        selectDiv.click(); 
        await Utils.sleep(200); 
    }

    static async waitVisibleMenu(timeout = 800) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const menus = Utils.getVisibleSelectMenus();
            if (menus.length) return menus[0];
            await new Promise(r => setTimeout(r, 20));
        }
        return null;
    }

    static async selectFirstOption(selectDiv) {
        await Utils.openSelect(selectDiv);
        const menu = await Utils.waitVisibleMenu();
        if (!menu) { document.body.click(); return false; }
        const firstOption = menu.querySelector('.next-menu-item');
        if (!firstOption) { document.body.click(); return false; }
        firstOption.click();
        await Utils.raf();
        return true;
    }

    static selectMenuItemByTitle(menu, title) {
        const item = menu.querySelector(`li[title="${title}"]`) ||
            Array.from(menu.querySelectorAll('.next-menu-item'))
                .find(i => (i.getAttribute('title') || i.textContent.trim()) === title);
        if (!item) return false;
        item.click();
        return true;
    }

    static async waitInputAriaValueText(inputEl, valueText, timeout = 600) {
        return await Utils.waitFor(() => inputEl && inputEl.getAttribute('aria-valuetext') === valueText, timeout, 20);
    }

    static normalizeLabel(text) {
        return (text || '').replace(/\u00a0/g, ' ').replace(/\s+/g, '').trim();
    }

    static getNodeLabel(li) {
        const labelEl = li.querySelector('.single-item-label');
        const label = (labelEl && (labelEl.getAttribute('title') || labelEl.textContent)) || li.getAttribute('datalabel') || li.textContent || '';
        return Utils.normalizeLabel(label);
    }

    static triggerReactEvent(el, type = 'click') {
        if (!el) return false;
        try {
            el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
        } catch (_) { }
        try {
            const reactKey = Object.keys(el).find(key =>
                key.startsWith('__reactProps$') || key.startsWith('__reactEventHandlers$'));
            if (reactKey) {
                const reactProps = el[reactKey];
                const handler = type === 'mousedown' ? reactProps.onMouseDown : reactProps.onClick;
                if (handler) {
                    handler({
                        target: el,
                        currentTarget: el,
                        type,
                        nativeEvent: new MouseEvent(type, { bubbles: true, cancelable: true }),
                        preventDefault: () => { },
                        stopPropagation: () => { },
                        persist: () => { }
                    });
                    return true;
                }
            }
        } catch (_) { }
        return true;
    }

    static logToPanel(text, level = 'info') {
        if (typeof StateModule.logAppend === 'function') {
            StateModule.logAppend(text, level);
        }
    }

    /**
     * 从原始数据中提取应用结构
     * @param {object} raw 原始数据对象
     * @returns {Array} 应用结构数组
     */
    static getFullStructureApps(raw) {
        // Utils.log('[Utils.getFullStructureApps] getFullStructureApps的raw：（请到控制台查看）');
        // console.log("getFullStructureApps的raw为", raw);
        if (Array.isArray(raw)) return raw;
        if (!raw || typeof raw !== 'object') return [];
        const content = raw.content;
        if (content && typeof content === 'object') {
            if (Array.isArray(content.data)) return content.data;
            if (Array.isArray(content.list)) return content.list;
        }
        const candidates = [raw.apps, raw.list, raw.data, raw.items, raw.value];
        for (const item of candidates) {
            if (Array.isArray(item)) return item;
        }
        return [];
    }

    /**
     * 加载脚本（仅加载一次）
     * @param {string} url 脚本URL
     * @param {string} id 脚本ID（用于重复检查）
     * @returns {Promise<boolean>} 是否成功加载
     */
    static loadScriptOnce(url, id) {
        return new Promise((resolve, reject) => {
            if (id && document.getElementById(id)) return resolve(true);
            const script = Utils.create('script', {
                id,
                src: url,
                async: true,
                onload: () => resolve(true),
                onerror: () => reject(new Error(`load failed: ${url}`))
            });
            document.head.appendChild(script);
        });
    }

    /**
     * 加载样式表（仅加载一次）
     * @param {string} url 样式表URL
     * @param {string} id 样式表ID（用于重复检查）
     * @returns {Promise<boolean>} 是否成功加载
     */
    static loadStyleOnce(url, id) {
        return new Promise((resolve, reject) => {
            if (id && document.getElementById(id)) return resolve(true);
            const link = Utils.create('link', {
                id,
                rel: 'stylesheet',
                href: url,
                onload: () => resolve(true),
                onerror: () => reject(new Error(`load failed: ${url}`))
            });
        })
    }

    /**
     * 生成随机的表单UUID
     * @returns {string} 33位随机字符串，格式为 FORM-XXXXXXXXXXXXXXXXXXXXXXXXXX
     */
    static generateFormUuid() {
        const prefix = 'FORM-';
        // 定义允许的字符集：0-9 和 A-Z（排除容易混淆的 I、O，但如果你要严格匹配，可以保留全部）
        // 注意：你手上的ID包含J，所以我们保留所有大写字母和数字
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';

        // 生成33位随机字符（因为你的示例是33位）
        for (let i = 0; i < 33; i++) {
            const randomIndex = Math.floor(Math.random() * chars.length);
            result += chars[randomIndex];
        }

        return prefix + result;
    }

    /**
     * 递归获取组件树中的关键信息（label, fieldId, componentId, type）
     * @param {Array} nodes 组件树节点数组
     * @returns {Array} 包含组件关键信息的数组
     */
    static getComponentsTreeKeyValue(nodes) {
        const results = [];
        const traverse = (items) => {
            if (!items || !Array.isArray(items)) return;

            items.forEach(node => {
                const componentName = node.componentName || 'Unknown';

                // 1. 忽略容器组件和子表组件的处理逻辑
                if (['FormContainer', 'PageSection', 'Column', 'ColumnsLayout', 'RootHeader', 'TableField'].includes(componentName)) {
                    // 如果是子表，直接停止递归其子节点
                    if (componentName === 'TableField') return;

                    // 如果是其他容器，继续递归子节点
                    if (node.children && node.children.length) {
                        traverse(node.children);
                    }
                    return;
                }

                // 2. 获取基础信息
                const fieldId = node.fieldId || node.componentId || (node.props && (node.props.fieldId || node.props.componentId));
                const type = componentName || node.type;

                // 3. 获取 titleName 和 label
                // 简化逻辑：主要使用 props.label，保留 props.name 兜底
                let titleName = null;
                let labelStr = componentName;

                if (node.props) {
                    // (A) 检查 props.label (标准 Schema 常用)
                    if (node.props.label) {
                        const labelProp = node.props.label;
                        if (typeof labelProp === 'string') {
                            labelStr = labelProp;
                            titleName = { "zh_CN": labelStr, "en_US": labelStr, "type": "i18n" };
                        } else if (typeof labelProp === 'object') {
                            // 即使是对象，也要确保它是 i18n 格式
                            titleName = labelProp;
                            if (labelProp.zh_CN) labelStr = labelProp.zh_CN;
                            else if (labelProp.en_US) labelStr = labelProp.en_US;
                        }
                    }
                    // (B) 检查 props.name (部分节点结构)
                    else if (node.props.name) {
                        const nameProp = node.props.name;
                        if (typeof nameProp === 'string') {
                            labelStr = nameProp;
                            titleName = { "zh_CN": labelStr, "en_US": labelStr, "type": "i18n" };
                        } else if (typeof nameProp === 'object') {
                            titleName = nameProp;
                            if (nameProp.zh_CN) labelStr = nameProp.zh_CN;
                        }
                    }
                }

                // (C) 兜底：如果都没有找到，构造默认值
                if (!titleName) {
                    titleName = {
                        "zh_CN": labelStr,
                        "en_US": labelStr,
                        "type": "i18n"
                    };
                }

                // 4. 添加到结果集
                if (fieldId) {
                    results.push({
                        label: labelStr,
                        fieldId: fieldId,
                        type: type,
                        titleName: titleName
                    });
                }

                // 5. 递归子节点
                if (node.children && node.children.length) {
                    traverse(node.children);
                }
            });
        };

        traverse(nodes);
        return results;
    }
}

