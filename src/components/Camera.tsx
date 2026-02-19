'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Photo } from '@/types';
import { addPhoto, getPhotosByJob, deletePhoto } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';
import { Camera, X, Plus, Trash2, Upload, ImageIcon } from 'lucide-react';

interface CameraProps {
  jobId: string;
  onPhotosChange?: () => void;
}

type CameraMode = 'select' | 'camera' | 'preview' | 'file';

export default function CameraComponent({ jobId, onPhotosChange }: CameraProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [mode, setMode] = useState<CameraMode>('select');
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing photos
  const loadPhotos = useCallback(async () => {
    try {
      const existing = await getPhotosByJob(jobId);
      setPhotos(existing);
    } catch (err) {
      console.error('Error loading photos:', err);
    }
  }, [jobId]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (mode === 'camera') {
      setMode('select');
    }
  }

  async function startCamera() {
    setError(null);
    setIsLoading(true);
    
    try {
      console.log('[Camera] Attempting getUserMedia...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }, 
        audio: false 
      });
      
      console.log('[Camera] getUserMedia succeeded');
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      setMode('camera');
    } catch (err: any) {
      console.error('[Camera] getUserMedia failed:', err);
      console.error('[Camera] Error name:', err.name);
      console.error('[Camera] Error message:', err.message);
      
      // Fall back to file input
      setError('Camera not available. Using file upload instead.');
      setMode('file');
    } finally {
      setIsLoading(false);
    }
  }

  function capturePhoto() {
    if (!videoRef.current) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 1920;
      canvas.height = videoRef.current.videoHeight || 1080;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setPreview(dataUrl);
      setMode('preview');
      stopCamera();
    } catch (err) {
      console.error('[Camera] Error capturing photo:', err);
      setError('Error capturing photo. Please try file upload.');
      setMode('file');
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setPreview(dataUrl);
        setMode('preview');
      }
      setIsLoading(false);
    };
    
    reader.onerror = () => {
      setError('Error reading file. Please try again.');
      setIsLoading(false);
    };
    
    reader.readAsDataURL(file);
  }

  function triggerFileInput() {
    fileInputRef.current?.click();
  }

  async function savePhoto() {
    if (!preview) return;

    try {
      const photo: Photo = {
        id: uuidv4(),
        jobId,
        dataUrl: preview,
        caption,
        createdAt: Date.now(),
      };

      await addPhoto(photo);
      await loadPhotos();
      setPreview(null);
      setCaption('');
      setMode('select');
      setError(null);
      onPhotosChange?.();
    } catch (err) {
      console.error('[Camera] Error saving photo:', err);
      setError('Error saving photo. Please try again.');
    }
  }

  async function handleDeletePhoto(photoId: string) {
    if (confirm('Delete this photo?')) {
      try {
        await deletePhoto(photoId);
        await loadPhotos();
        onPhotosChange?.();
      } catch (err) {
        console.error('[Camera] Error deleting photo:', err);
      }
    }
  }

  function cancelPreview() {
    setPreview(null);
    setCaption('');
    setMode('select');
    setError(null);
  }

  // Render based on mode
  const renderContent = () => {
    switch (mode) {
      case 'camera':
        return (
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full aspect-video object-cover"
            />
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
              <button
                onClick={stopCamera}
                className="bg-gray-600 text-white px-4 py-2 rounded-full text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={capturePhoto}
                className="bg-white text-gray-900 w-16 h-16 rounded-full border-4 border-gray-300 flex items-center justify-center"
              >
                <div className="w-12 h-12 bg-white rounded-full border-2 border-gray-900" />
              </button>
            </div>
          </div>
        );

      case 'preview':
        return (
          <div className="space-y-3">
            <img
              src={preview || ''}
              alt="Preview"
              className="w-full rounded-lg"
            />
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add caption (optional)"
              className="w-full px-3 py-2 bg-slate text-fg border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
            />
            <div className="flex gap-2">
              <button
                onClick={cancelPreview}
                className="flex-1 bg-muted text-muted-fg py-2 rounded-lg text-sm font-medium"
              >
                Retake
              </button>
              <button
                onClick={savePhoto}
                className="flex-1 bg-primary text-dark py-2 rounded-lg text-sm font-medium"
              >
                Save Photo
              </button>
            </div>
          </div>
        );

      case 'file':
        return (
          <div className="space-y-3">
            {preview ? (
              <>
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full rounded-lg"
                />
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add caption (optional)"
                  className="w-full px-3 py-2 bg-slate text-fg border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
                />
                <div className="flex gap-2">
                  <button
                    onClick={cancelPreview}
                    className="flex-1 bg-muted text-muted-fg py-2 rounded-lg text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={savePhoto}
                    className="flex-1 bg-primary text-dark py-2 rounded-lg text-sm font-medium"
                  >
                    Save Photo
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={triggerFileInput}
                  className="w-full bg-card border-2 border-dashed border-border rounded-lg py-8 flex flex-col items-center gap-2 text-muted-fg hover:border-primary hover:text-primary transition-colors"
                >
                  <Camera className="w-8 h-8" />
                  <span className="text-sm font-medium">Take Photo</span>
                  <span className="text-xs text-muted-fg">Uses camera app</span>
                </button>
                <button
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.removeAttribute('capture');
                      fileInputRef.current.click();
                      fileInputRef.current.setAttribute('capture', 'environment');
                    }
                  }}
                  className="w-full bg-card border-2 border-dashed border-border rounded-lg py-6 flex flex-col items-center gap-2 text-muted-fg hover:border-primary hover:text-primary transition-colors"
                >
                  <ImageIcon className="w-6 h-6" />
                  <span className="text-sm font-medium">Choose from Gallery</span>
                </button>
                <button
                  onClick={() => setMode('select')}
                  className="w-full py-2 text-muted-fg text-sm"
                >
                  Go Back
                </button>
              </div>
            )}
          </div>
        );

      default: // 'select'
        return (
          <div className="space-y-2">
            {error && (
              <div className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                {error}
              </div>
            )}
            <button
              onClick={startCamera}
              disabled={isLoading}
              className="w-full bg-card border-2 border-dashed border-border rounded-lg py-6 flex flex-col items-center gap-2 text-muted-fg hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera className="w-8 h-8" />
              )}
              <span className="text-sm font-medium">
                {isLoading ? 'Opening camera...' : 'Take Photo'}
              </span>
            </button>
            <button
              onClick={() => setMode('file')}
              className="w-full py-2 text-muted-fg text-sm hover:text-fg transition-colors"
            >
              Or upload from device
            </button>
          </div>
        );
    }
  };

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-fg">Photos</h3>
        <span className="text-sm text-muted-fg">{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {photos.map((photo) => (
            <div key={photo.id} className="relative aspect-square">
              <img
                src={photo.dataUrl}
                alt={photo.caption || 'Job photo'}
                className="w-full h-full object-cover rounded-lg"
              />
              <button
                onClick={() => handleDeletePhoto(photo.id)}
                className="absolute top-1 right-1 bg-destructive text-white p-1 rounded-full"
              >
                <Trash2 className="w-3 h-3" />
              </button>
              {photo.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-dark/70 text-fg text-xs p-1 truncate">
                  {photo.caption}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Camera Interface */}
      {renderContent()}
    </div>
  );
}
