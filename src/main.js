import './index.css';
import global from './global.js';
import ScriptService from './services/ScriptService.js';

try {
    ScriptService.init()
        .then(() => {
            console.log("[main] 脚本初始化完成，信息为", global);
        }).catch(err => {
            console.error("[main] 脚本服务初始化失败", err);
        });
}catch(err){
    console.error("[main] 脚本服务初始化失败", err);
}

// test
// global.services.saveFormNavigation("测试分组2","APP_F9712A74XF8WZKSSDIXA").then(res => {
//     console.log(res);
// });

// global.services.registerApp("测试应用222").then(res => {
//     console.log(res);
// });
