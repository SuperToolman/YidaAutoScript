/**
 * 跨应用API面板组件
 * 显示跨应用API相关功能，如查询单条数据详情、条件搜索等。
 */

import React from 'react';
import { ApiCard } from '../../../components/ApiCard';

const CrossApiPanel = () => {
    const apis = [
        {
            name: '单条数据详情查询',
            desc: '根据数据ID查询单条数据详情',
            code: `
/**
 * formUuid: 表单ID
 * appType: 应用ID
 * dataId: 数据ID
 */
this.dataSourceMap['getFormDataById'].load({
  formUuid: 'FORM-xxx',
  appType: 'APP_xxx',
  dataId: 'FINST-xxx'
}).then(res => {
  console.log('查询结果:', res);
});
            `,
            docUrl: 'https://www.yuque.com/yida/support/aqlu05'
        },
        {
            name: '条件搜索',
            desc: '根据条件搜索表单数据列表',
            code: `
/**
 * formUuid: 表单ID
 * appType: 应用ID
 * searchFieldJson: 查询条件JSON字符串
 */
this.dataSourceMap['getFormDataByCondition'].load({
  formUuid: 'FORM-xxx',
  appType: 'APP_xxx',
  searchFieldJson: JSON.stringify({
    textField_123: 'test'
  })
}).then(res => {
  console.log('搜索结果:', res);
});
            `,
            docUrl: 'https://www.yuque.com/yida/support/aqlu05'
        }
    ];

    return (
        <div style={{ padding: '12px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {apis.map((api, idx) => (
                <ApiCard key={idx} {...api} />
            ))}
        </div>
    );
};

export default CrossApiPanel;