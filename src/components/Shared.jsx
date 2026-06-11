/**
 * 共享组件
 * 包含图标、复制按钮等通用组件。
 */

import React, { useState } from 'react';
import Config from '@/services/shared/StyleConfigService';
import Utils from '@/services/shared/BrowserUtilsService';

export const Icon = ({ svgString, style }) => (
    <span
        style={{ display: 'flex', alignItems: 'center', flexShrink: 0, ...style }}
        dangerouslySetInnerHTML={{ __html: Config.getIcon(svgString) }}
    />
);

export const CopyButton = ({ text, value, title, style, onSuccess, className }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e) => {
        e.stopPropagation();
        if (!value) return;
        
        try {
            const success = await Utils.setClipboard(String(value));
            if (success) {
                setCopied(true);
                if (onSuccess) onSuccess();
                setTimeout(() => setCopied(false), 1500);
            }
        } catch (err) {
            console.error('复制失败:', err);
        }
    };

    return (
        <button
            title={title}
            onClick={handleCopy}
            className={className}
            style={{
                border: '1px solid',
                borderColor: copied ? '#52c41a' : '#d9d9d9',
                background: '#fff',
                cursor: 'pointer',
                padding: className ? undefined : '1px 5px',
                borderRadius: '4px',
                fontSize: className ? undefined : '10px',
                color: copied ? '#52c41a' : '#666',
                transition: 'all 0.2s',
                flexShrink: 0,
                ...style
            }}
        >
            {copied ? '已复制' : text}
        </button>
    );
};