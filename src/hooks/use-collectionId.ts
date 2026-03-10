import { useEffect, useState } from 'react';
import api from '@/lib/api';

export function useCollectionId(userid?: string, collectionName?: string) {
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userid || !collectionName) {
      setLoading(false);
      return;
    }

    const fetchCollectionId = async () => {
      try {
        setLoading(true);
        const encodedName = encodeURIComponent(collectionName);
        const response = await api.get(`/collections/${userid}/${encodedName}`);
        setCollectionId(response.data._id);
        setError(null);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to fetch collection');
        setCollectionId(null);
      } finally {
        setLoading(false);
      }
    };

    fetchCollectionId();
  }, [userid, collectionName]);

  return { collectionId, loading, error };
}