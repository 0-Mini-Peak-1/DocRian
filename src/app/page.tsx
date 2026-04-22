'use client';

import { useState, useRef, useEffect } from 'react';
import { Settings, Camera, Leaf, RefreshCw, AlertTriangle, CheckCircle2, Search, LogOut, User, History, Image as ImageIcon, ZoomIn, ZoomOut, X } from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import Auth from '@/components/Auth';
import SettingsModal from '@/components/SettingsModal';
import HistorySection from '@/components/HistorySection';

// Types
type DiseaseCategory = 'healthy' | 'disease' | 'warning';

interface ScanResult {
  id: string;
  url: string;
  disease: string;
  confidence: number;
  category: DiseaseCategory;
}

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'scanner' | 'history'>('scanner');
  const [images, setImages] = useState<{ id: string; url: string; file: File }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ScanResult[]>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showNextActionModal, setShowNextActionModal] = useState(false);

  // Result image expand modal
  const [selectedResult, setSelectedResult] = useState<ScanResult | null>(null);
  const resultImgRef = useRef<HTMLImageElement>(null);
  const resultTransformRef = useRef({ scale: 1, x: 0, y: 0 });
  const [resultDisplayZoom, setResultDisplayZoom] = useState(1);
  const resultPointerDown = useRef(false);
  const resultLastPointer = useRef({ x: 0, y: 0 });
  const resultPinchDist = useRef<number | null>(null);
  const resultPinchCenter = useRef<{ x: number; y: number } | null>(null);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('avatar_url').eq('id', userId).single();
    if (data && data.avatar_url) {
      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(data.avatar_url);
      setAvatarUrl(`${publicUrlData.publicUrl}?t=${Date.now()}`);
    }
  };

  useEffect(() => {
    // Load currentView from cookie
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return null;
    };

    const savedView = getCookie('currentView');
    if (savedView === 'scanner' || savedView === 'history') {
      setCurrentView(savedView as 'scanner' | 'history');
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) fetchProfile(session.user.id);
      setIsLoadingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) fetchProfile(session.user.id);
      setIsLoadingSession(false);
    });

    const handleProfileUpdate = () => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.id) fetchProfile(session.user.id);
      });
    };
    window.addEventListener('profile-updated', handleProfileUpdate);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('profile-updated', handleProfileUpdate);
    };
  }, []);


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newImages = Array.from(e.target.files).map((file) => ({
        id: Math.random().toString(36).substring(7),
        url: URL.createObjectURL(file),
        file,
      }));
      setImages((prev) => [...prev, ...newImages]);
      setShowSourceModal(false);
      setShowNextActionModal(true);
      e.target.value = ''; // Reset input to allow selecting same file again if needed
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newImages = Array.from(e.dataTransfer.files)
        .filter((file) => file.type.startsWith('image/'))
        .map((file) => ({
          id: Math.random().toString(36).substring(7),
          url: URL.createObjectURL(file),
          file,
        }));
      if (newImages.length > 0) {
        setImages((prev) => [...prev, ...newImages]);
        setShowNextActionModal(true);
      }
    }
  };

  const startAnalysis = async () => {
    if (images.length === 0 || !session?.user?.id) return;
    setIsProcessing(true);

    // ── Concurrency-limited batch runner ──────────────────────────────────────
    // Promise.all fires ALL requests at once. With 300+ images and a serialized
    // GPU server (~45ms/image), images queued late wait 10+ seconds → Vercel
    // function timeout → falls back to "Unknown Error". Cap at 8 concurrent so
    // every request finishes well within Vercel's 10s timeout.
    const CONCURRENCY = 8;

    const processImage = async (img: { id: string; url: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', img.file);

      let apiResult;
      try {
        const response = await fetch('/api/predict', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        apiResult = await response.json();
      } catch (err) {
        console.error(`Prediction API error for ${img.file.name}:`, err);
        apiResult = {
          disease: 'Unknown',
          category: 'warning' as DiseaseCategory,
          confidence: 0,
        };
      }

      // Upload image & save scan record in parallel (doesn't block inference)
      const fileName = `${session.user.id}-${Date.now()}-${img.file.name}`;
      await Promise.all([
        supabase.storage.from('leaf_images').upload(fileName, img.file),
        supabase.from('scans').insert({
          user_id: session.user.id,
          image_path: fileName,
          disease_result: apiResult.disease,
          category: apiResult.category,
          confidence: Math.round(apiResult.confidence || 0),
        }),
      ]);

      return {
        id: img.id,
        url: img.url,
        disease: apiResult.disease,
        category: apiResult.category,
        confidence: Math.round(apiResult.confidence || 0),
      };
    };

    try {
      // Process images in sliding-window batches of CONCURRENCY
      const results: ScanResult[] = [];
      for (let i = 0; i < images.length; i += CONCURRENCY) {
        const batch = images.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.all(batch.map(processImage));
        results.push(...batchResults);
      }
      setResults(results);
    } catch (error) {
      console.error('Error during analysis:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const closeResultModal = () => {
    setSelectedResult(null);
    setResultDisplayZoom(1);
    resultTransformRef.current = { scale: 1, x: 0, y: 0 };
  };

  const applyResultTransform = (scale: number, x: number, y: number) => {
    resultTransformRef.current = { scale, x, y };
    setResultDisplayZoom(scale);
    if (resultImgRef.current) {
      resultImgRef.current.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    }
  };

  const resultZoomAround = (clientX: number, clientY: number, newScale: number) => {
    const img = resultImgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const focalX = clientX - (rect.left + rect.width / 2);
    const focalY = clientY - (rect.top + rect.height / 2);
    const { scale: oldScale, x: oldX, y: oldY } = resultTransformRef.current;
    const ratio = newScale / oldScale;
    applyResultTransform(newScale, oldX + focalX * (1 - ratio), oldY + focalY * (1 - ratio));
  };

  const handleResultWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const newScale = Math.min(Math.max(0.5, resultTransformRef.current.scale * factor), 10);
    resultZoomAround(e.clientX, e.clientY, newScale);
  };

  const handleResultPointerDown = (e: React.PointerEvent) => {
    if (e.isPrimary) {
      resultPointerDown.current = true;
      resultLastPointer.current = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handleResultPointerMove = (e: React.PointerEvent) => {
    if (!e.isPrimary || !resultPointerDown.current) return;
    const dx = e.clientX - resultLastPointer.current.x;
    const dy = e.clientY - resultLastPointer.current.y;
    resultLastPointer.current = { x: e.clientX, y: e.clientY };
    const { scale, x, y } = resultTransformRef.current;
    applyResultTransform(scale, x + dx, y + dy);
  };

  const handleResultPointerUp = (e: React.PointerEvent) => {
    if (e.isPrimary) resultPointerDown.current = false;
  };

  const handleResultTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      resultPinchDist.current = dist;
      resultPinchCenter.current = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 };
      resultPointerDown.current = false;
    }
  };

  const handleResultTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && resultPinchDist.current !== null && resultPinchCenter.current !== null) {
      e.preventDefault();
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const { scale, x, y } = resultTransformRef.current;
      const factor = dist / resultPinchDist.current;
      const newScale = Math.min(Math.max(0.5, scale * factor), 10);
      const img = resultImgRef.current;
      if (img) {
        const rect = img.getBoundingClientRect();
        const focalX = centerX - (rect.left + rect.width / 2);
        const focalY = centerY - (rect.top + rect.height / 2);
        const ratio = newScale / scale;
        const panDx = centerX - resultPinchCenter.current.x;
        const panDy = centerY - resultPinchCenter.current.y;
        applyResultTransform(newScale, x + focalX * (1 - ratio) + panDx, y + focalY * (1 - ratio) + panDy);
      }
      resultPinchDist.current = dist;
      resultPinchCenter.current = { x: centerX, y: centerY };
    }
  };

  const handleResultTouchEnd = () => {
    resultPinchDist.current = null;
    resultPinchCenter.current = null;
  };

  const resetState = () => {
    images.forEach(img => URL.revokeObjectURL(img.url));
    setImages([]);
    setResults([]);
    setIsProcessing(false);
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
    if (galleryInputRef.current) {
      galleryInputRef.current.value = '';
    }
  };

  // Group results by category
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.category]) {
      acc[result.category] = [];
    }
    acc[result.category].push(result);
    return acc;
  }, {} as Record<DiseaseCategory, ScanResult[]>);

  const getCategoryIcon = (cat: DiseaseCategory) => {
    switch (cat) {
      case 'healthy': return <CheckCircle2 size={20} />;
      case 'disease': return <AlertTriangle size={20} />;
      case 'warning': return <Search size={20} />;
    }
  };

  const getCategoryTitle = (cat: DiseaseCategory) => {
    switch (cat) {
      case 'healthy': return 'Healthy';
      case 'disease': return 'Diseases Detected';
      case 'warning': return 'Needs Attention';
    }
  };

  if (isLoadingSession) {
    return (
      <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <RefreshCw size={48} className="animate-spin" style={{ color: 'var(--clr-primary)', opacity: 0.5 }} />
      </div>
    );
  }

  if (!session) {
    return <Auth onSignIn={() => {
      setCurrentView('scanner');
      document.cookie = `currentView=scanner; path=/; max-age=${60 * 60 * 24 * 365}`;
      supabase.auth.getSession();
    }} />;
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-container">
          <div className="logo-icon">
            <Leaf size={24} />
          </div>
          <h1 className="logo-text">DocRian</h1>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            className="settings-btn"
            aria-label="Profile Settings"
            onClick={() => setIsSettingsOpen(true)}
            style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--clr-bg-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0,0,0,0.05)', color: 'var(--clr-primary)', overflow: 'hidden', padding: 0 }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <User size={20} />
            )}
          </button>
        </div>
      </header>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        session={session}
        onSignOut={() => {
          setIsSettingsOpen(false);
          setCurrentView('scanner');
          document.cookie = `currentView=scanner; path=/; max-age=${60 * 60 * 24 * 365}`;
          supabase.auth.signOut();
        }}
      />

      <main className="app-main" style={{ paddingBottom: '80px' }}>
        {currentView === 'scanner' ? (
          results.length > 0 ? (
            <>
            <section className="results-section">
              <div className="results-header">
                <h2>Diagnosis Results</h2>
                <button className="btn-outline" onClick={resetState}>
                  <RefreshCw size={16} /> New Scan
                </button>
              </div>

              <div className="results-container">
                {(Object.keys(groupedResults) as DiseaseCategory[]).map((category) => (
                  <div key={category} className="category-card">
                    <div className={`category-header ${category}`}>
                      <div className={`category-title ${category}`}>
                        {getCategoryIcon(category)}
                        {getCategoryTitle(category)}
                      </div>
                      <div className="category-badge">
                        {groupedResults[category].length} item{groupedResults[category].length > 1 ? 's' : ''}
                      </div>
                    </div>

                    <div className="image-grid">
                      {groupedResults[category].map((res) => (
                        <div 
                          key={res.id} 
                          className="image-item" 
                          style={{ cursor: 'pointer' }}
                          onClick={() => { setSelectedResult(res); setResultDisplayZoom(1); resultTransformRef.current = { scale: 1, x: 0, y: 0 }; }}
                        >
                          <img src={res.url} alt={res.disease} />
                          <div className="image-confidence">
                            {res.confidence}% • {res.disease.split(' ')[0]}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Result Image Expand Modal */}
            {selectedResult && (
              <div
                onClick={closeResultModal}
                onWheel={handleResultWheel}
                style={{
                  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  touchAction: 'none',
                }}
              >
                {/* Top bar */}
                <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10000 }}>
                  <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.1)', padding: '0.4rem 0.75rem', borderRadius: '8px', alignItems: 'center' }}>
                    <ZoomOut size={20} color="white" style={{ cursor: 'pointer' }} onClick={() => resultZoomAround(window.innerWidth/2, window.innerHeight/2, Math.max(0.5, resultTransformRef.current.scale - 0.5))} />
                    <span style={{ color: 'white', width: '38px', textAlign: 'center', fontSize: '0.85rem' }}>{Math.round(resultDisplayZoom * 100)}%</span>
                    <ZoomIn size={20} color="white" style={{ cursor: 'pointer' }} onClick={() => resultZoomAround(window.innerWidth/2, window.innerHeight/2, Math.min(10, resultTransformRef.current.scale + 0.5))} />
                  </div>
                  <button onClick={closeResultModal} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer', display: 'flex' }}>
                    <X size={22} />
                  </button>
                </div>

                {/* Image */}
                <div style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img
                    ref={resultImgRef}
                    src={selectedResult.url}
                    alt={selectedResult.disease}
                    draggable={false}
                    onClick={e => e.stopPropagation()}
                    onPointerDown={handleResultPointerDown}
                    onPointerMove={handleResultPointerMove}
                    onPointerUp={handleResultPointerUp}
                    onPointerLeave={handleResultPointerUp}
                    onTouchStart={handleResultTouchStart}
                    onTouchMove={handleResultTouchMove}
                    onTouchEnd={handleResultTouchEnd}
                    style={{
                      maxWidth: '90%', maxHeight: '75%',
                      transform: 'translate(0px, 0px) scale(1)',
                      transformOrigin: 'center center',
                      willChange: 'transform',
                      objectFit: 'contain',
                      cursor: 'grab',
                      userSelect: 'none',
                      touchAction: 'none',
                      borderRadius: '12px',
                    }}
                  />
                </div>

                {/* Bottom info card */}
                <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', background: 'rgba(15,20,30,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', minWidth: '260px', maxWidth: '90%' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem', margin: '0 0 0.2rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Diagnosis</p>
                    <p style={{ color: 'white', fontWeight: '700', fontSize: '1.05rem', margin: 0 }}>{selectedResult.disease}</p>
                  </div>
                  <div style={{
                    padding: '0.5rem 0.85rem', borderRadius: '999px', fontWeight: '700', fontSize: '1rem', whiteSpace: 'nowrap',
                    background: selectedResult.category === 'healthy' ? 'rgba(16,185,129,0.2)' : selectedResult.category === 'warning' ? 'rgba(234,179,8,0.2)' : 'rgba(239,68,68,0.2)',
                    color: selectedResult.category === 'healthy' ? '#34d399' : selectedResult.category === 'warning' ? '#fbbf24' : '#f87171',
                    border: `1px solid ${selectedResult.category === 'healthy' ? 'rgba(52,211,153,0.3)' : selectedResult.category === 'warning' ? 'rgba(251,191,36,0.3)' : 'rgba(248,113,113,0.3)'}`,
                  }}>
                    {selectedResult.confidence}%
                  </div>
                </div>
              </div>
            )}
            </>
          ) : isProcessing ? (
            <section className="processing-section">
              <div className="scanner-container">
                <div className="durian-leaf-mock">
                  <Leaf size={60} />
                </div>
                <div className="scanner-line"></div>
              </div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', fontWeight: '600' }}>Analyzing Images</h3>
              <p style={{ color: 'var(--clr-text-muted)', marginBottom: '2rem' }}>
                Our AI model is examining {images.length} image{images.length > 1 ? 's' : ''}...
              </p>
            </section>
          ) : (
            <section className="upload-section">
              <div className="hero-text">
                <h2>Diagnose your Durian Trees</h2>
                <p>Upload leaf images or take photos directly to detect diseases instantly with AI.</p>
              </div>

              <div
                className="upload-area"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => setShowSourceModal(true)}
              >
                <input
                  type="file"
                  ref={cameraInputRef}
                  className="file-input"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  onClick={(e) => e.stopPropagation()}
                  style={{ display: 'none' }}
                />
                <input
                  type="file"
                  ref={galleryInputRef}
                  className="file-input"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  onClick={(e) => e.stopPropagation()}
                  style={{ display: 'none' }}
                />
                <div className="upload-label">
                  <div className="upload-icon-wrapper">
                    <div className="upload-icon-ring"></div>
                    <Camera size={40} />
                  </div>
                  <h3>Tap to Capture or Upload</h3>
                  <p>Select one or multiple leaf photos</p>
                </div>
              </div>

              {/* Source Selection Modal */}
              {showSourceModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }} onClick={() => setShowSourceModal(false)}>
                  <div style={{ background: 'var(--clr-surface)', width: '100%', maxWidth: '320px', borderRadius: '16px', padding: '1.5rem', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    <h3 style={{ marginBottom: '1.5rem', color: 'var(--clr-text)' }}>Choose Image Source</h3>
                    <button 
                      onClick={() => { cameraInputRef.current?.click(); setShowSourceModal(false); }}
                      style={{ width: '100%', padding: '1rem', background: 'var(--clr-primary)', color: 'white', border: 'none', borderRadius: '8px', marginBottom: '0.75rem', fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}
                    >
                      <Camera size={20} /> Open Camera
                    </button>
                    <button 
                      onClick={() => { galleryInputRef.current?.click(); setShowSourceModal(false); }}
                      style={{ width: '100%', padding: '1rem', background: 'var(--clr-bg-alt)', color: 'var(--clr-text)', border: '1px solid #cbd5e1', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}
                    >
                      <ImageIcon size={20} /> Choose from Library
                    </button>
                    <button onClick={() => setShowSourceModal(false)} style={{ background: 'none', border: 'none', color: 'var(--clr-text-muted)', cursor: 'pointer', fontWeight: '500' }}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Next Action Modal */}
              {showNextActionModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                  <div style={{ background: 'var(--clr-surface)', width: '100%', maxWidth: '320px', borderRadius: '16px', padding: '1.5rem', textAlign: 'center' }}>
                    <div style={{ color: 'var(--clr-success)', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
                      <CheckCircle2 size={48} />
                    </div>
                    <h3 style={{ marginBottom: '0.5rem', color: 'var(--clr-text)', fontSize: '1.25rem' }}>Image Added!</h3>
                    <p style={{ color: 'var(--clr-text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>You have {images.length} image(s) ready to analyze.</p>
                    
                    <button 
                      onClick={() => { cameraInputRef.current?.click(); setShowNextActionModal(false); }}
                      style={{ width: '100%', padding: '0.8rem', background: 'var(--clr-bg)', color: 'var(--clr-text)', border: '1px solid #cbd5e1', borderRadius: '8px', marginBottom: '0.5rem', fontSize: '0.9rem', cursor: 'pointer', fontWeight: '500' }}
                    >
                      Continue Capturing
                    </button>
                    <button 
                      onClick={() => { galleryInputRef.current?.click(); setShowNextActionModal(false); }}
                      style={{ width: '100%', padding: '0.8rem', background: 'var(--clr-bg)', color: 'var(--clr-text)', border: '1px solid #cbd5e1', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem', cursor: 'pointer', fontWeight: '500' }}
                    >
                      Add some more from Library
                    </button>
                    <button 
                      onClick={() => { setShowNextActionModal(false); startAnalysis(); }}
                      style={{ width: '100%', padding: '1rem', background: 'var(--clr-primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}
                    >
                      <RefreshCw size={20} /> Done, Analyze Now
                    </button>
                  </div>
                </div>
              )}

              {images.length > 0 && !showNextActionModal && (
                <div className="preview-section">
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', fontWeight: '500' }}>
                    {images.length} Image{images.length > 1 ? 's' : ''} Selected
                  </h3>
                  <div className="preview-grid">
                    {images.slice(0, 4).map((img) => (
                      <div key={img.id} className="preview-item">
                        <img src={img.url} alt="Preview" />
                      </div>
                    ))}
                    {images.length > 4 && (
                      <div className="preview-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--clr-bg-alt)', fontSize: '1.25rem', fontWeight: '600', color: 'var(--clr-primary)' }}>
                        +{images.length - 4}
                      </div>
                    )}
                  </div>

                  <button className="btn-primary" onClick={startAnalysis}>
                    Analyze Images <RefreshCw size={20} />
                  </button>
                </div>
              )}
            </section>
          )
        ) : (
          <HistorySection session={session} />
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <button
          className={`nav-btn ${currentView === 'scanner' ? 'active' : ''}`}
          onClick={() => {
            setCurrentView('scanner');
            document.cookie = `currentView=scanner; path=/; max-age=${60 * 60 * 24 * 365}`;
          }}
        >
          <Camera size={24} />
          <span>Scanner</span>
        </button>
        <button
          className={`nav-btn ${currentView === 'history' ? 'active' : ''}`}
          onClick={() => {
            setCurrentView('history');
            document.cookie = `currentView=history; path=/; max-age=${60 * 60 * 24 * 365}`;
          }}
        >
          <History size={24} />
          <span>History</span>
        </button>
      </nav>
    </div>
  );
}
