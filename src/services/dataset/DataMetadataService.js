/**
 * DataMetadataModule
 * 
 * 负责在数据集导出/复制时，根据数据集类型（如跨应用表单、视图表等）
 * 动态提取并生成附加的元数据（_metadata）信息。
 */

const DataMetadataModule = {
    /**
     * 为选中的数据集列表添加 _metadata 元数据
     * @param {Array} dataList 选中的数据集数组
     * @returns {Array} 注入了 _metadata 的新数组
     */
    enrichMetadata: (dataList) => {
        if (!Array.isArray(dataList)) return [];

        return dataList.map(item => {
            const enrichedItem = { ...item };
            const meta = {};

            switch (item.cubeSourceName) {
                case '跨应用表单':
                    Object.assign(meta, DataMetadataModule.extractCrossAppMetadata(item.name));
                    break;
                // 后续可以继续扩展其他类型，例如：
                // case '视图表':
                //     break;
                default:
                    break;
            }

            // 如果提取到了元数据，则挂载到 _metadata 属性上
            if (Object.keys(meta).length > 0) {
                enrichedItem._metadata = meta;
            }

            return enrichedItem;
        });
    },

    /**
     * 提取跨应用表单的元数据
     * 规则：名称可能为 "应用名称.表单名称" 或 "应用名称.表单名称.子表单名称"
     * @param {string} name 数据集名称
     * @returns {Object} 包含 originalName, appName, fuzzyAppName, formName, fuzzyFormName, subFormName 的对象
     */
    extractCrossAppMetadata: (name) => {
        if (!name) return {};

        const result = {
            originalName: name, // 保留原始完整的名称
            appName: '',
            fuzzyAppName: '',   // 将 fuzzyAppName 移到 appName 下方
            formName: '',
            fuzzyFormName: '',  // 模糊版本的表单名称
            subFormName: ''     // 新增子表字段，默认为空
        };

        // 按点号进行分割
        const parts = name.split('.').map(p => p.trim());
        
        if (parts.length >= 3) {
            // 包含两个或以上点号："应用.表单.子表单"
            result.appName = parts[0];
            result.formName = parts[1];
            // 取最后一部分作为子表单，或者合并剩余部分（如果出现更多点）
            result.subFormName = parts.slice(2).join('.'); 
        } else if (parts.length === 2) {
            // 包含一个点号："应用.表单"
            result.appName = parts[0];
            result.formName = parts[1];
        } else {
            // 没有点号，视为全表单名
            result.formName = parts[0] || '';
        }

        // 提取 fuzzyAppName：去除特殊前缀/后缀、公司缩写等
        if (result.appName) {
            result.fuzzyAppName = DataMetadataModule.generateFuzzyAppName(result.appName);
        }

        // 提取 fuzzyFormName：去除常见的表单后缀干扰词，如“表单”
        if (result.formName) {
            result.fuzzyFormName = result.formName.replace(/表单$/, '').trim() || result.formName;
        }

        return result;
    },

    /**
     * 生成模糊匹配用的应用名称
     * 过滤掉常见的公司前缀或系统缩写前缀，以便于跨组织匹配
     * @param {string} appName 原始应用名称
     * @returns {string} 模糊应用名称
     */
    generateFuzzyAppName: (appName) => {
        let fuzzy = appName;
        
        // 1. 去除常见的特殊符号及前面包含的汉字前缀，比如 "福佳_" -> ""
        // 匹配规则：下划线、短横线前面的部分（如果是比较短的词通常是公司名或代号）
        fuzzy = fuzzy.replace(/^[^_-]+[_\\-]/, '');

        // 2. 去除常见的系统前缀（不区分大小写）
        // 比如 "丹羽ERP财务管理" -> "ERP财务管理" -> "财务管理"
        const prefixReg = /^(丹羽|福佳|ERP|OA|CRM|HRM)+/i;
        
        // 循环去除所有匹配的前缀
        while (prefixReg.test(fuzzy)) {
            fuzzy = fuzzy.replace(prefixReg, '');
        }

        return fuzzy.trim() || appName; // 如果剔除后为空了（比如原名就叫ERP），则降级返回原名
    }
};

export default DataMetadataModule;