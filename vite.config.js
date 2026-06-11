import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    react(),
    monkey({
      entry: 'src/main.js',
      userscript: {
        name: '宜搭脚本工具箱Re',
        namespace: 'http://tampermonkey.net/',
        version: '202605180',
        description: '宜搭自动化辅助工具，支持规则填充、表单转换、打印样式调整等功能。',
        author: 'LandeMeng',
        match: [
          'https://*.aliwork.com/alibaba/web/*/design/pageDesigner*',
          'https://*.aliwork.com/dingtalk/web/*/design/pageDesigner*',
          'https://*/dingtalk/web/*/design/newDesigner*',
          'https://*.aliwork.com/*/design/newDesigner.html*',
          'https://*.aliwork.com/*/admin/logicFlow*',
          'https://*.aliwork.com/APP_*/admin/FORM-*',
          'https://*.aliwork.com/APP_*/admin/*dataSet*',
          'https://*.aliwork.com/myApp*',
        ],
        include: [
          'https://*.aliwork.com/myApp*',
        ],
        icon: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
        license: 'MIT',
        downloadURL: 'https://update.greasyfork.org/scripts/564224/%E5%AE%9C%E6%90%AD%E8%84%9A%E6%9C%AC%E5%B7%A5%E5%85%B7%E7%AE%B1.user.js',
        updateURL: 'https://update.greasyfork.org/scripts/564224/%E5%AE%9C%E6%90%AD%E8%84%9A%E6%9C%AC%E5%B7%A5%E5%85%B7%E7%AE%B1.meta.js'
      },
      build: {
        externalGlobals: {
          react: [
            'React',
            (version) => `https://unpkg.com/react@18.2.0/umd/react.production.min.js`,
          ],
          'react-dom': [
            'ReactDOM',
            (version) => `https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js`,
          ],
          xlsx: [
            'XLSX',
            (version) => `https://unpkg.com/xlsx@${version}/dist/xlsx.full.min.js`,
          ],
        },
      },
    }),
  ],
});
