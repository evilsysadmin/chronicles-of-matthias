import { useEffect, useState } from 'react';
import { fetchMeStatus } from '../auth.js';

// The visible username and local storage are never authorization evidence.
// The backend remains the sole source of truth for administrative access.
export function chroniclesAdminAccessFromMe(result) {
  if (result?.status === 'ok') {
    return { isAdmin: result.user?.isAdmin === true, status: 'verified' };
  }
  return { isAdmin: false, status: result?.status === 'unauthorized' ? 'denied' : 'unavailable' };
}

export function useChroniclesAdminAccess(recheckOnOpen = false) {
  const [revision, setRevision] = useState(0);
  const [access, setAccess] = useState({ isAdmin: false, status: 'checking' });

  // A cold-start, transient network failure or proxy timeout must not make
  // admin controls disappear for the rest of a playable session.
  useEffect(() => {
    if (recheckOnOpen) setRevision((current) => current + 1);
  }, [recheckOnOpen]);

  useEffect(() => {
    let active = true;
    setAccess({ isAdmin: false, status: 'checking' });
    void fetchMeStatus().then((result) => {
      if (active) setAccess(chroniclesAdminAccessFromMe(result));
    }).catch(() => {
      if (active) setAccess({ isAdmin: false, status: 'unavailable' });
    });
    return () => { active = false; };
  }, [revision]);

  return { ...access, retry: () => setRevision((current) => current + 1) };
}
