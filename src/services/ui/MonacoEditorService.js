/**
 * Monaco 模块
 * 提供 Monaco 编辑器相关功能，如构建 IFrame 源文档等。
 */


import global from '../../global.js';
import Utils from '../shared/BrowserUtilsService.js';

export default class MonacoModule {
    static buildIframeSrcdoc(editorId, config) {
        const payloadId = JSON.stringify(editorId);
        const payloadCfg = JSON.stringify(config);
        return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>html,body,#container{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#f7f7f7;font-family:Consolas,"Courier New",monospace}*{box-sizing:border-box}</style><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs/editor/editor.main.css"></head><body><div id="container"></div><script>(function(){const editorId=${payloadId};const config=${payloadCfg};let editor=null;let changeTimer=null;const send=(type,payload)=>{window.parent.postMessage(Object.assign({__yida_iframe_editor_id:editorId,type},payload||{}),'*')};const loadScript=(url)=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.async=true;s.onload=()=>resolve(true);s.onerror=()=>reject(new Error('load failed'));document.head.appendChild(s)});const createEditor=()=>{if(!window.require||!window.require.config){send('error',{message:'require missing'});return;}window.require.config({paths:{vs:'https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs'}});window.require(['vs/editor/editor.main'],()=>{const container=document.getElementById('container');editor=window.monaco.editor.create(container,{value:'',language:config.language,theme:config.theme,automaticLayout:true,fontSize:config.fontSize,minimap:{enabled:false},quickSuggestions:true,suggestOnTriggerCharacters:true,parameterHints:{enabled:true},acceptSuggestionOnEnter:'on',tabCompletion:'on',wordBasedSuggestions:true});editor.onDidChangeModelContent(()=>{if(changeTimer)clearTimeout(changeTimer);changeTimer=setTimeout(()=>{send('change',{value:editor.getValue()})},80)});send('ready')})};loadScript('https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs/loader.js').then(createEditor).catch(()=>send('error',{message:'loader failed'}));window.addEventListener('message',(event)=>{const data=event.data||{};if(!data||data.__yida_iframe_editor_id!==editorId)return;if(data.type==='setValue'){const v=typeof data.value==='string'?data.value:'';if(editor)editor.setValue(v);}if(data.type==='layout'){if(editor)editor.layout();}});})();<\/script></body></html>`;
    }

    /**
     * 确保Monaco编辑器已加载
     * @returns {Promise<boolean>} 是否成功加载Monaco编辑器
     */
    static async ensureMonaco() {
        const hasLocalLoader = !!document.getElementById('yida-monaco-loader');
        if (window.monaco && window.monaco.editor) return !!hasLocalLoader;
        if (global.monacoLoading) {
            const ready = await Utils.waitFor(() => window.monaco && window.monaco.editor, 1500, 50);
            return !!(ready && document.getElementById('yida-monaco-loader'));
        }
        if (window.require && !hasLocalLoader) return false;
        global.monacoLoading = true;
        try {
            await Utils.loadStyleOnce('https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs/editor/editor.main.css', 'yida-monaco-css');
            await Utils.loadScriptOnce('https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs/loader.js', 'yida-monaco-loader');
            if (!window.require || !window.require.config) return false;
            window.require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs' } });
            const loaded = await new Promise(resolve => {
                window.require(['vs/editor/editor.main'], () => resolve(true), () => resolve(false));
            });
            if (loaded && window.monaco && window.monaco.editor && !global.monacoConfigured) {
                const ts = window.monaco.languages && window.monaco.languages.typescript;
                if (ts && ts.javascriptDefaults) {
                    ts.javascriptDefaults.setEagerModelSync(true);
                    ts.javascriptDefaults.setCompilerOptions({
                        target: ts.ScriptTarget ? ts.ScriptTarget.ESNext : undefined,
                        allowNonTsExtensions: true,
                        allowJs: true,
                        checkJs: false,
                        jsx: ts.JsxEmit ? (ts.JsxEmit.ReactJSX || ts.JsxEmit.React) : undefined
                    });
                }
                global.monacoConfigured = true;
            }
            return loaded && !!(window.monaco && window.monaco.editor);
        } catch (e) {
            Utils.log('Monaco加载失败', e, 'warn');
        } finally {
            global.monacoLoading = false;
        }
        return false;
    }

