import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { LanguageProvider } from './i18n/LanguageContext.tsx';
import { DialogProvider } from './components/ui/Dialog.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <DialogProvider>
        <App />
      </DialogProvider>
    </LanguageProvider>
  </StrictMode>,
);
