import React, { useState, useRef, useEffect } from 'react';
import { Play, RotateCw, ExternalLink, Bookmark, Star } from 'lucide-react';

export default function DeciderWheel({ 
  matchingShows = [], 
  onToggleWatchlist, 
  watchlist = [] 
}) {
  const canvasRef = useRef(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedShow, setSelectedShow] = useState(null);
  
  // Choose up to 8 shows to show on the wheel for readability
  const wheelShows = React.useMemo(() => {
    if (matchingShows.length === 0) return [];
    // Shuffle and pick 8, or just slice first 8
    return matchingShows.slice(0, 8);
  }, [matchingShows]);

  const numSlices = wheelShows.length;
  
  // Animation state ref variables to prevent rerender cycles during animation
  const animationRef = useRef(null);
  const rotationAngle = useRef(0);
  const angularVelocity = useRef(0);

  // Re-draw wheel whenever candidate list changes
  useEffect(() => {
    drawWheel();
  }, [wheelShows]);

  const drawWheel = (currentAngle = 0) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 10;

    ctx.clearRect(0, 0, width, height);

    if (numSlices === 0) {
      // Draw empty wheel message
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = '#12131a';
      ctx.fill();
      ctx.strokeStyle = '#242636';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#6b7280';
      ctx.font = '14px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No shows match filters', centerX, centerY);
      return;
    }

    const arcAngle = (2 * Math.PI) / numSlices;
    const colors = [
      '#7c3aed', // Purple
      '#db2777', // Pink
      '#2563eb', // Blue
      '#059669', // Emerald
      '#d97706', // Amber
      '#4f46e5', // Indigo
      '#0891b2', // Cyan
      '#dc2626'  // Red
    ];

    // Draw Slices
    for (let i = 0; i < numSlices; i++) {
      const angle = currentAngle + i * arcAngle;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, angle, angle + arcAngle);
      ctx.closePath();
      
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      ctx.strokeStyle = '#0a0b10';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw Text in Slices
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(angle + arcAngle / 2);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Inter';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      
      const showTitle = wheelShows[i].title;
      // Truncate long titles
      const truncatedTitle = showTitle.length > 15 ? showTitle.slice(0, 13) + '..' : showTitle;
      ctx.fillText(truncatedTitle, radius - 20, 0);
      ctx.restore();
    }

    // Draw Outer Rim
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#242636';
    ctx.lineWidth = 8;
    ctx.stroke();

    // Draw Glowing Indicator Dots
    for (let i = 0; i < numSlices * 2; i++) {
      const dotAngle = (i * Math.PI) / numSlices;
      const dotX = centerX + (radius - 4) * Math.cos(dotAngle);
      const dotY = centerY + (radius - 4) * Math.sin(dotAngle);
      
      ctx.beginPath();
      ctx.arc(dotX, dotY, 3, 0, 2 * Math.PI);
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#d946ef';
      ctx.fill();
    }

    // Draw Center Peg (Gold Button)
    ctx.beginPath();
    ctx.arc(centerX, centerY, 35, 0, 2 * Math.PI);
    ctx.fillStyle = '#0a0b10';
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 10px Outfit';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SELECT', centerX, centerY);
  };

  const startSpin = () => {
    if (isSpinning || numSlices === 0) return;

    setSelectedShow(null);
    setIsSpinning(true);
    
    // Set initial random angular velocity (degrees/radian equivalent)
    // 0.3 to 0.5 rad per frame
    angularVelocity.current = 0.35 + Math.random() * 0.15;
    
    animateSpin();
  };

  const animateSpin = () => {
    rotationAngle.current += angularVelocity.current;
    // Friction: reduce speed gradually
    angularVelocity.current *= 0.985;

    // Draw current rotation state
    drawWheel(rotationAngle.current);

    if (angularVelocity.current > 0.002) {
      animationRef.current = requestAnimationFrame(animateSpin);
    } else {
      // Spinning finished
      setIsSpinning(false);
      determineWinner();
    }
  };

  const determineWinner = () => {
    if (numSlices === 0) return;
    
    // Pointer is at the top (-90 degrees or 3/2 * PI radians)
    // Find which slice overlaps with -PI/2 in the rotation
    const arcAngle = (2 * Math.PI) / numSlices;
    
    // Normalize rotation angle between 0 and 2*PI
    let normalizedRotation = rotationAngle.current % (2 * Math.PI);
    if (normalizedRotation < 0) {
      normalizedRotation += 2 * Math.PI;
    }

    // Math: The pointer is pointing at 1.5 * PI (top of canvas)
    // The relative angle on the wheel pointing at 1.5 * PI is:
    // (1.5 * PI - normalizedRotation) mod 2*PI
    let winningRelativeAngle = (1.5 * Math.PI - normalizedRotation) % (2 * Math.PI);
    if (winningRelativeAngle < 0) {
      winningRelativeAngle += 2 * Math.PI;
    }

    const winnerIndex = Math.floor(winningRelativeAngle / arcAngle);
    const winner = wheelShows[winnerIndex];
    setSelectedShow(winner);
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const handleSpinAgain = () => {
    setSelectedShow(null);
    startSpin();
  };

  const showInWatchlist = selectedShow ? watchlist.some(item => item.id === selectedShow.id) : false;

  return (
    <div className="decider-container">
      <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>The Sieve Decider</h2>
      <p className="decider-intro">
        Can't make up your mind? We will sieve through your current filters ({matchingShows.length} matches) and choose the perfect watch for you. Spin the wheel!
      </p>

      <div className="wheel-section">
        {/* Visual pointer indicator pointing downwards from the top */}
        <div className="wheel-pointer"></div>
        
        <div className="wheel-outer">
          <canvas 
            id="decider-wheel-canvas"
            ref={canvasRef} 
            width={300} 
            height={300}
            style={{ width: '300px', height: '300px' }}
          />
        </div>

        <button 
          id="btn-spin"
          className="btn btn-primary" 
          onClick={startSpin}
          disabled={isSpinning || numSlices === 0}
          style={{ padding: '0.85rem 2.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1rem' }}
        >
          <RotateCw size={18} className={isSpinning ? 'spin-animation' : ''} />
          {isSpinning ? 'Sieving...' : 'Spin the Wheel'}
        </button>

        {/* Selected Movie Overlay Panel */}
        {selectedShow && (
          <div className="decider-result-card" id="decider-result-card">
            <span className="result-badge">🎉 Your Perfect Match Found</span>
            <div className="result-card-header">
              <div>
                <h3 className="result-title">{selectedShow.title}</h3>
                <span className="result-meta">
                  {selectedShow.type === 'movie' ? 'Movie' : 'Series'} • {selectedShow.year} • {selectedShow.language}
                </span>
              </div>
              <div className="sieve-score-value" style={{ fontSize: '1.25rem' }}>
                <Star size={18} fill="currentColor" />
                {(( (selectedShow.ratings.imdb ? selectedShow.ratings.imdb / 2 : 0) + 
                    (selectedShow.ratings.rottenTomatoes ? selectedShow.ratings.rottenTomatoes / 20 : 0) + 
                    (selectedShow.ratings.letterboxd ? selectedShow.ratings.letterboxd : 0)
                   ) / [selectedShow.ratings.imdb, selectedShow.ratings.rottenTomatoes, selectedShow.ratings.letterboxd].filter(Boolean).length
                 ).toFixed(2)}
              </div>
            </div>
            
            <p className="card-overview" style={{ height: 'auto', marginBottom: '1.25rem' }}>
              {selectedShow.overview}
            </p>

            <div className="result-actions">
              <button 
                id="btn-spin-again"
                className="btn btn-secondary" 
                onClick={handleSpinAgain}
                style={{ flex: 1 }}
              >
                <RotateCw size={14} />
                Spin Again
              </button>
              
              <button 
                id="btn-result-watchlist"
                className={`btn btn-secondary btn-watch ${showInWatchlist ? 'in-watchlist' : ''}`}
                onClick={() => onToggleWatchlist(selectedShow)}
                style={{ flex: 1.5 }}
              >
                <Bookmark size={14} fill={showInWatchlist ? "currentColor" : "none"} />
                {showInWatchlist ? 'Watchlisted' : 'Add to Watchlist'}
              </button>

              {selectedShow.youtubeTrailer && (
                <a 
                  id="btn-result-trailer"
                  href={selectedShow.youtubeTrailer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{ padding: '0.65rem 1rem' }}
                >
                  <Play size={14} fill="currentColor" />
                  Trailer
                </a>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Dynamic spinning helper styling */}
      <style>{`
        .spin-animation {
          animation: spin 1.5s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
