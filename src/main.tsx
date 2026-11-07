import { StrictMode, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
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
if (__LOOKS__ && getLook() === 'new') {
  const fonts = document.createElement('link')
  fonts.rel = 'stylesheet'
  fonts.href =
    'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Inter:wght@400;500;600;700&display=swap'
  document.head.appendChild(fonts)
  import('./herb/HerbApp').then((m) => render(m.default))
} else {
  import('./App').then((m) => render(m.default))
}
