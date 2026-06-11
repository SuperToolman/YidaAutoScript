import React from 'react';
import { createPortal } from 'react-dom';
import LogicFlowImportPanel from './components/LogicFlowImportPanel';
import { useExternalDom } from '../../hooks/useExternalDom';

const LogicFlowPage = () => {
    const titleContainer = useExternalDom('.yida-block-card-title');

    if (!titleContainer) return null;

    titleContainer.style.display = 'flex';
    titleContainer.style.alignItems = 'center';

    return (
        <>
            {createPortal(<LogicFlowImportPanel />, titleContainer)}
        </>
    );
};

export default LogicFlowPage;