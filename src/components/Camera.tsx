'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Photo } from '@/types';
import { addPhoto, getPhotosByJob, deletePhoto } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';
import { Camera, X, Plus, Trash2 } from 'lucide-react';

interface CameraProps {
  jobId: string;
  onPhotosChange?: () => void;
}

export default function CameraComponent({ jobId, onPhotosChange }: CameraProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load existing photos
  const loadPhotos = useCallback(async () => {
    const existing = await getPhotosByJob(jobId);
    setPhotos(existing);
  }, [jobId]);

  // Load photos when jobId changes
  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }, 
        audio: false 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCapturing(true);
    } catch (err) {
      console.error('Camera error:', err);
      alert('Could not access camera. Please check permissions.');
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCapturing(false);
    setPreview(null);
    setCaption('');
  }

  function capturePhoto() {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setPreview(dataUrl);
    stopCamera();
  }

  async function savePhoto() {
    if (!preview) return;

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
    onPhotosChange?.();
  }

  async function handleDeletePhoto(photoId: string) {
    if (confirm('Delete this photo?')) {
      await deletePhoto(photoId);
      await loadPhotos();
      onPhotosChange?.();
    }
  }

  // Load photos on mount
  useState(() => {
    loadPhotos();
  });

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Photos</h3>
        <span className="text-sm text-gray-500">{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
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
                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full"
              >
                <Trash2 className="w-3 h-3" />
              </button>
              {photo.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">
                  {photo.caption}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Camera Interface */}
      {capturing ? (
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
              className="bg-gray-600 text-white px-4 py-2 rounded-full"
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
      ) : preview ? (
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
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                setPreview(null);
                setCaption('');
              }}
              className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm"
            >
              Retake
            </button>
            <button
              onClick={savePhoto}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm"
            >
              Save Photo
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={startCamera}
          className="w-full border-2 border-dashed border-gray-300 rounded-lg py-8 flex flex-col items-center gap-2 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          <Camera className="w-8 h-8" />
          <span className="text-sm font-medium">Take Photo</span>
        </button>
      )}
    </div>
  );
}