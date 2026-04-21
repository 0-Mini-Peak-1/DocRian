'use client';

import { useState, useRef, useEffect } from 'react';
import { Settings, Camera, Leaf, RefreshCw, AlertTriangle, CheckCircle2, Search } from 'lucide-react';
import Image from 'next/image';

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
  const [images, setImages] = useState<{ id: string; url: string; file: File }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ScanResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.url));
    };
  }, [images]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newImages = Array.from(e.target.files).map((file) => ({
        id: Math.random().toString(36).substring(7),
        url: URL.createObjectURL(file),
        file,
      }));
      setImages((prev) => [...prev, ...newImages]);
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
      setImages((prev) => [...prev, ...newImages]);
    }
  };

  const startAnalysis = () => {
    if (images.length === 0) return;
    setIsProcessing(true);

    // Mock Deep Learning Model processing
    setTimeout(() => {
      const mockDiseases = [
        { name: 'Healthy Leaf', category: 'healthy' as DiseaseCategory },
        { name: 'Leaf Blight (Phytophthora)', category: 'disease' as DiseaseCategory },
        { name: 'Algal Spot', category: 'disease' as DiseaseCategory },
        { name: 'Yellowing (Nutrient Def)', category: 'warning' as DiseaseCategory },
      ];

      const newResults = images.map((img) => {
        const randomDisease = mockDiseases[Math.floor(Math.random() * mockDiseases.length)];
        return {
          id: img.id,
          url: img.url,
          disease: randomDisease.name,
          category: randomDisease.category,
          confidence: Math.floor(Math.random() * 20) + 80, // 80-99%
        };
      });

      setResults(newResults);
      setIsProcessing(false);
    }, 2500); // simulate 2.5s network delay
  };

  const resetState = () => {
    setImages([]);
    setResults([]);
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-container">
          <div className="logo-icon">
            <Leaf size={24} />
          </div>
          <h1 className="logo-text">DocRian</h1>
        </div>
        <button className="settings-btn" aria-label="Settings">
          <Settings size={24} />
        </button>
      </header>

      <main className="app-main">
        {results.length > 0 ? (
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
                      <div key={res.id} className="image-item">
                        {/* Using unoptimized standard img for object URLs */}
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
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                className="file-input" 
                accept="image/*" 
                multiple 
                onChange={handleFileChange}
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

            {images.length > 0 && (
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
        )}
      </main>
    </div>
  );
}
