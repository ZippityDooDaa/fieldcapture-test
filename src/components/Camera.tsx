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

export default function CameraComponent({ jobId, onPhotosChange }: CameraProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

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

  // Connect stream to video element AFTER it renders
  // This fixes the race condition: the video element only exists when showCamera=true,
  // so we must assign srcObject after React renders the <video> tag
  useEffect(() => {
    if (showCamera && videoRef.current && streamRef.current) {
      console.log('[Camera] Connecting stream to video element');
      videoRef.current.srcObject = streamRef.current;

      // Log when video actually starts playing
      const video = videoRef.current;
      const onPlaying = () => {
        console.log('[Camera] Video playing:', video.videoWidth, 'x', video.videoHeight);
      };
      const onError = (e: Event) => {
        console.error('[Camera] Video element error:', (e.target as HTMLVideoElement)?.error);
      };
      video.addEventListener('playing', onPlaying);
      video.addEventListener('error', onError);

      return () => {
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('error', onError);
      };
    }
  }, [showCamera]);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  }

  async function startCamera() {
    setError(null);
    setIsLoading(true);

    try {
      // Check if API exists
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser');
      }

      console.log('[Camera] Attempting getUserMedia...');
      console.log('[Camera] Available devices:', await navigator.mediaDevices.enumerateDevices().then(
        devices => devices.filter(d => d.kind === 'videoinput').map(d => ({ label: d.label, id: d.deviceId }))
      ));

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment'
        },
        audio: false
      });

      const videoTrack = stream.getVideoTracks()[0];
      console.log('[Camera] getUserMedia succeeded');
      console.log('[Camera] Video track:', videoTrack?.label, 'state:', videoTrack?.readyState, 'settings:', JSON.stringify(videoTrack?.getSettings()));

      streamRef.current = stream;
      // Show camera UI first so the <video> element renders,
      // then the useEffect below will connect the stream to the video element
      setShowCamera(true);
    } catch (err: any) {
      console.error('[Camera] getUserMedia failed:', err.name, err.message);
      let errorMsg = 'Camera not available. ';
      if (err.name === 'NotAllowedError') {
        errorMsg += 'Camera permission was denied. Check browser settings.';
      } else if (err.name === 'NotFoundError') {
        errorMsg += 'No camera found on this device.';
      } else if (err.name === 'NotReadableError') {
        errorMsg += 'Camera is in use by another app.';
      } else if (err.name === 'OverconstrainedError') {
        errorMsg += 'Could not find a suitable camera.';
      } else {
        errorMsg += err.message || 'Please use file upload.';
      }
      setError(errorMsg);
      // Auto-open file picker as fallback
      setTimeout(() => cameraInputRef.current?.click(), 100);
    } finally {
      setIsLoading(false);
    }
  }

  function capturePhoto() {
    console.log('[Camera] Capture requested. videoRef:', !!videoRef.current, 'videoWidth:', videoRef.current?.videoWidth, 'videoHeight:', videoRef.current?.videoHeight, 'readyState:', videoRef.current?.readyState);
    if (!videoRef.current || !videoRef.current.videoWidth) {
      console.error('[Camera] Video not ready - cannot capture');
      setError('Camera not ready yet. Wait for the preview to appear, then try again.');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setPreview(dataUrl);
      stopCamera();
    } catch (err) {
      console.error('[Camera] Error capturing photo:', err);
      setError('Error capturing photo.');
      stopCamera();
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setPreview(dataUrl);
      }
      setIsLoading(false);
    };
    
    reader.onerror = () => {
      setError('Error reading file. Please try again.');
      setIsLoading(false);
    };
    
    reader.readAsDataURL(file);
    
    // Reset input so same file can be selected again
    e.target.value = '';
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
    setError(null);
  }

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-fg">Photos</h3>
        <span className="text-sm text-muted-fg">{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg mb-3">
          {error}
        </div>
      )}

      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {photos.map((photo) => (
            <div key={photo.id} className="relative aspect-square cursor-pointer" onClick={() => setViewingPhoto(photo)}>
              <img
                src={photo.dataUrl}
                alt={photo.caption || 'Job photo'}
                className="w-full h-full object-cover rounded-lg hover:opacity-90 transition-opacity"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeletePhoto(photo.id);
                }}
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

      {/* Photo Preview Modal */}
      {viewingPhoto && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setViewingPhoto(null)}
        >
          <div className="relative max-w-full max-h-full">
            <button
              onClick={() => setViewingPhoto(null)}
              className="absolute -top-10 right-0 text-white p-2 hover:bg-white/10 rounded-full"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={viewingPhoto.dataUrl}
              alt={viewingPhoto.caption || 'Job photo'}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            {viewingPhoto.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-dark/70 text-fg text-sm p-3 text-center rounded-b-lg">
                {viewingPhoto.caption}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview Mode */}
      {preview ? (
        <div className="space-y-3">
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
        </div>
      ) : showCamera ? (
        /* Camera Mode */
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
      ) : (
        /* Selection Mode */
        <div className="space-y-3">
          {/* Hidden file inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {/* Take Photo Button */}
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
              {isLoading ? 'Opening...' : 'Take Photo'}
            </span>
          </button>
          
          {/* Camera App Button */}
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="w-full bg-slate border border-border rounded-lg py-4 flex flex-col items-center gap-1 text-muted-fg hover:border-primary hover:text-primary transition-colors"
          >
            <Camera className="w-6 h-6" />
            <span className="text-sm font-medium">Use Camera App</span>
            <span className="text-xs text-muted-fg">Opens device camera</span>
          </button>
          
          {/* Gallery Button */}
          <button
            onClick={() => galleryInputRef.current?.click()}
            className="w-full bg-slate border border-border rounded-lg py-4 flex flex-col items-center gap-1 text-muted-fg hover:border-primary hover:text-primary transition-colors"
          >
            <ImageIcon className="w-6 h-6" />
            <span className="text-sm font-medium">Choose from Gallery</span>
            <span className="text-xs text-muted-fg">Select existing photo</span>
          </button>
        </div>
      )}
    </div>
  );
}
