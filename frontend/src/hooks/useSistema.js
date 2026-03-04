import { useState, useEffect } from 'react';
import api from '../services/api';

// Cache en memoria para no hacer múltiples requests
let cache = null;
let listeners = [];

function notify() {
  listeners.forEach(fn => fn(cache));
}

export function useSistema() {
  const [config, setConfig] = useState(cache || {
    nombre_sistema: 'CondoAdmin',
    subtitulo: 'PRO',
    logo_url: null,
  });

  useEffect(() => {
    listeners.push(setConfig);

    if (!cache) {
      api.get('/sistema/config').then(r => {
        cache = r.data;
        notify();
      }).catch(() => {});
    }

    return () => {
      listeners = listeners.filter(fn => fn !== setConfig);
    };
  }, []);

  // Permite invalidar el cache desde Profile.jsx después de guardar
  const refresh = () => {
    cache = null;
    api.get('/sistema/config').then(r => {
      cache = r.data;
      notify();
    }).catch(() => {});
  };

  return { config, refresh };
}
