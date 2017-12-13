import React from 'react'
import { render } from 'react-dom'
import App from './App';
import registerServiceWorker from './registerServiceWorker';
import './stylesheets/index.css';
import 'semantic-ui-css/semantic.min.css';

render((<App />), document.getElementById('root'));
registerServiceWorker();
