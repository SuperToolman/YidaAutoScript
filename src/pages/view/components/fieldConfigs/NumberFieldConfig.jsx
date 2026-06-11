import React, { useState, useRef, forwardRef, useImperativeHandle } from 'react';

// 通用的开关组件
const Switch = ({ checked, onChange, disabled }) => (
    <div 
        onClick={() => !disabled && onChange(!checked)}
        style={{ 
            width: '36px', height: '18px', borderRadius: '9px', 
            background: checked ? '#1890ff' : 'rgba(0,0,0,0.25)',
            position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer', 
            transition: 'all 0.2s', opacity: disabled ? 0.5 : 1
        }}
    >
        <div style={{
            position: 'absolute', top: '2px', left: checked ? '20px' : '2px',
            width: '14px', height: '14px', borderRadius: '50%', background: '#fff',
            transition: 'all 0.2s', boxShadow: '0 2px 4px 0 rgba(0,35,11,0.2)'
        }} />
    </div>
);

// 配置行组件：包含左侧开关、标签、右侧内容
const ConfigRow = ({ label, propKey, enabledProps, onToggleProp, children }) => {
    const isEnabled = enabledProps[propKey];
    
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '16px', padding: '4px 0' }}>
            <div 
                onClick={() => onToggleProp(propKey, !isEnabled)}
                style={{ display: 'flex', alignItems: 'center', width: '100px', cursor: 'pointer', marginTop: '4px', userSelect: 'none' }}
            >
                <span style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    width: '22px', 
                    height: '22px', 
                    marginRight: '8px',
                    borderRadius: '4px',
                    background: isEnabled ? '#e6f7ff' : '#f5f5f5',
                    color: isEnabled ? '#005fb8' : '#bfbfbf',
                    transition: 'all 0.2s',
                    border: isEnabled ? '1px solid #91caff' : '1px solid #d9d9d9'
                }}>
                    {isEnabled ? (
                        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                    )}
                </span>
                <span style={{ fontSize: '13px', color: isEnabled ? '#333' : '#999', fontWeight: isEnabled ? 500 : 400, transition: 'all 0.2s' }}>{label}</span>
            </div>
            <div style={{ flex: 1, opacity: isEnabled ? 1 : 0.4, pointerEvents: isEnabled ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
                {children}
            </div>
        </div>
    );
};

