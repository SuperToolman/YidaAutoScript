
/**
 * global is 
 */

const global = {
    info: {
        appStructure: [], // 应用完整的架构
        nowPage: "",
        domain: "",
        baseUrl: "",
        processCode: "",
        appId: "",
        formUuid: "",
        viewUuid: "",
        searchParams: null,
        csrfToken: null,
    }, 
    // （旧）fullStructure: null, // 应用完整的架构
    services: null, // 服务函数


    monacoLoading: false,
    monacoConfigured: false,
}


export default global;
