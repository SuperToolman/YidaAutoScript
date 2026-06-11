import React, { useState, useRef } from 'react';
import Utils from '@/services/shared/BrowserUtilsService';
import { CopyButton } from '../../../components/Shared';
import * as XLSX from 'xlsx';

const PrintPagePanel = () => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [htmlOutput, setHtmlOutput] = useState('');
    const [cssOutput, setCssOutput] = useState('');
    const fileInputRef = useRef(null);

    // 触发文件选择
    const handleSelectFile = () => {
        fileInputRef.current.click();
    };

    // 处理文件改变
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            setHtmlOutput('');
            setCssOutput('');
        }
    };

    // 模拟生成
    const handleGenerate = async () => {
        if (!selectedFile) {
            Utils.toast({ title: '请先选择需要转换的文件', type: 'warn' });
            return;
        }

        const ext = selectedFile.name.split('.').pop().toLowerCase();
        if (ext !== 'xls' && ext !== 'xlsx') {
            Utils.toast({ title: '当前仅支持 Excel 文件解析！', type: 'warn' });
            return;
        }

        setIsGenerating(true);
        Utils.toast({ title: '正在解析文件并生成打印模板...', type: 'info' });

        try {
            const arrayBuffer = await selectedFile.arrayBuffer();

            // --- Excel 解析逻辑 ---
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
                
                // 转换为基础的 HTML
                let rawHtml = XLSX.utils.sheet_to_html(worksheet);
                
                // 使用 DOMParser 提取 body 内部的 table
                const parser = new DOMParser();
                const doc = parser.parseFromString(rawHtml, 'text/html');
                const table = doc.querySelector('table');
                
                if (table) {
                    // 清理多余的默认样式和属性，只保留基本结构
                    table.removeAttribute('border');
                    table.removeAttribute('style');
                    table.className = 'print-table';

                    const tableHtml = table.outerHTML;

                    const finalHtml = `<!-- 自动生成的 HTML 结构 -->
<div class="print-container">
  <div class="body_div">
    ${tableHtml}
  </div>
</div>`;

                    const finalCss = `/* 自动生成的 CSS 样式 */
/* 标准三联单尺寸：241mm×140mm 无边距 居中 */
html, body {
  margin: 0;
  padding: 0;
  display: flex;
  justify-content: center;
}

.print-container {
  width: 241mm;
  height: 140mm;
  display: flex;
  justify-content: center;
  box-sizing: border-box;
}

.body_div {
  width: 233mm; /* 宽度收缩以适配针式打印机 */
  margin: 0 auto;
}

.print-table {
  width: 94%;
  margin: 0 auto;
  border-collapse: collapse;
  font-size: 12px;
}

.print-table td, .print-table th {
  border: 1px solid #000;
  padding: 4px;
}`;

                    setHtmlOutput(finalHtml);
                    setCssOutput(finalCss);
                    Utils.toast({ title: '生成成功！', type: 'success' });
                } else {
                    Utils.toast({ title: '解析失败，未能从 Excel 中提取到表格结构。', type: 'error' });
                }
        } catch (error) {
            console.error('解析 Excel 时发生错误:', error);
            Utils.toast({ title: '解析 Excel 时发生异常，请查看控制台日志', type: 'error' });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', height: '100%', boxSizing: 'border-box' }}>
            <div style={{ fontWeight: 600, color: '#333', fontSize: '15px' }}>自定义打印转换工具</div>

            <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '6px', fontSize: '12px', color: '#666', lineHeight: '1.6' }}>
                <strong>支持格式：</strong>.xls / .xlsx <br />
                <strong>功能说明：</strong>上传包含表格样式的 Excel 文件，脚本将自动提取结构，并生成适用于 241mm×140mm（二/三联单）的 HTML 与 CSS 代码。
            </div>

            {/* 文件选择区 */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input
                    type="file"
                    accept=".xls,.xlsx"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                />
                <button
                    className="st-btn"
                    onClick={handleSelectFile}
                    style={{
                        padding: '6px 12px',
                        background: '#fff',
                        border: '1px solid #d9d9d9',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    {selectedFile ? '重新选择' : '选择 Excel 文件'}
                </button>
                <span style={{ fontSize: '13px', color: selectedFile ? '#1890ff' : '#999', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedFile ? selectedFile.name : '未选择文件'}
                </span>
                
                <button
                    className={`st-btn ${selectedFile && !isGenerating ? 'st-btn-primary' : ''}`}
                    onClick={handleGenerate}
                    disabled={!selectedFile || isGenerating}
                    style={{
                        padding: '6px 16px',
                        background: (selectedFile && !isGenerating) ? '#1890ff' : '#f5f5f5',
                        color: (selectedFile && !isGenerating) ? '#fff' : '#b8b8b8',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: (selectedFile && !isGenerating) ? 'pointer' : 'not-allowed'
                    }}
                >
                    {isGenerating ? '生成中...' : '开始转换'}
                </button>
            </div>

            {/* 结果展示区 */}
            {htmlOutput && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto' }}>
                    {/* HTML 结果 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600 }}>HTML 代码</span>
                            <CopyButton text={htmlOutput} />
                        </div>
                        <textarea
                            readOnly
                            value={htmlOutput}
                            style={{
                                width: '100%',
                                height: '120px',
                                padding: '8px',
                                background: '#282c34',
                                color: '#abb2bf',
                                border: 'none',
                                borderRadius: '4px',
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                resize: 'vertical'
                            }}
                        />
                    </div>

                    {/* CSS 结果 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600 }}>CSS 代码</span>
                            <CopyButton text={cssOutput} />
                        </div>
                        <textarea
                            readOnly
                            value={cssOutput}
                            style={{
                                width: '100%',
                                height: '120px',
                                padding: '8px',
                                background: '#282c34',
                                color: '#abb2bf',
                                border: 'none',
                                borderRadius: '4px',
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                resize: 'vertical'
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default PrintPagePanel;