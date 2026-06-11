import global from '../global.js';
import Utils from '@/services/shared/BrowserUtilsService';
import UIModule from '@/services/ui/UiMountService';

import InterfaceService from './InterfaceService.js';

export default class ScriptService {
    static async init() {
        try {
            const urlObj = new URL(window.location.href);
            const host = urlObj.hostname;   // 域名，例如：www.baidu.com
            const path = urlObj.pathname;   // 路径，例如：/path/to/page
            const pathSegments = path.split('/').filter(seg => seg.length > 0);// 路径段，例如：['path', 'to', 'page']

            const appIdMatch = window.location.href.match(/APP_[A-Z0-9]+/);
            const formUuidMatch = window.location.href.match(/FORM-[A-Z0-9]+/); // 修复: 表单ID通常是 FORM-
            const viewUuidMatch = window.location.href.match(/VIEW-[A-Z0-9]+/);


            global.services = new InterfaceService();
            global.info = { // 修复: 保持为 global.info，避免其他模块报错
                appId: appIdMatch?.[0] || null,
                formUuid: formUuidMatch?.[0] || null,
                viewUuid: viewUuidMatch?.[0] || null,
                processCode: urlObj.searchParams.get('processCode'),
                domain: host.split('.')[0], // 域名，例如：h4qx2h
                baseUrl: `${urlObj.protocol}//${host}`, // 修复: 使用已定义的 host
                searchParams: urlObj.searchParams,
                csrfToken: await global.services.getCsrfToken(),
            };


            // 交给 UIModule 来处理 React 的初始化，避免在 .js 文件中写 JSX
            UIModule.initReactApp();

        } catch (error) {
            Utils.toast({ title: "[ScriptService] 脚本初始化失败", type: "error", });
            console.error("[ScriptService] 脚本初始化失败", error);
            return null;
        }
    }
}
