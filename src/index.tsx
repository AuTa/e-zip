/* @refresh reload */
import '@unocss/reset/tailwind.css'
import 'virtual:uno.css'

import { render } from 'solid-js/web'
import { Route, Router } from '@solidjs/router'

import App from './App'
import { UnzipSetting } from './components/UnzipSetting'

render(
    () => (
        <Router root={App}>
            <Route path="/" component={UnzipSetting} />
        </Router>
    ),
    document.getElementById('root') as HTMLElement,
)
