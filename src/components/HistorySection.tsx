'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Clock, AlertTriangle, CheckCircle2, Search, ArrowDownAZ, ArrowUpAZ, Calendar, Filter, Trash2, X, ZoomIn, ZoomOut, Layers } from 'lucide-react';

interface HistorySectionProps {
  session: any;
}

type SortField = 'date' | 'disease' | 'category' | 'confidence';
type SortOrder = 'asc' | 'desc';

export default function HistorySection({ session }: HistorySectionProps) {
  const [scans, setScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // States for sorting and filtering
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('all');
  const [subGroupFilter, setSubGroupFilter] = useState<string>('all');

  // States for Image Modal and Swiping
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [swipedItem, setSwipedItem] = useState<string | null>(null);
  
  // Modal transform state — kept in a ref to avoid re-renders on every frame
  const imgRef = useRef<HTMLImageElement>(null);
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });
  // Also keep React state for the controlled +/- buttons
  const [displayZoom, setDisplayZoom] = useState(1);
  
  // Drag state
  const pointerDown = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  
  // Pinch state
  const lastPinchDist = useRef<number | null>(null);
  const lastPinchCenter = useRef<{ x: number; y: number } | null>(null);
  
  const touchStartX = useRef<number | null>(null);
  const pinchRef = useRef<number | null>(null);

  useEffect(() => {
    if (session?.user?.id) {
      fetchHistory();
    }
  }, [session]);

  useEffect(() => {
    if (selectedImage) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedImage]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('scans')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

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

  const uniqueDates = useMemo(() => {
    const dates = scans.map(s => new Date(s.created_at).toLocaleDateString());
    return Array.from(new Set(dates));
  }, [scans]);

  const subFilterOptions = useMemo(() => {
    if (sortField === 'disease') {
      return Array.from(new Set(scans.map(s => s.disease_result))).filter(Boolean);
    } else if (sortField === 'category') {
      return ['Healthy', 'Warning', 'Disease'];
    } else if (sortField === 'confidence') {
      return ['High', 'Medium', 'Low'];
    } else if (sortField === 'date') {
      return Array.from(new Set(scans.map(s => new Date(s.created_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }))));
    }
    return [];
  }, [scans, sortField]);

  const { filteredAndSortedScans, groupedScans, healthyCount, unhealthyCount } = useMemo(() => {
    const healthyCount = scans.filter(s => s.category === 'healthy').length;
    const unhealthyCount = scans.filter(s => s.category !== 'healthy').length;

    let processed = [...scans];
    
    // 1. Date Range Filter
    const now = new Date();
    if (dateRangeFilter !== 'all') {
      if (dateRangeFilter === '1day') {
        const past = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
        processed = processed.filter(s => new Date(s.created_at) >= past);
      } else if (dateRangeFilter === '5day') {
        const past = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
        processed = processed.filter(s => new Date(s.created_at) >= past);
      } else if (dateRangeFilter === '1week') {
        const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        processed = processed.filter(s => new Date(s.created_at) >= past);
      } else if (dateRangeFilter === '2week') {
        const past = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        processed = processed.filter(s => new Date(s.created_at) >= past);
      } else if (dateRangeFilter === '1month') {
        const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        processed = processed.filter(s => new Date(s.created_at) >= past);
      } else if (dateRangeFilter === '6month') {
        const past = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        processed = processed.filter(s => new Date(s.created_at) >= past);
      } else if (dateRangeFilter === '1year') {
        const past = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        processed = processed.filter(s => new Date(s.created_at) >= past);
      } else {
        // Specific date selected
        processed = processed.filter(s => new Date(s.created_at).toLocaleDateString() === dateRangeFilter);
      }
    }

    // 2. Sub-Group Filter
    if (subGroupFilter !== 'all') {
      if (sortField === 'disease') {
         processed = processed.filter(s => s.disease_result === subGroupFilter);
      } else if (sortField === 'category') {
         const filterCat = subGroupFilter === 'Healthy' ? 'healthy' : (subGroupFilter === 'Warning' ? 'warning' : 'disease');
         processed = processed.filter(s => s.category === filterCat);
      } else if (sortField === 'confidence') {
         if (subGroupFilter === 'High') processed = processed.filter(s => s.confidence >= 90);
         else if (subGroupFilter === 'Medium') processed = processed.filter(s => s.confidence >= 70 && s.confidence < 90);
         else if (subGroupFilter === 'Low') processed = processed.filter(s => s.confidence < 70);
      } else if (sortField === 'date') {
         const toYMD = (d: Date) => {
           const offset = d.getTimezoneOffset() * 60000;
           return new Date(d.getTime() - offset).toISOString().split('T')[0];
         };
         processed = processed.filter(s => toYMD(new Date(s.created_at)) === subGroupFilter);
      }
    }

    // 3. Sort
    processed.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'date':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'disease':
          comparison = (a.disease_result || '').localeCompare(b.disease_result || '');
          break;
        case 'category':
          comparison = (a.category || '').localeCompare(b.category || '');
          break;
        case 'confidence':
          comparison = (a.confidence || 0) - (b.confidence || 0);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // 4. Group
    const grouped = processed.reduce((acc, scan) => {
      let groupKey = '';
      if (sortField === 'date') {
        groupKey = new Date(scan.created_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      } else if (sortField === 'disease') {
        groupKey = scan.disease_result || 'Unknown';
      } else if (sortField === 'category') {
        groupKey = scan.category === 'healthy' ? 'Healthy' : (scan.category === 'warning' ? 'Warning' : 'Disease');
      } else if (sortField === 'confidence') {
        groupKey = scan.confidence >= 90 ? 'High Confidence (90%+)' : (scan.confidence >= 70 ? 'Medium Confidence (70-89%)' : 'Low Confidence (<70%)');
      }
      
      if (!acc[groupKey]) acc[groupKey] = [];
      acc[groupKey].push(scan);
      return acc;
    }, {} as Record<string, any[]>);

    return { filteredAndSortedScans: processed, groupedScans: grouped, healthyCount, unhealthyCount };
  }, [scans, sortField, sortOrder, dateRangeFilter, subGroupFilter]);

  const handleTouchStart = (e: React.TouchEvent, id: string) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent, id: string) => {
    if (!touchStartX.current) return;
    const currentX = e.touches[0].clientX;
    const diff = touchStartX.current - currentX;
    if (diff > 50) { // Swiped left
      setSwipedItem(id);
    } else if (diff < -50) { // Swiped right
      setSwipedItem(null);
    }
  };

  const handleTouchEnd = () => {
    touchStartX.current = null;
  };

  const closeModal = () => {
    setSelectedImage(null);
    setDisplayZoom(1);
    transformRef.current = { scale: 1, x: 0, y: 0 };
  };

  const applyTransform = (scale: number, x: number, y: number) => {
    transformRef.current = { scale, x, y };
    setDisplayZoom(scale);
    if (imgRef.current) {
      imgRef.current.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    }
  };

  // Zoom around a focal point (clientX/Y) using image rect
  const zoomAround = (clientX: number, clientY: number, newScale: number) => {
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    // focal point relative to image center
    const focalX = clientX - (rect.left + rect.width / 2);
    const focalY = clientY - (rect.top + rect.height / 2);
    const { scale: oldScale, x: oldX, y: oldY } = transformRef.current;
    const ratio = newScale / oldScale;
    const newX = oldX + focalX * (1 - ratio);
    const newY = oldY + focalY * (1 - ratio);
    applyTransform(newScale, newX, newY);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const { scale } = transformRef.current;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const newScale = Math.min(Math.max(0.5, scale * factor), 10);
    zoomAround(e.clientX, e.clientY, newScale);
  };

  // Pointer drag (single finger or mouse)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.isPrimary) {
      pointerDown.current = true;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!e.isPrimary || !pointerDown.current) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    const { scale, x, y } = transformRef.current;
    applyTransform(scale, x + dx, y + dy);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.isPrimary) pointerDown.current = false;
  };

  // Pinch to zoom (multi-touch)
  const handleTouchStartModal = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastPinchDist.current = dist;
      lastPinchCenter.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
      pointerDown.current = false; // disable single-finger drag during pinch
    }
  };

  const handleTouchMoveModal = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastPinchDist.current !== null && lastPinchCenter.current !== null) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

      const { scale, x, y } = transformRef.current;
      const factor = dist / lastPinchDist.current;
      const newScale = Math.min(Math.max(0.5, scale * factor), 10);

      // Zoom around pinch center
      const img = imgRef.current;
      if (img) {
        const rect = img.getBoundingClientRect();
        const focalX = centerX - (rect.left + rect.width / 2);
        const focalY = centerY - (rect.top + rect.height / 2);
        const ratio = newScale / scale;
        // Also pan with the pinch center movement
        const panDx = centerX - lastPinchCenter.current.x;
        const panDy = centerY - lastPinchCenter.current.y;
        const newX = x + focalX * (1 - ratio) + panDx;
        const newY = y + focalY * (1 - ratio) + panDy;
        applyTransform(newScale, newX, newY);
      }

      lastPinchDist.current = dist;
      lastPinchCenter.current = { x: centerX, y: centerY };
    }
  };

  const handleTouchEndModal = () => {
    lastPinchDist.current = null;
    lastPinchCenter.current = null;
  };

  const deleteRecords = async (ids: string[]) => {
    if (!confirm(`Are you sure you want to delete ${ids.length} record(s)?`)) return false;
    try {
      const recordsToDelete = scans.filter(s => ids.includes(s.id));
      const filePaths = recordsToDelete.map(s => s.image_path).filter(Boolean);

      // 1. Delete from DB
      const { error: dbError } = await supabase.from('scans').delete().in('id', ids);
      if (dbError) throw dbError;

      // 2. Delete from Storage
      if (filePaths.length > 0) {
        const { error: storageError } = await supabase.storage.from('leaf_images').remove(filePaths);
        if (storageError) console.error("Storage deletion error:", storageError);
      }

      setScans(prev => prev.filter(s => !ids.includes(s.id)));
      setSwipedItem(null);
      return true;
    } catch (err) {
      console.error('Error deleting:', err);
      alert('Failed to delete records.');
      return false;
    }
  };

  const handleGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortField(e.target.value as SortField);
    setSubGroupFilter('all'); // Reset sub-filter when group changes
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--clr-text-muted)' }}>
        <Clock size={32} className="animate-spin" style={{ marginBottom: '1rem', opacity: 0.5, display: 'inline-block' }} />
        <p>Loading your past diagnoses...</p>
      </div>
    );
  }

  if (scans.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--clr-text-muted)' }}>
        <Clock size={32} style={{ marginBottom: '1rem', opacity: 0.5, display: 'inline-block' }} />
        <p>You haven't scanned any durian leaves yet.</p>
        <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Head to the Scanner tab to get started!</p>
      </div>
    );
  }

  return (
    <section className="history-section" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', color: 'var(--clr-primary)', fontWeight: '600' }}>Diagnosis History</h2>
        <p style={{ color: 'var(--clr-text-muted)', fontSize: '0.9rem' }}>Review your past durian leaf scans.</p>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ flex: 1, background: 'var(--clr-surface)', padding: '1rem', borderRadius: '12px', border: '1px solid #10b98120', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: '#ecfdf5', color: '#10b981', padding: '0.75rem', borderRadius: '50%' }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--clr-text)' }}>{healthyCount}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--clr-text-muted)' }}>Healthy</div>
          </div>
        </div>
        <div style={{ flex: 1, background: 'var(--clr-surface)', padding: '1rem', borderRadius: '12px', border: '1px solid #ef444420', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: '#fef2f2', color: '#ef4444', padding: '0.75rem', borderRadius: '50%' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--clr-text)' }}>{unhealthyCount}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--clr-text-muted)' }}>Unhealthy</div>
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--clr-surface)', padding: '1rem', borderRadius: '12px', marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
        
        {/* Date Time Range Filter */}
        <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={18} color="var(--clr-text-muted)" />
          <select 
            value={dateRangeFilter} 
            onChange={(e) => setDateRangeFilter(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'var(--clr-bg)', color: 'var(--clr-text)', flex: 1 }}
          >
            <option value="all">All Time</option>
            <option value="1day">Past 1 Day</option>
            <option value="5day">Past 5 Days</option>
            <option value="1week">Past 1 Week</option>
            <option value="1month">Past 1 month</option>
            <option value="6month">Past 6 months</option>
            <option value="1year">Past 1 Year</option>
          </select>
        </div>

        {/* Group / Sort Field */}
        <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Layers size={18} color="var(--clr-text-muted)" />
          <select 
            value={sortField} 
            onChange={handleGroupChange}
            style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'var(--clr-bg)', color: 'var(--clr-text)', flex: 1 }}
          >
            <option value="date">Group by Date</option>
            <option value="disease">Group by Disease</option>
            <option value="category">Group by Category</option>
            <option value="confidence">Group by Confidence</option>
          </select>
        </div>

        {/* Dynamic Sub-filter (Inside the chosen group) */}
        <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={18} color="var(--clr-text-muted)" />
          {sortField === 'date' ? (
            <input 
              type="date"
              value={subGroupFilter === 'all' ? '' : subGroupFilter}
              onChange={(e) => setSubGroupFilter(e.target.value || 'all')}
              style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'var(--clr-bg)', color: 'var(--clr-text)', flex: 1 }}
            />
          ) : (
            <select 
              value={subGroupFilter} 
              onChange={(e) => setSubGroupFilter(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'var(--clr-bg)', color: 'var(--clr-text)', flex: 1 }}
            >
              <option value="all">Show All in Group</option>
              {subFilterOptions.map(opt => (
                <option key={opt as string} value={opt as string}>{opt}</option>
              ))}
            </select>
          )}
        </div>

        {/* Sort Order */}
        <button 
          onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'var(--clr-bg)', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', color: 'var(--clr-text)', width: '100%', justifyContent: 'center' }}
        >
          {sortOrder === 'asc' ? <ArrowUpAZ size={18} /> : <ArrowDownAZ size={18} />}
          {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
        </button>
      </div>

      {filteredAndSortedScans.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--clr-text-muted)' }}>
          No scans found for the selected filters.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {Object.keys(groupedScans).map((groupKey) => (
            <div key={groupKey}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '2px solid var(--clr-primary-light)', paddingBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--clr-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>{groupKey}</span>
                  <span style={{ fontSize: '0.875rem', background: 'var(--clr-bg-alt)', padding: '0.2rem 0.6rem', borderRadius: '12px', color: 'var(--clr-text-muted)' }}>
                    {groupedScans[groupKey].length}
                  </span>
                </h3>
                <button 
                  onClick={async () => {
                    const success = await deleteRecords(groupedScans[groupKey].map((s: any) => s.id));
                    if (success) {
                      setSubGroupFilter('all');
                    }
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--clr-danger)', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}
                >
                  <Trash2 size={14} /> Delete Group
                </button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowX: 'hidden' }}>
                {groupedScans[groupKey].map((scan: any) => (
                  <div 
                    key={scan.id} 
                    style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'stretch' }}
                    onTouchStart={(e) => handleTouchStart(e, scan.id)}
                    onTouchMove={(e) => handleTouchMove(e, scan.id)}
                    onTouchEnd={handleTouchEnd}
                  >
                    {/* Background Delete Button (Revealed on Swipe) */}
                    <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '80px', background: 'var(--clr-danger)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', zIndex: 0 }}>
                      <button onClick={() => deleteRecords([scan.id])} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 size={24} />
                      </button>
                    </div>

                    {/* Main Card */}
                    <div 
                      onClick={() => setSelectedImage(scan.publicUrl)}
                      style={{ 
                        flex: 1,
                        display: 'flex', gap: '1rem', background: 'var(--clr-surface)', padding: '1rem', 
                        borderRadius: '12px', boxShadow: 'var(--shadow-sm)', alignItems: 'center', zIndex: 1,
                        transform: swipedItem === scan.id ? 'translateX(-80px)' : 'translateX(0)',
                        transition: 'transform 0.3s ease',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                        <img src={scan.publicUrl} alt="Leaf" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.7rem', padding: '2px 0', textAlign: 'center' }}>
                          {new Date(scan.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span className={`category-title ${scan.category}`} style={{ fontSize: '1rem', margin: 0, padding: 0, background: 'none' }}>
                            {getCategoryIcon(scan.category)}
                          </span>
                          <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--clr-text)' }}>{scan.disease_result}</h4>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--clr-text-muted)' }}>Confidence: {scan.confidence}%</p>
                          <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: scan.category === 'healthy' ? '#ecfdf5' : '#fef2f2', color: scan.category === 'healthy' ? '#10b981' : '#ef4444' }}>
                            {scan.category === 'healthy' ? 'Healthy' : 'Disease'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <div 
          onClick={closeModal}
          onWheel={handleWheel}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            touchAction: 'none',
          }}
        >
          {/* Top Controls */}
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10000 }}>
            <div style={{ display: 'flex', gap: '1rem', background: 'rgba(255,255,255,0.1)', padding: '0.5rem', borderRadius: '8px' }}>
              <button onClick={() => zoomAround(window.innerWidth/2, window.innerHeight/2, Math.max(0.5, transformRef.current.scale - 0.5))} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                <ZoomOut size={24} />
              </button>
              <span style={{ color: 'white', width: '40px', textAlign: 'center', display: 'inline-block' }}>{Math.round(displayZoom * 100)}%</span>
              <button onClick={() => zoomAround(window.innerWidth/2, window.innerHeight/2, Math.min(10, transformRef.current.scale + 0.5))} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                <ZoomIn size={24} />
              </button>
            </div>
            <button onClick={closeModal} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer' }}>
              <X size={24} />
            </button>
          </div>
          
          {/* Zoomable Image Container */}
          <div 
            style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <img 
              ref={imgRef}
              src={selectedImage} 
              alt="Enlarged leaf" 
              draggable={false}
              onClick={e => e.stopPropagation()}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onTouchStart={handleTouchStartModal}
              onTouchMove={handleTouchMoveModal}
              onTouchEnd={handleTouchEndModal}
              style={{ 
                maxWidth: '90%', maxHeight: '80%', 
                transform: 'translate(0px, 0px) scale(1)',
                transformOrigin: 'center center',
                willChange: 'transform',
                objectFit: 'contain',
                cursor: 'grab',
                userSelect: 'none',
                touchAction: 'none',
              }} 
            />
          </div>
        </div>
      )}
    </section>
  );
}
