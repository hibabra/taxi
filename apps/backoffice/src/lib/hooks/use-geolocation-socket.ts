'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { DriverPosition } from '@/lib/api/geolocation.api';

interface UseGeolocationSocketOptions {
  groupementId: string | null;
  onPositionUpdate: (position: DriverPosition) => void;
}

export function useGeolocationSocket({
  groupementId,
  onPositionUpdate,
}: UseGeolocationSocketOptions) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!groupementId) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

    const socket = io(`${apiUrl}/geolocation`, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connecté ✅', socket.id);
      socket.emit('join:groupement', groupementId);
    });

    socket.on('position:updated', (data: DriverPosition) => {
      onPositionUpdate(data);
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Erreur connexion :', err.message);
    });

    socket.on('disconnect', () => {
      console.warn('[Socket] Déconnecté');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [groupementId, onPositionUpdate]);
}