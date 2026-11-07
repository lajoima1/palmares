import { StrictMode, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { getLook } from './look'

function render(App: ComponentType) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

// Each visitor downloads the code of one look only. __LOOKS__ is false in the GitHub Pages build,
// so the bundler drops this branch and the new look from that build.
// The head script of index.html loads the fonts of the new look.
if (__LOOKS__ && getLook() === 'new') {
  import('./herb/HerbApp').then((m) => render(m.default))
} else {
  import('./App').then((m) => render(m.default))
}
