import React from 'react';
import * as Component from './components';

class App extends React.Component {

    render() {
        var componentName,
            component = Component[componentName] ? Component[componentName] : Component.notFound;
        return component;
    }
}

export default App;
