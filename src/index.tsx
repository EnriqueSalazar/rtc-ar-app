import React from 'react';
import ReactDOM from 'react-dom';
import './index/index.css';
import App from './index/App';
import { store } from './shared/store';
import { Provider } from 'react-redux';
import * as serviceWorker from './index/serviceWorker';

ReactDOM.render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById('root')
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
