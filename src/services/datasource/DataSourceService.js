import global from '../../global.js';
import Utils from '../shared/BrowserUtilsService.js';
import StateModule from '../shared/RuntimeStateService.js';

export default class DataSourceModule {
    static getSelected() {
        return typeof StateModule.fillDataSource === 'string' ? StateModule.fillDataSource : '';
    }
    static setSelected(value) {
        StateModule.fillDataSource = typeof value === 'string' ? value : '';
    }
    static getOptions() {
        return Array.isArray(StateModule.fillDataSourceOptions) ? StateModule.fillDataSourceOptions : [];
    }
    static setOptions(options) {
        StateModule.fillDataSourceOptions = Array.isArray(options) ? options : [];
    }
    static getSelect() {
        return StateModule.fillDataSourceSelect && document.contains(StateModule.fillDataSourceSelect)
            ? StateModule.fillDataSourceSelect
            : null;
    }
    static setSelect(selectEl) {
        StateModule.fillDataSourceSelect = selectEl || null;
    }
    static buildOptions() {
        const opts = [];
        const seen = new Set();
        this.getOptions().forEach(opt => {
            if (opt && opt.value && !seen.has(opt.value)) {
                opts.push(opt);
                seen.add(opt.value);
            }
        });
        if (Array.isArray(StateModule.forms)) {
            StateModule.forms.forEach(form => {
                const title = (form.title && form.title.zh_CN) || form.title || '';
                if (title) {
                    const value = `form:${form.formUuid || title}`;
                    if (!seen.has(value)) {
                        opts.push({ value, text: `表单：${title}` });
                        seen.add(value);
                    }
                }
            });
        }
        return opts;
    }
    static applyOptions(dsSelect, options) {
        if (!dsSelect) return;
        const current = this.getSelected();
        dsSelect.innerHTML = '';
        options.forEach(opt => {
            const o = Utils.create('option', '', opt.text, { value: opt.value, selected: opt.value === current });
            dsSelect.appendChild(o);
        });
        this.setSelected(dsSelect.value);
    }
    static refreshOptions(dsSelect) {
        const options = this.buildOptions();
        this.applyOptions(dsSelect, options);
        return options;
    }
    static bindSelect(dsSelect) {
        if (!dsSelect) return;
        this.setSelect(dsSelect);
        dsSelect.value = this.getSelected();
        dsSelect.onchange = () => { this.setSelected(dsSelect.value); };
    }
    static readFieldPanelOptions() {
        const panel = document.querySelector('.select-field-panel .deep-tree');
        const items = panel ? panel.querySelectorAll('li.next-tree-node.parent-tree-node') : [];
        const opts = [];
        const seen = new Set();
        if (items && items.length) {
            items.forEach(li => {
                const labelEl = li.querySelector('.single-item-label');
                const label = (labelEl && (labelEl.getAttribute('title') || labelEl.textContent)) || li.getAttribute('datalabel') || li.textContent.trim();
                if (label && !seen.has(label)) {
                    seen.add(label);
                    opts.push({ value: label, text: label });
                }
            });
        }
        return opts;
    }

    static getDataSourceLabels() {
        const labels = [];
        const raw = StateModule.fillDataSource;
        if (raw) labels.push(raw);
        let dsSelect = StateModule.fillDataSourceSelect && document.contains(StateModule.fillDataSourceSelect)
            ? StateModule.fillDataSourceSelect
            : null;
        if (!dsSelect) {
            const toolbox = document.querySelector('#script-toolbox');
            const selects = toolbox ? toolbox.querySelectorAll('select') : null;
            if (selects && selects.length > 1) {
                dsSelect = selects[1];
            }
        }
        if (dsSelect) {
            const opt = dsSelect.options[dsSelect.selectedIndex];
            if (opt) {
                if (opt.value) labels.push(opt.value);
                if (opt.textContent) {
                    labels.push(opt.textContent);
                    labels.push(opt.textContent.replace(/^表单：/, '').trim());
                }
            }
        }
        if (raw && raw.startsWith('form:')) labels.push(raw.replace(/^form:/, ''));
        return Array.from(new Set(labels.map(l => Utils.normalizeLabel(l)).filter(Boolean)));
    }

    static findDataSourceNode(panel, labels) {
        const nodes = Array.from(panel.querySelectorAll('li.next-tree-node.parent-tree-node'));
        if (!nodes.length) return null;
        if (labels.length) {
            const matched = nodes.find(li => labels.includes(Utils.normalizeLabel(li.getAttribute('datalabel')))) ||
                nodes.find(li => labels.includes(Utils.getNodeLabel(li)));
            if (matched) return matched;
            return null;
        }
        if (nodes.length === 1) return nodes[0];
        return null;
    }
}

