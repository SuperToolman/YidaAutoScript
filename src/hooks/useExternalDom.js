import { useState, useEffect } from 'react';

/**
 * 监听并获取外部 DOM 节点
 * @param {string} selector CSS 选择器
 * @returns {HTMLElement|null} 返回匹配的 DOM 节点
 */
export const useExternalDom = (selector) => {
    const [node, setNode] = useState(null);

    useEffect(() => {
        // 初始检查
        let el = document.querySelector(selector);
        if (el) {
            setNode(el);
        }

        // 监听 DOM 变化，直到找到目标节点
        const observer = new MutationObserver(() => {
            const currentEl = document.querySelector(selector);
            if (currentEl !== node) {
                setNode(currentEl);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        return () => observer.disconnect();
    }, [selector, node]);

    return node;
};
