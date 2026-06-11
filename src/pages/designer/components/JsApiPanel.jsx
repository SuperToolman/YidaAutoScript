/**
 * JS API 面板组件
 * 分类显示常用的 JS API 功能，支持快速查看说明和复制代码。
 */

import React from 'react';
import { ApiCard } from '../../../components/ApiCard';

const JsApiPanel = () => {
    // 将 API 按照功能模块进行分类，提升主次层级和查找效率
    const apiCategories = [
        {
            title: '交互与反馈',
            apis: [
                {
                    title: '弹出对话框 (Dialog)',
                    name: 'this.utils.dialog()',
                    desc: '支持确认、提示等多种模式。',
                    code: `this.utils.dialog({
  method: 'confirm', // 可选: 'alert', 'confirm', 'show'
  title: '提示标题',
  content: '这里是对话框的内容...', // 支持传入 HTML/JSX 字符串
  onOk: () => { console.log('点击了确认'); },
  onCancel: () => { console.log('点击了取消'); }
});`
                },
                {
                    title: '轻量提示 (Toast)',
                    name: 'this.utils.toast()',
                    desc: '弹出后会自动消失，比 Dialog 更无侵入感。',
                    code: `this.utils.toast({
  title: '操作成功',
  type: 'success', // 可选: 'success', 'error', 'warning', 'notice'
  size: 'large'    // 可选: 'large', 'small'
});`
                },
                {
                    title: '图片预览 (Preview Image)',
                    name: 'this.utils.previewImage()',
                    desc: '实现简洁的全局大图查看效果。',
                    code: `this.utils.previewImage({ 
  current: 'https://example.com/image.png' // 填入图片 URL
});`
                }
            ]
        },
        {
            title: '用户与环境',
            apis: [
                {
                    title: '获取登录用户 ID',
                    name: 'this.utils.getLoginUserId()',
                    desc: '获取当前登录用户的 userId。',
                    code: `const userId = this.utils.getLoginUserId();`
                },
                {
                    title: '获取登录用户名',
                    name: 'this.utils.getLoginUserName()',
                    desc: '获取当前登录用户的名称。',
                    code: `const userName = this.utils.getLoginUserName();`
                },
                {
                    title: '获取语言环境',
                    name: 'this.utils.getLocale()',
                    desc: '获取当前页面的语言环境配置。',
                    code: `const locale = this.utils.getLocale(); // 示例输出: 'zh_CN'`
                },
                {
                    title: '判断是否为移动端',
                    name: 'this.utils.isMobile()',
                    desc: '判断当前页面是否在移动端设备下运行。',
                    code: `const isMobile = this.utils.isMobile();`
                }
            ]
        },
        {
            title: '页面与路由',
            apis: [
                {
                    title: '判断是否为提交页',
                    name: 'this.utils.isSubmissionPage()',
                    desc: '判断当前是否处于表单的“提交页”状态。',
                    code: `const isSubmit = this.utils.isSubmissionPage();`
                },
                {
                    title: '判断是否为查看页',
                    name: 'this.utils.isViewPage()',
                    desc: '判断当前是否处于表单的“查看详情页”状态。',
                    code: `const isView = this.utils.isViewPage();`
                },
                {
                    title: '打开新页面',
                    name: 'this.utils.openPage()',
                    desc: '在钉钉环境下会自动调用钉钉原生 API，体验更佳。',
                    code: `this.utils.openPage('https://example.com');`
                }
            ]
        },
        {
            title: '数据与工具',
            apis: [
                {
                    title: '刷新数据源',
                    name: 'this.reloadDataSource()',
                    desc: '重新请求所有配置了“自动加载”为 true 的远程 API 数据源。',
                    code: `this.reloadDataSource().then(() => {
  this.utils.toast({ type: 'success', title: '数据源刷新成功！' });
});`
                },
                {
                    title: '获取时间区间',
                    name: 'this.utils.getDateTimeRange()',
                    desc: '获取当前或指定日期时间所在的起始和结束时间戳区间。',
                    code: `// when: 支持时间戳或 Date 对象
// type: 'year', 'month', 'week', 'day', 'hour', 'minute', 'second'
const [startTime, endTime] = this.utils.getDateTimeRange(new Date(), 'month');`
                },
                {
                    title: '加载远程脚本',
                    name: 'this.utils.loadScript()',
                    desc: '动态加载外部远程 JS 脚本。',
                    code: `this.utils.loadScript('https://example.com/script.js').then(() => {
  console.log('脚本加载完成');
});`
                }
            ]
        }
    ];

    return (
        <div style={{ padding: '12px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {apiCategories.map((category, catIdx) => (
                <div key={catIdx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ 
                        fontSize: '13px', 
                        fontWeight: 600, 
                        color: '#1890ff', 
                        borderBottom: '1px solid #e8e8e8', 
                        paddingBottom: '4px',
                        display: 'flex',
                        alignItems: 'center'
                    }}>
                        <span style={{ 
                            display: 'inline-block', 
                            width: '3px', 
                            height: '12px', 
                            background: '#1890ff', 
                            marginRight: '6px', 
                            borderRadius: '2px' 
                        }}></span>
                        {category.title}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {category.apis.map((api, apiIdx) => (
                            <ApiCard key={apiIdx} {...api} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default JsApiPanel;