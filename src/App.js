import React from 'react';
import * as Component from './components';
const config = new (window.require('electron-config'))();

class App extends React.Component {

    render() {
        var componentName = config.get("currentApp.componentName");
        var AppComponent = router(componentName);
        return (<AppComponent/>);
    }
}

var router = (componentName) => {
    return Component[componentName] ? Component[componentName] : Component.NotFound;
}

export default App;
