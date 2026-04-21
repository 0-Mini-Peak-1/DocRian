'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Clock, AlertTriangle, CheckCircle2, Search } from 'lucide-react';

interface HistorySectionProps {
  session: any;
}

export default function HistorySection({ session }: HistorySectionProps) {
  const [scans, setScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.id) {
      fetchHistory();
    }
  }, [session]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('scans')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get public URLs for images
      const scansWithUrls = await Promise.all((data || []).map(async (scan: any) => {
        const { data: publicUrlData } = supabase.storage.from('leaf_images').getPublicUrl(scan.image_path);
        return { ...scan, publicUrl: publicUrlData.publicUrl };
      }));

      setScans(scansWithUrls);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'healthy': return <CheckCircle2 size={16} />;
      case 'disease': return <AlertTriangle size={16} />;
      case 'warning': return <Search size={16} />;
      default: return <Search size={16} />;
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--clr-text-muted)' }}>
        <Clock size={32} style={{ marginBottom: '1rem', opacity: 0.5 }} />
        <p>Loading your past diagnoses...</p>
      </div>
    );
  }

  if (scans.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--clr-text-muted)' }}>
        <Clock size={32} style={{ marginBottom: '1rem', opacity: 0.5 }} />
        <p>You haven't scanned any durian leaves yet.</p>
        <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Head to the Scanner tab to get started!</p>
      </div>
    );
  }

  // Group by date
  const groupedScans = scans.reduce((acc, scan) => {
    const date = new Date(scan.created_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    if (!acc[date]) acc[date] = [];
    acc[date].push(scan);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <section className="history-section" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', color: 'var(--clr-primary)', fontWeight: '600' }}>Diagnosis History</h2>
        <p style={{ color: 'var(--clr-text-muted)', fontSize: '0.9rem' }}>Review your past durian leaf scans.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {Object.keys(groupedScans).map((date) => (
          <div key={date}>
            <h3 style={{ fontSize: '1rem', color: 'var(--clr-text-muted)', marginBottom: '1rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
              {date}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {groupedScans[date].map((scan: any) => (
                <div key={scan.id} style={{ display: 'flex', gap: '1rem', background: 'var(--clr-surface)', padding: '1rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', alignItems: 'center' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                    <img src={scan.publicUrl} alt="Leaf" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span className={`category-title ${scan.category}`} style={{ fontSize: '1rem', margin: 0 }}>
                        {getCategoryIcon(scan.category)}
                      </span>
                      <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--clr-text)' }}>{scan.disease_result}</h4>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--clr-text-muted)' }}>Confidence: {scan.confidence}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
