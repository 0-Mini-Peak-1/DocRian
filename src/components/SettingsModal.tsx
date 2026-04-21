'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { X, User, Palette, Info, LogOut, Leaf, Camera, Check } from 'lucide-react';
import Cropper from 'react-easy-crop';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: any;
  onSignOut: () => void;
}

const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<Blob> => {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', (err) => reject(err));
    img.src = imageSrc;
  });
  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject('No 2d context');

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((file) => {
      if (file) resolve(file);
      else reject(new Error('Canvas is empty'));
    }, 'image/jpeg', 0.9);
  });
};

export default function SettingsModal({ isOpen, onClose, session, onSignOut }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'account' | 'app' | 'about'>('account');
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Cropper states
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // App Settings
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    if (isOpen && session?.user?.id) {
      // Fetch profile
      supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', session.user.id)
        .single()
        .then(({ data }: { data: any }) => {
          if (data) {
            if (data.full_name) setFullName(data.full_name);
            if (data.avatar_url) {
              // Construct public URL for avatar
              const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(data.avatar_url);
              setAvatarUrl(publicUrlData.publicUrl);
            }
          }
        });
    }

    // Load theme
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(savedTheme as 'light' | 'dark');
  }, [isOpen, session]);

  const toggleTheme = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setImageToCrop(url);
    }
  };

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const saveAvatar = async () => {
    if (!imageToCrop || !croppedAreaPixels || !session?.user?.id) return;
    setLoading(true);
    setMessage('');
    
    try {
      const croppedBlob = await getCroppedImg(imageToCrop, croppedAreaPixels);
      const newFileName = `${session.user.id}-${Date.now()}.jpg`;

      // 1. First, list all files in the avatars bucket to find any old avatars for this user
      const { data: existingFiles, error: listError } = await supabase.storage
        .from('avatars')
        .list('', { search: session.user.id });
        
      if (!listError && existingFiles && existingFiles.length > 0) {
        // 2. Delete the old files to keep storage clean
        const filesToRemove = existingFiles.map((x) => x.name);
        await supabase.storage.from('avatars').remove(filesToRemove);
      }

      // 3. Upload the new file
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(newFileName, croppedBlob, {
          contentType: 'image/jpeg'
        });
        
      if (uploadError) throw uploadError;

      // 4. Update profiles table with the new file name
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ 
          id: session.user.id, 
          avatar_url: newFileName,
          updated_at: new Date().toISOString() 
        });

      if (profileError) throw profileError;

      // 5. Get public URL to show immediately
      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(newFileName);
      setAvatarUrl(publicUrlData.publicUrl);
      
      setImageToCrop(null);
      setMessage('Avatar updated successfully!');
      
      // Dispatch custom event to notify header
      window.dispatchEvent(new Event('profile-updated'));

    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async () => {
    setLoading(true);
    setMessage('');
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({ 
          id: session?.user?.id, 
          full_name: fullName, 
          updated_at: new Date().toISOString() 
        });
      
      if (error) throw error;
      setMessage('Profile updated successfully!');
      
      // Dispatch custom event
      window.dispatchEvent(new Event('profile-updated'));
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
    }}>
      <div style={{
        background: 'var(--clr-surface)', width: '100%', maxWidth: '400px', borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        maxHeight: '90vh'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--clr-primary)', margin: 0 }}>Settings</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--clr-text-muted)' }}>
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        {!imageToCrop && (
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(0,0,0,0.05)', background: 'var(--clr-bg-alt)' }}>
            {[
              { id: 'account', icon: <User size={16} />, label: 'Account' },
              { id: 'app', icon: <Palette size={16} />, label: 'App' },
              { id: 'about', icon: <Info size={16} />, label: 'About' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  flex: 1, padding: '0.75rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  background: activeTab === tab.id ? 'var(--clr-surface)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--clr-primary)' : 'var(--clr-text-muted)',
                  fontWeight: activeTab === tab.id ? '600' : '500',
                  borderBottom: activeTab === tab.id ? '2px solid var(--clr-primary)' : '2px solid transparent'
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
          
          {/* Cropper View */}
          {imageToCrop ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ margin: 0, textAlign: 'center' }}>Crop Profile Picture</h3>
              <div style={{ position: 'relative', width: '100%', height: '300px', background: '#333', borderRadius: '12px', overflow: 'hidden' }}>
                <Cropper
                  image={imageToCrop}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button 
                  onClick={() => setImageToCrop(null)}
                  disabled={loading}
                  style={{ flex: 1, padding: '0.75rem', background: 'var(--clr-bg-alt)', color: 'var(--clr-text)', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={saveAvatar}
                  disabled={loading}
                  style={{ flex: 1, padding: '0.75rem', background: 'var(--clr-primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  {loading ? 'Saving...' : <><Check size={18} /> Apply</>}
                </button>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'account' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  {/* Avatar Section */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1rem' }}>
                    <div 
                      style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '50%', background: 'var(--clr-bg-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--clr-primary-light)', overflow: 'hidden', marginBottom: '0.5rem', cursor: 'pointer' }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <User size={32} color="var(--clr-text-muted)" />
                      )}
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s', ':hover': { opacity: 1 } } as any}>
                        <Camera size={24} color="white" />
                      </div>
                    </div>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      style={{ background: 'none', border: 'none', color: 'var(--clr-primary)', fontSize: '0.875rem', fontWeight: '500', cursor: 'pointer' }}
                    >
                      Change Picture
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      accept="image/*" 
                      onChange={handleFileChange} 
                      style={{ display: 'none' }} 
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--clr-text-muted)' }}>Email (Read-only)</label>
                    <input type="text" value={session?.user?.email || ''} disabled style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'var(--clr-bg-alt)', color: 'var(--clr-text-muted)' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--clr-text-muted)' }}>Full Name</label>
                    <input 
                      type="text" 
                      value={fullName} 
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your name"
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'var(--clr-surface)', color: 'var(--clr-text)' }} 
                    />
                  </div>
                  {message && <div style={{ fontSize: '0.875rem', color: message.includes('Error') ? 'var(--clr-danger)' : 'var(--clr-success)' }}>{message}</div>}
                  <button 
                    onClick={updateProfile}
                    disabled={loading}
                    style={{ width: '100%', padding: '0.75rem', background: 'var(--clr-primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', marginTop: '0.5rem' }}
                  >
                    {loading ? 'Saving...' : 'Save Profile'}
                  </button>

                  <div style={{ borderTop: '1px solid rgba(0,0,0,0.1)', margin: '1rem 0' }}></div>
                  
                  <button 
                    onClick={onSignOut}
                    style={{ width: '100%', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--clr-danger)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    <LogOut size={18} /> Sign Out
                  </button>
                </div>
              )}

              {activeTab === 'app' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--clr-text)' }}>Appearance</h3>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <button 
                        onClick={() => toggleTheme('light')}
                        style={{ flex: 1, padding: '1rem', border: `2px solid ${theme === 'light' ? 'var(--clr-primary)' : 'rgba(0,0,0,0.1)'}`, borderRadius: '12px', background: 'var(--clr-surface)', color: 'var(--clr-text)', cursor: 'pointer' }}
                      >
                        Light Mode
                      </button>
                      <button 
                        onClick={() => toggleTheme('dark')}
                        style={{ flex: 1, padding: '1rem', border: `2px solid ${theme === 'dark' ? 'var(--clr-primary)' : 'rgba(0,0,0,0.1)'}`, borderRadius: '12px', background: '#0f172a', color: '#f8fafc', cursor: 'pointer' }}
                      >
                        Dark Mode
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'about' && (
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <div style={{ width: '64px', height: '64px', background: 'linear-gradient(135deg, var(--clr-primary), var(--clr-primary-light))', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', margin: '0 auto 1rem', boxShadow: 'var(--shadow-md)' }}>
                    <Leaf size={32} />
                  </div>
                  <h2 style={{ color: 'var(--clr-primary)', marginBottom: '0.5rem' }}>DocRian</h2>
                  <p style={{ color: 'var(--clr-text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                    AI-powered durian disease detection.<br/>v1.0.0
                  </p>
                  <p style={{ color: 'var(--clr-text-muted)', fontSize: '0.8rem' }}>
                    Built with Next.js & Supabase.<br/>Designed for Mobile.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