    static async createMonacoEditor(host, options = {}) {
        if (!host) return null;
        const langInput = options.language || 'json';
        const languageAliasMap = {
            jsx: 'javascript',
            javascriptreact: 'javascript',
            tsx: 'typescript',
            typescriptreact: 'typescript'
        };
        return await MonacoModule.createIsolatedMonacoEditor(host, {
            ...options,
            language: languageAliasMap[langInput] || langInput
        });
    }

    static async createIsolatedMonacoEditor(host, options = {}) {
        if (!host) return null;
        host.innerHTML = '';
        const createHostIframe = () => {
            const el = Utils.create('iframe', { style: 'width: 100%; height: 100%; border: 0; display: block; background: transparent;' });
            host.appendChild(el);
            return el;
        };
        const buildState = () => ({
            ready: false,
            value: typeof options.value === 'string' ? options.value : '',
            pendingValue: null
        });
        const iframe = createHostIframe();
        const editorId = `yida_iframe_editor_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const state = buildState();
        let textarea = null;
        const post = (payload) => {
            if (iframe.contentWindow) iframe.contentWindow.postMessage(payload, '*');
        };
        const useTextareaFallback = () => {
            if (textarea) return;
            window.removeEventListener('message', onMessage);
            if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
            textarea = Utils.create('textarea', {
                value: state.value,
                style: 'width: 100%; height: 100%; padding: 8px; border: none; font-size: 12px; line-height: 1.4; box-sizing: border-box; resize: none; background: transparent; font-family: Consolas, "Courier New", monospace; outline: none;',
                wrap: 'off'
            });
            host.append(textarea);
        };
        const buildOnMessage = () => (event) => {
            if (event.source !== iframe.contentWindow) return;
            const data = event.data || {};
            if (!data || data.__yida_iframe_editor_id !== editorId) return;
            if (data.type === 'ready') {
                state.ready = true;
                const toSend = state.pendingValue != null ? state.pendingValue : state.value;
                post({ __yida_iframe_editor_id: editorId, type: 'setValue', value: toSend });
                state.pendingValue = null;
                return;
            }
            if (data.type === 'change') {
                state.value = typeof data.value === 'string' ? data.value : '';
                return;
            }
            if (data.type === 'error') {
                useTextareaFallback();
                return;
            }
        };
        const onMessage = buildOnMessage();
        window.addEventListener('message', onMessage);
        const fontSize = typeof options.fontSize === 'number' ? options.fontSize : 12;
        const language = options.language || 'json';
        const theme = options.theme || 'vs';
        const srcdoc = MonacoModule.buildIframeSrcdoc(editorId, { language, theme, fontSize });
        iframe.srcdoc = srcdoc;
        const ready = await Utils.waitFor(() => state.ready, 1500, 50);
        if (!ready) {
            useTextareaFallback();
        }
        return {
            getValue: () => (textarea ? textarea.value : state.value),
            setValue: (next) => {
                const value = typeof next === 'string' ? next : '';
                state.value = value;
                if (textarea) {
                    textarea.value = value;
                    return;
                }
                if (state.ready) post({ __yida_iframe_editor_id: editorId, type: 'setValue', value });
                else state.pendingValue = value;
            },
            layout: () => {
                if (textarea) return;
                if (state.ready) post({ __yida_iframe_editor_id: editorId, type: 'layout' });
            },
            dispose: () => {
                window.removeEventListener('message', onMessage);
                if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
                if (textarea && textarea.parentNode) textarea.parentNode.removeChild(textarea);
            }
        };
    }
}

