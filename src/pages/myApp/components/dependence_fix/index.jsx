import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import AssociationFormFix from './components/AssociationFormFix.jsx';
import FlowFix from './components/FlowFix.jsx';
import CustomButtonSupplement from './components/CustomButtonSupplement.jsx';
// import FlowFix from './components/FlowFixV2.jsx';



const TABS = [
    { key: 'association', label: '关联组件修复' },
    { key: 'flow', label: '集成自动化修复' },
    { key: 'customButton', label: '自定义按钮补充' }
];

export default function DependenceFix() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('association');

    return (
        <>
            <button
                className="st-btn"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 16px', backgroundColor: '#005fb8', color: '#ffffff', border: 'none', borderRadius: '4px', fontSize: '14px', cursor: 'pointer', transition: 'background-color 0.15s' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#004c94'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#005fb8'}
                onClick={() => setIsOpen(true)}
            >
                <svg style={{ "width": "18px", "height": "18px", "color": "#ffffffff" }} t="1779175831518" className="icon" viewBox="0 0 1569 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3351" xmlnsXlink="http://www.w3.org/1999/xlink" width="306.4453125" height="200"><path d="M1083.135264 718.4c44.8 55.7 220 243 233.6 258.3 15.2 14.9 36.1 21.8 50.2 10.9 17.3-14.2 48-46.6 59.3-61.4 13.3-15.4 13-30.9-3.1-46.2-12.4-13.3-194.2-181-260.6-241L1083.135264 718.4zM953.435264 426.7c-33.4-39.4-38.4-41-49-55.1-11.8-16.5 6.5-52.3 15.4-76.9 12.8-28.2 19-117.9-38.5-181.8C812.435264 32.5 729.335264 10.2 683.735264 10.2c-19.9 2.8-19.6 9.3-7.9 32.5 14.1 28.5 69 134.5 75.9 150.7 11 28.3-61 97.9-95.7 85.5-17.6-6.3-116-55-135.2-64.1l-19.2-10c-22.9-13.2-25.3-7.9-29.9 3.6-3 9.8 0.5 102.9 77.1 193 64 69.5 146 68.7 190.2 52.7 30.1-10 47.9-17.6 68.5-3.9 15.9 10.1 39.7 35 69.9 61.7L953.435264 426.7z" p-id="3352"></path><path d="M1437.163264 23.04c-20.992-19.456-46.08-14.848-67.584 7.168-28.672 29.696-228.352 283.648-235.52 292.864-7.68 9.216-10.752 7.168-7.68 18.432 3.072 11.264 10.24 36.864 10.24 36.864s-34.816 14.336-62.976 27.648c-28.16 12.8-61.952 29.696-69.632 34.816s-14.336 9.728-13.824 22.528c0.512 16.896 9.728 54.272 9.728 54.272s-321.024 384-342.528 410.112-57.344 72.704-49.664 79.36c7.68 6.144 58.88-30.208 78.848-47.616 19.968-17.408 399.872-357.376 399.872-357.376s35.84 8.192 52.736 8.192c14.336 0 17.92-2.048 25.088-13.824 4.608-8.192 19.968-35.328 33.792-68.608 13.824-32.768 28.672-69.632 28.672-69.632s29.184 5.632 33.792 6.656c6.656 1.024 7.168 0.512 11.264-3.584 4.096-4.096 257.536-235.52 278.528-259.072 20.992-23.552 22.016-48.64 3.072-67.072C1532.907264 113.664 1479.147264 61.952 1437.163264 23.04z" p-id="3353"></path></svg>
                依赖修复
            </button>

            {isOpen && ReactDOM.createPortal(
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 99999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        background: '#fff', width: 'min(1200px, 92vw)', maxHeight: '80vh', borderRadius: '8px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column',
                        overflow: 'hidden'
                    }}>
                        <div style={{ padding: '16px 24px', borderBottom: '1px solid #ebebeb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
                            <h3 style={{ margin: 0, fontSize: '16px', color: '#1f2d3d', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <svg style={{ width: '18px', height: '18px', color: '#005fb8' }} t="1779175831518" className="icon" viewBox="0 0 1569 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3351" xmlnsXlink="http://www.w3.org/1999/xlink" width="306.4453125" height="200"><path d="M1083.135264 718.4c44.8 55.7 220 243 233.6 258.3 15.2 14.9 36.1 21.8 50.2 10.9 17.3-14.2 48-46.6 59.3-61.4 13.3-15.4 13-30.9-3.1-46.2-12.4-13.3-194.2-181-260.6-241L1083.135264 718.4zM953.435264 426.7c-33.4-39.4-38.4-41-49-55.1-11.8-16.5 6.5-52.3 15.4-76.9 12.8-28.2 19-117.9-38.5-181.8C812.435264 32.5 729.335264 10.2 683.735264 10.2c-19.9 2.8-19.6 9.3-7.9 32.5 14.1 28.5 69 134.5 75.9 150.7 11 28.3-61 97.9-95.7 85.5-17.6-6.3-116-55-135.2-64.1l-19.2-10c-22.9-13.2-25.3-7.9-29.9 3.6-3 9.8 0.5 102.9 77.1 193 64 69.5 146 68.7 190.2 52.7 30.1-10 47.9-17.6 68.5-3.9 15.9 10.1 39.7 35 69.9 61.7L953.435264 426.7z" p-id="3352"></path><path d="M1437.163264 23.04c-20.992-19.456-46.08-14.848-67.584 7.168-28.672 29.696-228.352 283.648-235.52 292.864-7.68 9.216-10.752 7.168-7.68 18.432 3.072 11.264 10.24 36.864 10.24 36.864s-34.816 14.336-62.976 27.648c-28.16 12.8-61.952 29.696-69.632 34.816s-14.336 9.728-13.824 22.528c0.512 16.896 9.728 54.272 9.728 54.272s-321.024 384-342.528 410.112-57.344 72.704-49.664 79.36c7.68 6.144 58.88-30.208 78.848-47.616 19.968-17.408 399.872-357.376 399.872-357.376s35.84 8.192 52.736 8.192c14.336 0 17.92-2.048 25.088-13.824 4.608-8.192 19.968-35.328 33.792-68.608 13.824-32.768 28.672-69.632 28.672-69.632s29.184 5.632 33.792 6.656c6.656 1.024 7.168 0.512 11.264-3.584 4.096-4.096 257.536-235.52 278.528-259.072 20.992-23.552 22.016-48.64 3.072-67.072C1532.907264 113.664 1479.147264 61.952 1437.163264 23.04z" p-id="3353"></path></svg>
                                依赖修复
                            </h3>
                            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#999', padding: 0, lineHeight: 1 }}>×</button>
                        </div>

                        <div style={{ display: 'flex', borderBottom: '1px solid #ebebeb', padding: '0 24px', background: '#fafafa' }}>
                            {TABS.map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    style={{
                                        padding: '10px 20px', background: 'none', border: 'none',
                                        borderBottom: activeTab === tab.key ? '2px solid #005fb8' : '2px solid transparent',
                                        color: activeTab === tab.key ? '#005fb8' : '#666',
                                        fontWeight: activeTab === tab.key ? 600 : 400,
                                        fontSize: '14px', cursor: 'pointer',
                                        transition: 'color 0.2s, border-color 0.2s'
                                    }}>
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div style={{ padding: '24px', fontSize: '14px', color: '#333', flex: 1, overflow: 'auto', minHeight: '300px' }}>
                            {activeTab === 'association' && <AssociationFormFix />}
                            {activeTab === 'flow' && <FlowFix />}
                            {activeTab === 'customButton' && <CustomButtonSupplement />}
                        </div>

                        <div style={{ padding: '16px 24px', borderTop: '1px solid #ebebeb', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#fafafa' }}>
                            <button
                                onClick={() => setIsOpen(false)}
                                style={{ padding: '8px 20px', background: '#fff', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', color: '#333' }}
                            >关闭</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
