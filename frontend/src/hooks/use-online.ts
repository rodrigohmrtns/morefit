import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/**
 * Reactive online state hook — updates whenever connectivity changes.
 *
 * Returns `true` when the device has an internet connection, `false` otherwise.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    NetInfo.fetch().then((s: NetInfoState) => {
      if (mounted) setOnline(!!s.isConnected);
    });
    const unsub = NetInfo.addEventListener((s: NetInfoState) => {
      if (mounted) setOnline(!!s.isConnected);
    });
    return () => { mounted = false; unsub(); };
  }, []);

  return online;
}
