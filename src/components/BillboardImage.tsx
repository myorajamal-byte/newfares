import React, { useState, useEffect } from 'react';

interface BillboardImageProps {
  billboard: any;
  className?: string;
  alt?: string;
  onClick?: () => void;
}

export const BillboardImage: React.FC<BillboardImageProps> = ({ 
  billboard, 
  className = '', 
  alt = 'صورة اللوحة',
  onClick
}) => {
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const [hasError, setHasError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  // Extract image sources
  const imageName = billboard?.image_name || billboard?.Image_Name;
  const imageUrl = billboard?.Image_URL || billboard?.image || billboard?.billboard_image;
  
  // Check if imageUrl is actually a URL or just a filename
  const isValidUrl = imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('https'));
  
  // PRIMARY: External URL (only if it's a real URL)
  const externalUrl = isValidUrl ? imageUrl : null;
  
  // SECONDARY: Local paths - try multiple combinations
  const localPaths = [];
  
  // Try image_name field first
  if (imageName) {
    // Remove any leading /image/ if it exists to avoid duplication
    const cleanImageName = imageName.replace(/^\/image\//, '');
    localPaths.push(`/image/${cleanImageName}`);
  }
  
  // Try imageUrl as filename if it's not a URL
  if (imageUrl && !isValidUrl) {
    // Remove any leading /image/ if it exists to avoid duplication
    const cleanImageUrl = imageUrl.replace(/^\/image\//, '');
    localPaths.push(`/image/${cleanImageUrl}`);
  }
  
  // Try billboard name as fallback
  if (billboard?.Billboard_Name) {
    localPaths.push(`/image/${billboard.Billboard_Name}.jpg`);
  }
  
  // FINAL: Placeholder
  const placeholderSrc = '/placeholder-billboard.jpg';

  // Get all sources in priority order
  const getSources = () => {
    const sources = [];
    
    // 1. External URL (if valid)
    if (externalUrl) {
      sources.push(externalUrl);
    }
    
    // 2. Local paths (remove duplicates)
    const uniquePaths = [...new Set(localPaths)];
    uniquePaths.forEach(path => {
      sources.push(path);
    });
    
    // 3. Placeholder
    sources.push(placeholderSrc);
    
    return sources;
  };

  // Initialize with first available source
  useEffect(() => {
    const sources = getSources();
    setHasError(false);
    setLoadAttempt(0);
    if (sources.length > 0) {
      setCurrentSrc(sources[0]);
      console.log('🖼️ Initializing with source:', sources[0]);
      console.log('🖼️ All available sources:', sources);
    }
  }, [externalUrl, imageName, imageUrl]);

  const handleImageError = () => {
    const sources = getSources();
    const nextAttempt = loadAttempt + 1;
    
    console.log(`❌ Image failed to load: ${currentSrc}`);
    console.log(`🔄 Trying next source (attempt ${nextAttempt + 1}/${sources.length})`);
    
    if (nextAttempt < sources.length) {
      setLoadAttempt(nextAttempt);
      setCurrentSrc(sources[nextAttempt]);
      console.log(`🔄 Next source: ${sources[nextAttempt]}`);
    } else {
      setHasError(true);
      console.log('💥 All sources failed, using placeholder');
    }
  };

  const handleImageLoad = () => {
    setHasError(false);
    console.log(`✅ Image loaded successfully: ${currentSrc}`);
  };

  // Debug logging
  useEffect(() => {
    console.log('🖼️ BillboardImage Debug:', {
      billboardName: billboard?.Billboard_Name || billboard?.name,
      imageName: imageName,
      imageUrl: imageUrl,
      isValidUrl: isValidUrl,
      externalUrl: externalUrl,
      localPaths: localPaths,
      currentSrc: currentSrc,
      loadAttempt: loadAttempt,
      allSources: getSources()
    });
  }, [currentSrc, loadAttempt]);

  if (!currentSrc) {
    return (
      <div className={`${className} bg-muted flex items-center justify-center`}>
        <span className="text-muted-foreground text-sm">لا توجد صورة</span>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      onClick={onClick}
      onError={handleImageError}
      onLoad={handleImageLoad}
      loading="lazy"
      style={{ 
        objectFit: 'cover',
        objectPosition: 'center'
      }}
    />
  );
};