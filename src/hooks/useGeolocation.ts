import { useState, useEffect, useCallback } from 'react';

export interface Coordinates {
  lat: number;
  lng: number;
}

const STORAGE_KEY = 'navbatbor_user_coords';

export function formatDistance(distanceKm: number | null | undefined): string {
  if (distanceKm === null || distanceKm === undefined) return '';
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

export function useGeolocation() {
  const [coords, setCoords] = useState<Coordinates | null>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          return parsed;
        }
      }
    } catch (e) {
      // Ignore storage errors
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);

  const requestLocation = useCallback((onSuccess?: (coords: Coordinates) => void): Promise<Coordinates | null> => {
    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) {
        const msg = 'Brauzeringiz geolokatsiyani (GPS) qo‘llab-quvvatlamaydi.';
        setError(msg);
        resolve(null);
        return;
      }

      setIsLoading(true);
      setError(null);
      setPermissionDenied(false);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newCoords: Coordinates = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCoords(newCoords);
          setIsLoading(false);
          setError(null);
          try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newCoords));
          } catch (e) {}

          if (onSuccess) {
            onSuccess(newCoords);
          }
          resolve(newCoords);
        },
        (err) => {
          setIsLoading(false);
          let message = 'Joylashuvni aniqlashda xatolik yuz berdi.';
          if (err.code === err.PERMISSION_DENIED) {
            message = 'Geolokatsiyaga ruxsat berilmadi. Joylashuvingizni aniqlash uchun brauzer sozlamalaridan ruxsat bering.';
            setPermissionDenied(true);
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            message = 'GPS signali topilmadi yoki tarmoq joylashuvni aniqlay olmadi.';
          } else if (err.code === err.TIMEOUT) {
            message = 'Joylashuvni kutish vaqti tugadi. Qayta urinib ko‘ring.';
          }
          setError(message);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    });
  }, []);

  const clearLocation = useCallback(() => {
    setCoords(null);
    setError(null);
    setPermissionDenied(false);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }, []);

  return {
    coords,
    isLoading,
    error,
    permissionDenied,
    requestLocation,
    clearLocation,
    formatDistance,
  };
}
