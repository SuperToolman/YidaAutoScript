import React, { useState, useEffect } from 'react';
import global from './global';
import PageDesignerPage from './pages/designer/index';
import NewDesignerPage from './pages/newDesigner/index';
import LogicFlowPage from './pages/logicFlow/index';
import DataSetPage from './pages/dataset/index';
import ViewPage from './pages/view/index';
import MyAppPage from './pages/myApp/index';


const App = () => {
    const [currentPage, setCurrentPage] = useState(global.nowPage);

    useEffect(() => {
        const matchRoute = () => {
            const href = window.location.href;
            const hostname = window.location.hostname;
            const pathname = window.location.pathname;

            const routes = [
                { match: () => /\/design\/pageDesigner/.test(href), page: 'pageDesigner' },
                { match: () => /\/design\/newDesigner/.test(href), page: 'newDesigner' },
                { match: () => /\.aliwork\.com/.test(hostname) && /\/admin\/logicFlow/.test(pathname), page: 'logicFlow' },
                { match: () => /\.aliwork\.com/.test(hostname) && /\/admin\/FORM-/.test(pathname), page: 'view' },
                { match: () => /\.aliwork\.com/.test(hostname) && /\/admin\/.*dataSet/i.test(pathname), page: 'dataset' },
                { match: () => /\.aliwork\.com/.test(hostname) && /\/myApp(?:\?|$|\.html)/.test(href), page: 'myApp' }
            ];

            const matchedRoute = routes.find(r => r.match());
            return matchedRoute ? matchedRoute.page : '';
        };

        const handleUrlChange = () => {
            const newPage = matchRoute();
            if (newPage !== currentPage) {
                global.nowPage = newPage;
                setCurrentPage(newPage);
            }
        };

        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function () {
            originalPushState.apply(this, arguments);
            handleUrlChange();
        };

        history.replaceState = function () {
            originalReplaceState.apply(this, arguments);
            handleUrlChange();
        };

        window.addEventListener('popstate', handleUrlChange);
        window.addEventListener('hashchange', handleUrlChange);

        const intervalId = setInterval(handleUrlChange, 1000);

        return () => {
            history.pushState = originalPushState;
            history.replaceState = originalReplaceState;
            window.removeEventListener('popstate', handleUrlChange);
            window.removeEventListener('hashchange', handleUrlChange);
            clearInterval(intervalId);
        };
    }, [currentPage]);

    switch (currentPage) {
        case 'logicFlow':
            return <LogicFlowPage />;
        case 'newDesigner':
            return <NewDesignerPage />;
        case 'dataset':
            return <DataSetPage />;
        case 'view':
            return <ViewPage />;
        case 'pageDesigner':
            return <PageDesignerPage />;
        case 'myApp':
            return <MyAppPage />;
        default:
            return null;
    }
};

export default App;
