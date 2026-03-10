import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import ReactGA from 'react-ga4';

function usePageTracking() {
  const location = useLocation();
  useEffect(() => {
    ReactGA.send({ hitType: 'pageview', page: location.pathname + location.search });
  }, [location]);
}

function App() {
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (!document.querySelector('[data-radix-popper-content-wrapper]')) {
        document.body.style.removeProperty('pointer-events');
      }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });
    return () => observer.disconnect();
  }, []);

  usePageTracking();
  return null; // layout and routes are handled by RouterProvider
}

export default App;