const NumberFieldConfig = forwardRef((props, ref) => {
    const textareaRef = useRef(null);
    
    // 记录哪些属性被勾选参与批量修改
    const [enabledProps, setEnabledProps] = useState({
        title: false,
        placeholder: false,
        description: false,
        state: false,
        defaultValue: false,
        unit: false,
        precision: false,
        step: false,
        thousandsSeparators: false,
        required: false,
        minValue: false,
        maxValue: false,
        minLength: false,
        maxLength: false,
        customRule: false
    });

    // 具体的属性值
    const [config, setConfig] = useState({
        title: '',
        placeholder: '请输入数字',
        description: '',
        state: 'NORMAL', // NORMAL, DISABLED, READONLY, HIDDEN
        defaultType: 'custom', // custom, formula, linkage
        defaultValue: '',
        unit: '',
        precision: 0,
        step: 1,
        thousandsSeparators: false,
        required: false,
        minValue: '',
        maxValue: '',
        minLength: '',
        maxLength: '',
        customRule: ''
    });

    const [activeTab, setActiveTab] = useState('basic'); // basic, advanced
    const [isValidationOpen, setIsValidationOpen] = useState(true);

    const handleToggleProp = (key, checked) => {
        setEnabledProps(prev => ({ ...prev, [key]: checked }));
    };

    const updateConfig = (key, val) => {
        setConfig(prev => ({ ...prev, [key]: val }));
    };

    const handleInsertVariable = (variable) => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const val = config.defaultValue || '';
        const newVal = val.substring(0, start) + variable + val.substring(end);
        
        updateConfig('defaultValue', newVal);
        
        // 使用 setTimeout 确保在 React 重新渲染后恢复光标位置
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + variable.length, start + variable.length);
        }, 0);
    };

    useImperativeHandle(ref, () => ({
        // 导出用户勾选的配置用于批量修改
        getConfig: () => {
            const finalConfig = {};
            if (enabledProps.title) finalConfig.label = { type: 'i18n', zh_CN: config.title, en_US: config.title };
            if (enabledProps.placeholder) finalConfig.placeholder = { type: 'i18n', zh_CN: config.placeholder, en_US: config.placeholder };
            if (enabledProps.description) finalConfig.tips = { type: 'i18n', zh_CN: config.description, en_US: config.description };
            if (enabledProps.state) finalConfig.behavior = config.state;
            
            if (enabledProps.defaultValue) {
                finalConfig.valueType = config.defaultType;
                if (config.defaultType === 'custom') {
                    finalConfig.value = { type: 'i18n', zh_CN: config.defaultValue, en_US: config.defaultValue };
                } else if (config.defaultType === 'formula') {
                    // 宜搭后端期望 formula 是纯文本字符串，例如：COUNT("FORM-xxx")+1
                    // 兼容用户可能粘贴了带 {"text": "...", "marks": []} 的 JSON 结构
                    let finalFormula = config.defaultValue;
                    try {
                        const parsed = JSON.parse(config.defaultValue);
                        if (parsed && parsed.text) {
                            finalFormula = parsed.text;
                        }
                    } catch (e) {
                        // 解析失败，说明是纯文本公式，直接使用
                    }
                    finalConfig.complexValue = { complexType: 'formula', formula: finalFormula };
                    finalConfig.formula = finalFormula; // 同时外层也写入一份 formula
                }
            }
            
            if (enabledProps.unit) finalConfig.innerAfter = { type: 'i18n', zh_CN: config.unit, en_US: config.unit };
            if (enabledProps.precision) finalConfig.precision = parseInt(config.precision, 10);
            if (enabledProps.step) finalConfig.step = parseFloat(config.step);
            if (enabledProps.thousandsSeparators) finalConfig.thousandsSeparators = config.thousandsSeparators;
            
            // 校验部分
            const validation = [];
            if (enabledProps.required && config.required) {
                validation.push({ type: 'required' });
            }
            if (enabledProps.customRule && config.customRule) {
                validation.push({ type: 'customRule', param: config.customRule });
            }
            if (enabledProps.minValue && config.minValue !== '') {
                validation.push({ type: 'minValue', param: parseFloat(config.minValue) });
            }
            if (enabledProps.maxValue && config.maxValue !== '') {
                validation.push({ type: 'maxValue', param: parseFloat(config.maxValue) });
            }
            if (enabledProps.minLength && config.minLength !== '') {
                validation.push({ type: 'minLength', param: parseInt(config.minLength, 10) });
            }
            if (enabledProps.maxLength && config.maxLength !== '') {
                validation.push({ type: 'maxLength', param: parseInt(config.maxLength, 10) });
            }
            
            if (validation.length > 0) finalConfig.validation = validation;

            return finalConfig;
        },
        // 从剪贴板的 JSON 结构中导入配置并自动勾选对应项
        importConfig: (schema) => {
            const props = schema.props || {};
            const newConfig = { ...config };
            const newEnabled = { ...enabledProps };

            const getText = (obj) => {
                if (!obj) return '';
                if (typeof obj === 'string') return obj;
                return obj.zh_CN || obj.en_US || '';
            };

            // 标题
            if (props.label !== undefined) {
                newConfig.title = getText(props.label);
                newEnabled.title = true;
            }
            // 占位提示
            if (props.placeholder !== undefined) {
                newConfig.placeholder = getText(props.placeholder);
                newEnabled.placeholder = true;
            }
            // 描述信息
            if (props.tips !== undefined) {
                newConfig.description = getText(props.tips);
                newEnabled.description = true;
            }
            // 状态
            if (props.behavior) {
                newConfig.state = props.behavior;
                newEnabled.state = true;
            }
            // 默认值
            if (props.valueType) {
                newConfig.defaultType = props.valueType;
                newEnabled.defaultValue = true;
                if (props.valueType === 'custom' && props.value !== undefined) {
                    newConfig.defaultValue = getText(props.value);
                } else if (props.valueType === 'formula' && props.complexValue) {
                    newConfig.defaultValue = props.complexValue.formula || '';
                }
            }
            // 单位
            if (props.innerAfter !== undefined) {
                newConfig.unit = getText(props.innerAfter);
                newEnabled.unit = true;
            }
            // 小数位数
            if (props.precision !== undefined) {
                newConfig.precision = props.precision;
                newEnabled.precision = true;
            }
            // 步长
            if (props.step !== undefined) {
                newConfig.step = props.step;
                newEnabled.step = true;
            }
            // 千位分隔
            if (props.thousandsSeparators !== undefined) {
                newConfig.thousandsSeparators = props.thousandsSeparators;
                newEnabled.thousandsSeparators = true;
            }

            // 校验
            if (Array.isArray(props.validation)) {
                const req = props.validation.find(v => v.type === 'required');
                if (req) {
                    newConfig.required = true;
                    newEnabled.required = true;
                }
                const minV = props.validation.find(v => v.type === 'minValue');
                if (minV) {
                    newConfig.minValue = minV.param;
                    newEnabled.minValue = true;
                }
                const maxV = props.validation.find(v => v.type === 'maxValue');
                if (maxV) {
                    newConfig.maxValue = maxV.param;
                    newEnabled.maxValue = true;
                }
                const minL = props.validation.find(v => v.type === 'minLength');
                if (minL) {
                    newConfig.minLength = minL.param;
                    newEnabled.minLength = true;
                }
                const maxL = props.validation.find(v => v.type === 'maxLength');
                if (maxL) {
                    newConfig.maxLength = maxL.param;
                    newEnabled.maxLength = true;
                }
                const custom = props.validation.find(v => v.type === 'customRule');
                if (custom) {
                    newConfig.customRule = custom.param || '';
                    newEnabled.customRule = true;
                }
            }

            setConfig(newConfig);
            setEnabledProps(newEnabled);
        }
    }));

    return (
        <div style={{ fontSize: '13px' }}>
            {/* 顶部的 属性/高级 Tab */}
            <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', marginBottom: '16px', justifyContent: 'center' }}>
                <div 
                    onClick={() => setActiveTab('basic')}
                    style={{ 
                        padding: '8px 16px', cursor: 'pointer',
                        color: activeTab === 'basic' ? '#1890ff' : '#666',
                        borderBottom: activeTab === 'basic' ? '2px solid #1890ff' : '2px solid transparent',
                        fontWeight: activeTab === 'basic' ? 600 : 400
                    }}
                >属性</div>
                <div 
                    onClick={() => setActiveTab('advanced')}
                    style={{ 
                        padding: '8px 16px', cursor: 'pointer',
                        color: activeTab === 'advanced' ? '#1890ff' : '#666',
                        borderBottom: activeTab === 'advanced' ? '2px solid #1890ff' : '2px solid transparent',
                        fontWeight: activeTab === 'advanced' ? 600 : 400
                    }}
                >高级</div>
            </div>

            {activeTab === 'basic' && (
                <div>
                    <div style={{ background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: '4px', padding: '8px 12px', marginBottom: '16px', display: 'flex', alignItems: 'flex-start', color: '#666' }}>
                        <span style={{ color: '#1890ff', marginRight: '8px', fontSize: '14px' }}>ⓘ</span>
                        <span>数值最大值为9007199254740991 (16位) ，如有超出的需求请使用单行文本组件替代。</span>
                    </div>

                    {/* 标题 */}
                    <ConfigRow label="标题" propKey="title" enabledProps={enabledProps} onToggleProp={handleToggleProp}>
                        <input 
                            type="text" 
                            className="st-input" 
                            style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #d9d9d9' }}
                            value={config.title}
                            onChange={(e) => updateConfig('title', e.target.value)}
                            placeholder="客户类型"
                        />
                    </ConfigRow>

                    {/* 占位提示 */}
                    <ConfigRow label="占位提示" propKey="placeholder" enabledProps={enabledProps} onToggleProp={handleToggleProp}>
                        <input 
                            type="text" 
                            className="st-input" 
                            style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #d9d9d9' }}
                            value={config.placeholder}
                            onChange={(e) => updateConfig('placeholder', e.target.value)}
                            placeholder="请输入"
                        />
                    </ConfigRow>

                    {/* 描述信息 */}
                    <ConfigRow label="描述信息" propKey="description" enabledProps={enabledProps} onToggleProp={handleToggleProp}>
                        <input 
                            type="text" 
                            className="st-input" 
                            style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #d9d9d9' }}
                            value={config.description}
                            onChange={(e) => updateConfig('description', e.target.value)}
                            placeholder="编辑描述"
                        />
                    </ConfigRow>

                    {/* 状态 */}
                    <ConfigRow label="状态" propKey="state" enabledProps={enabledProps} onToggleProp={handleToggleProp}>
                        <div style={{ display: 'flex', background: '#f5f5f5', borderRadius: '4px', padding: '2px' }}>
                            {['NORMAL', 'DISABLED', 'READONLY', 'HIDDEN'].map((state, idx) => {
                                const labels = ['普通', '禁用', '只读', '隐藏'];
                                const isActive = config.state === state;
                                return (
                                    <div 
                                        key={state}
                                        onClick={() => updateConfig('state', state)}
                                        style={{ 
                                            flex: 1, textAlign: 'center', padding: '4px 0', cursor: 'pointer',
                                            background: isActive ? '#fff' : 'transparent',
                                            borderRadius: '2px',
                                            boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                            color: isActive ? '#333' : '#666'
                                        }}
                                    >
                                        {labels[idx]}
                                    </div>
                                );
                            })}
                        </div>
                    </ConfigRow>

                    {/* 默认值 */}
                    <ConfigRow label="默认值" propKey="defaultValue" enabledProps={enabledProps} onToggleProp={handleToggleProp}>
                        <select 
                            className="st-input" 
                            style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #d9d9d9', marginBottom: '8px', backgroundColor: '#fff' }}
                            value={config.defaultType}
                            onChange={(e) => updateConfig('defaultType', e.target.value)}
                        >
                            <option value="custom">自定义</option>
                            <option value="formula">公式编辑</option>
                            <option value="linkage">数据联动</option>
                        </select>
                        <div>
                            <textarea 
                                ref={textareaRef}
                                className="st-input"
                                style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #d9d9d9', height: '60px', resize: 'vertical' }}
                                value={config.defaultValue}
                                onChange={(e) => updateConfig('defaultValue', e.target.value)}
                                placeholder={config.defaultType === 'custom' ? "请输入默认值" : "编辑公式/联动"}
                            />
                            {config.defaultType === 'formula' && (
                                <div style={{ marginTop: '6px', display: 'flex', gap: '8px' }}>
                                    <span 
                                        onClick={() => handleInsertVariable('{currentFormId}')}
                                        style={{ 
                                            display: 'inline-block', padding: '2px 8px', fontSize: '12px', 
                                            background: '#e6f7ff', color: '#1890ff', border: '1px solid #91d5ff', 
                                            borderRadius: '4px', cursor: 'pointer', userSelect: 'none'
                                        }}
                                        title="点击在光标处插入目标表单UUID"
                                    >
                                        + 目标表单UUID
                                    </span>
                                </div>
                            )}
                        </div>
                    </ConfigRow>

                    {/* 单位 */}
                    <ConfigRow label="单位" propKey="unit" enabledProps={enabledProps} onToggleProp={handleToggleProp}>
                        <input 
                            type="text" 
                            className="st-input" 
                            style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #d9d9d9' }}
                            value={config.unit}
                            onChange={(e) => updateConfig('unit', e.target.value)}
                            placeholder="请输入"
                        />
                    </ConfigRow>

                    {/* 小数位数 */}
                    <ConfigRow label="小数位数" propKey="precision" enabledProps={enabledProps} onToggleProp={handleToggleProp}>
                        <input 
                            type="number" 
                            className="st-input" 
                            style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #d9d9d9' }}
                            value={config.precision}
                            onChange={(e) => updateConfig('precision', e.target.value)}
                            min={0}
                            max={10}
                        />
                    </ConfigRow>

                    {/* 步长 */}
                    <ConfigRow label="步长" propKey="step" enabledProps={enabledProps} onToggleProp={handleToggleProp}>
                        <input 
                            type="number" 
                            className="st-input" 
                            style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #d9d9d9' }}
                            value={config.step}
                            onChange={(e) => updateConfig('step', e.target.value)}
                        />
                    </ConfigRow>

                    {/* 千位分隔 */}
                    <ConfigRow label="千位分隔" propKey="thousandsSeparators" enabledProps={enabledProps} onToggleProp={handleToggleProp}>
                        <div style={{ paddingTop: '6px' }}>
                            <Switch checked={config.thousandsSeparators} onChange={(val) => updateConfig('thousandsSeparators', val)} />
                        </div>
                    </ConfigRow>

                    {/* 校验折叠面板 */}
                    <div style={{ borderTop: '1px solid #f0f0f0', marginTop: '16px', paddingTop: '16px' }}>
                        <div 
                            style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '16px' }}
                            onClick={() => setIsValidationOpen(!isValidationOpen)}
                        >
                            <span style={{ fontWeight: 600 }}>校验</span>
                            <span style={{ transform: isValidationOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
                        </div>

                        {isValidationOpen && (
                            <div>
                                {/* 必填 */}
                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', width: '90px', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={enabledProps.required} onChange={(e) => handleToggleProp('required', e.target.checked)} style={{ marginRight: '6px' }} />
                                        <span style={{ fontSize: '13px', color: enabledProps.required ? '#333' : '#999' }}>必填</span>
                                    </label>
                                    <div style={{ flex: 1, opacity: enabledProps.required ? 1 : 0.5, pointerEvents: enabledProps.required ? 'auto' : 'none' }}>
                                        <input type="checkbox" checked={config.required} onChange={(e) => updateConfig('required', e.target.checked)} />
                                    </div>
                                </div>

                                {/* 最小值 */}
                                <ConfigRow label="最小值" propKey="minValue" enabledProps={enabledProps} onToggleProp={handleToggleProp}>
                                    <input 
                                        type="number" 
                                        className="st-input" 
                                        style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #d9d9d9' }}
                                        value={config.minValue}
                                        onChange={(e) => updateConfig('minValue', e.target.value)}
                                    />
                                </ConfigRow>

                                {/* 最大值 */}
                                <ConfigRow label="最大值" propKey="maxValue" enabledProps={enabledProps} onToggleProp={handleToggleProp}>
                                    <input 
                                        type="number" 
                                        className="st-input" 
                                        style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #d9d9d9' }}
                                        value={config.maxValue}
                                        onChange={(e) => updateConfig('maxValue', e.target.value)}
                                    />
                                </ConfigRow>

                                {/* 最小长度 */}
                                <ConfigRow label="最小长度" propKey="minLength" enabledProps={enabledProps} onToggleProp={handleToggleProp}>
                                    <input 
                                        type="number" 
                                        className="st-input" 
                                        style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #d9d9d9' }}
                                        value={config.minLength}
                                        onChange={(e) => updateConfig('minLength', e.target.value)}
                                        placeholder="0"
                                    />
                                </ConfigRow>

                                {/* 最大长度 */}
                                <ConfigRow label="最大长度" propKey="maxLength" enabledProps={enabledProps} onToggleProp={handleToggleProp}>
                                    <input 
                                        type="number" 
                                        className="st-input" 
                                        style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #d9d9d9' }}
                                        value={config.maxLength}
                                        onChange={(e) => updateConfig('maxLength', e.target.value)}
                                        placeholder="0"
                                    />
                                </ConfigRow>

                                {/* 自定义函数 */}
                                <ConfigRow label="自定义函数" propKey="customRule" enabledProps={enabledProps} onToggleProp={handleToggleProp}>
                                    <input 
                                        type="text" 
                                        className="st-input" 
                                        style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #d9d9d9' }}
                                        value={config.customRule}
                                        onChange={(e) => updateConfig('customRule', e.target.value)}
                                        placeholder="配置自定义函数校验"
                                    />
                                </ConfigRow>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'advanced' && (
                <div style={{ color: '#999', padding: '40px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '32px', marginBottom: '12px' }}>🚧</div>
                    高级配置开发中...
                </div>
            )}
        </div>
    );
});

export default NumberFieldConfig;