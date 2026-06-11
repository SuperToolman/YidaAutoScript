import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useExternalDom } from '../../../hooks/useExternalDom';
import Utils from '@/services/shared/BrowserUtilsService';
import global from '../../../global';
import UIModule from '@/services/ui/UiMountService';
import BatchCopyModal from './BatchCopyModal';

const CopyActionGroup = () => {
    const targetNav = useExternalDom('.BasicPane--Bar--bv5Fiix');
    const [batchModalVisible, setBatchModalVisible] = useState(false);
    const [inputValue, setInputValue] = useState('');

    const handlePaste = async () => {
        let text = '';
        
        if (inputValue && inputValue !== "已读取剪贴板" && inputValue.trim().startsWith('{') || inputValue.trim().startsWith('[')) {
            text = inputValue;
        } else {
            try {
                text = await navigator.clipboard.readText();
                setInputValue(text ? "已读取剪贴板" : "");
            } catch (err) {
                Utils.toast({ title: '读取剪贴板失败，请手动粘贴至输入框后重试', type: 'error' });
                return;
            }
        }

        if (!text) {
            Utils.toast({ title: '没有可用的表单数据', type: 'warn' });
            return;
        }

        try {
            const schemaData = JSON.parse(text);
            
            if (Array.isArray(schemaData)) {
                Utils.toast({ title: `检测到 ${schemaData.length} 个表单，开始批量粘贴...`, type: 'info' });
                for (let i = 0; i < schemaData.length; i++) {
                    try {
                        await global.services.createAndSaveFormFromSchema(schemaData[i]);
                    } catch (e) {
                        console.error(`[CopyActionGroup] 第 ${i + 1} 个表单粘贴失败:`, e);
                        Utils.toast({ title: `第 ${i + 1} 个表单粘贴失败: ${e.message}`, type: 'error' });
                    }
                }
                Utils.toast({ title: '批量粘贴全部完成！请刷新页面查看', type: 'success' });
                setInputValue('');
            } else {
                await global.services.createAndSaveFormFromSchema(schemaData);
                Utils.toast({ title: '粘贴表单成功！请刷新页面查看', type: 'success' });
                setInputValue('');
            }
        } catch (error) {
            Utils.toast({ title: '解析或处理失败: ' + error.message, type: 'error' });
            console.error('[CopyActionGroup] 粘贴表单发生错误:', error);
        }
    };

    const actionContent = (
        <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
            <button 
                onClick={() => setBatchModalVisible(true)}
                style={{ backgroundColor: '#1890ff', border: 'none', fontSize: 14, color: '#fff', height: 32, lineHeight: '32px', marginLeft: 10, borderRadius: 4, padding: '0 12px', cursor: 'pointer' }}
            >
                复制表单
            </button>
            
            <div style={{ width: '1px', height: '20px', backgroundColor: '#e8e8e8', margin: '0 12px' }}></div>
            
            <input 
                type="text"
                placeholder="粘贴表单Schema"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                style={{ width: 145, height: 30, border: '1px solid #dbdbdb', borderRadius: 6, padding: '0 12px', fontSize: 14 }}
            />
            <button 
                onClick={handlePaste}
                style={{ backgroundColor: '#fcdba9', border: 'none', fontSize: 14, color: '#fff', height: 32, width: 32, lineHeight: '32px', marginLeft: 8, borderRadius: 6, cursor: 'pointer' }}
            >
                🍔
            </button>

            <BatchCopyModal visible={batchModalVisible} onClose={() => setBatchModalVisible(false)} />
        </div>
    );

    if (targetNav) {
        // 确保目标容器是 flex 布局，这样 marginLeft: 'auto' 才能生效将内容推到最右侧
        if (getComputedStyle(targetNav).display !== 'flex') {
            targetNav.style.display = 'flex';
            targetNav.style.alignItems = 'center';
            targetNav.style.justifyContent = 'flex-end'; // 默认靠右
        }
        return createPortal(actionContent, targetNav);
    }

    // Fallback if targetNav not found (fixed top right)
    return createPortal(
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999 }}>
            {actionContent}
        </div>,
        document.body
    );
};

export default CopyActionGroup;