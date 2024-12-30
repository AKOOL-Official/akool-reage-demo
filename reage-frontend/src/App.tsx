import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import { io } from 'socket.io-client';

function App() {
  const [token, setToken] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState('image');
  const [targetImage, setTargetImage] = useState<string>("");
  const [sourceImage, setSourceImage] = useState<string>("");
  const [isSingleFace, setIsSingleFace] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [swapResult, setSwapResult] = useState<string | null>(null);
  const [swapStatus, setSwapStatus] = useState<string>('');
  const [showResultPopup, setShowResultPopup] = useState(false);
  const [videoResult, setVideoResult] = useState<string | null>(null);
  const [showVideoResultPopup, setShowVideoResultPopup] = useState(false);
  const [authMethod, setAuthMethod] = useState<'token' | 'credentials'>('token');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [reageValue, setReageValue] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string>("https://d3t6pcz7y7ey7x.cloudfront.net/Video10__d2a8cf85-10ae-4c2d-8f4b-d818c0a2e4a4.mp4");
  const [videoReageValue, setVideoReageValue] = useState(0);
  const [landmarksStr, setLandmarksStr] = useState<string | null>(null);
  const [showImageResultPopup, setShowImageResultPopup] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (authMethod === 'credentials') {
      handleCredentialsSubmit();
    } else {
      setIsSubmitted(true);
    }
  };

  const handleCredentialsSubmit = async () => {
    try {
      const response = await axios.post('https://openapi.akool.com/api/open/v3/getToken', {
        clientId,
        clientSecret
      });
      
      setToken(response.data.token);
      setIsSubmitted(true);
    } catch (error) {
      console.error('Error getting token:', error);
      alert('Failed to authenticate with provided credentials');
    }
  };



  useEffect(() => {
    // Initialize socket connection when component mounts
    const socket = io('http://localhost:3007', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      autoConnect: true,
    });

    // Connection event handlers
    socket.on('connect', () => {
      setIsLoading(false);
      console.log('WebSocket connected successfully');
    });

    socket.on('connect_error', (error) => {
      console.error('Connection Error:', error);
      // Attempt to reconnect
      setTimeout(() => {
        socket.connect();
      }, 1000);
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Reconnect if server disconnected
        socket.connect();
      }
    });

    socket.on('message', (message) => {
      console.log('Received status update:', message);
      
      setIsLoading(message.data.status !== 3 && message.data.status !== 4);
      
      if (message.data.type === 'error') {
        alert(message.data.message);
        setSwapStatus('Failed');
      } else {
        console.log("Inside else",message.data.status);
        
        setSwapStatus(message.data.message);
        if (message.data.status === 3 && message.data.url) {
          // Close the loader
          setIsLoading(false);
          
          // Show the result popup with the resulting image
          setSwapResult(message.data.url);
          setShowResultPopup(true);
          
          // Check if the URL ends with a video extension
          const isVideo = /\.(mp4|mov|avi|wmv|flv|mkv)$/i.test(message.data.url);
          
          if (isVideo) {
            setVideoResult(message.data.url);
            setShowVideoResultPopup(true);
          } else {
            // Ensure the image result popup is shown
            setShowImageResultPopup(true);
          }
        }
      }
    });

    // Cleanup
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const handleVideoReage = async () => {
    if (!videoUrl) return;
    
    setIsLoading(true);
    setSwapStatus('Starting video reage process...');
    
    try {
      const response = await axios.post('https://sg3.akool.com/detect', {
        single_face: isSingleFace,
        image_url: targetImage
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Extract landmarks_str from the response and store it in state
      const landmarksStr = response.data.landmarks_str;
      setLandmarksStr(landmarksStr);

      // New API call using landmarksStr
      const apiCallData = {
        targetImage: [{
          path: targetImage,
          opts: landmarksStr
        }],
        face_reage: videoReageValue,
        modifyVideo: videoUrl,
        webhookUrl: "https://4637-219-91-134-123.ngrok-free.app/api/webhook"
      };

      console.log("Payload for video : ",apiCallData);
      

      // Make the API call to the new endpoint
      const apiResponse = await axios.post('https://openapi.akool.com/api/open/v3/faceswap/highquality/vidreage', apiCallData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      setSwapStatus('Video reage completed successfully');
      // You might want to set some result state here
    } catch (error) {
      console.error('Error during video reage:', error);
      setSwapStatus('Failed to apply video reage effect');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isLoading) {
      document.body.classList.add('loading');
    } else {
      document.body.classList.remove('loading');
    }
  }, [isLoading]);

  const handleDownload = async () => {
    if (!swapResult) return;
    
    try {
      // Create a new image element
      const img = new Image();
      img.crossOrigin = "anonymous";  // Try to request with CORS
      
      // Create a canvas to draw the image
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      // Return a promise that resolves when the image loads
      await new Promise((resolve, reject) => {
        img.onload = () => {
          // Set canvas size to match image
          canvas.width = img.width;
          canvas.height = img.height;
          
          // Draw image to canvas
          ctx?.drawImage(img, 0, 0);
          
          try {
            // Convert canvas to blob and download
            canvas.toBlob((blob) => {
              if (blob) {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'face-swap-result.png';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
              }
            }, 'image/png');
          } catch (err) {
            reject(err);
          }
          resolve(null);
        };
        
        img.onerror = () => {
          // If CORS fails, try direct download as a fallback
          const a = document.createElement('a');
          a.href = swapResult;
          a.download = 'face-swap-result.png';
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          resolve(null);
        };
        
        // Set image source after setting up handlers
        img.src = swapResult;
      });
      
    } catch (error) {
      console.error('Error downloading image:', error);
      // If all else fails, open in new tab
      window.open(swapResult, '_blank');
    }
  };

  // Add effect to update URLs when tab changes
  useEffect(() => {
    if (activeTab === 'video') {
      setTargetImage("https://i.ibb.co/GxHH1J6/source1.png");
      setSourceImage("https://i.ibb.co/dpFW7fR/bb.png");
    } else {
      setTargetImage("https://d21ksh0k4smeql.cloudfront.net/crop_1694593694387-4562-0-1694593694575-0526.png");
      setSourceImage("https://d21ksh0k4smeql.cloudfront.net/crop_1705462509874-9254-0-1705462510015-9261.png");
    }
  }, [activeTab]);

  // Add video download handler
  const handleVideoDownload = async () => {
    if (!videoResult) return;
    
    try {
      const response = await fetch(videoResult);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'face-swap-result.mp4';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading video:', error);
      window.open(videoResult, '_blank');
    }
  };

  const handleReage = async () => {
    if (!targetImage) return;

    setIsLoading(true);
    setSwapStatus('Starting reage process...');

    try {
      // Make the API call to detect face
      const response = await axios.post('https://sg3.akool.com/detect', {
        single_face: isSingleFace,
        image_url: targetImage
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Extract landmarks_str from the response and store it in state
      const landmarksStr = response.data.landmarks_str;
      setLandmarksStr(landmarksStr);

      // New API call using landmarksStr
      const apiCallData = {
        targetImage: [{
          path: targetImage,
          opts: landmarksStr
        }],
        face_reage: reageValue,
        modifyImage: targetImage,
        webhookUrl: "https://4637-219-91-134-123.ngrok-free.app/api/webhook"
      };

      // Make the API call to the new endpoint
      const apiResponse = await axios.post('https://openapi.akool.com/api/open/v3/faceswap/highquality/imgreage', apiCallData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      setSwapStatus('Reage process completed successfully');
    } catch (error) {
      console.error('Error during reage process:', error);
      setSwapStatus('Failed to apply reage effect');
    }finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      {!isSubmitted ? (
        <div className="welcome-container">
          <div className={`welcome-content ${isSubmitted ? 'fade-out' : 'fade-in'}`}>
            <div className="title-container">
              <img src="/images/4p6vr8j7vbom4axo7k0 2.png" alt="Face Swap AI Logo" className="logo" />
              <h1 className="title">Reage AI</h1>
            </div>
            
            <div className="auth-method-toggle">
              <button 
                className={`auth-toggle-btn ${authMethod === 'token' ? 'active' : ''}`}
                onClick={() => setAuthMethod('token')}
              >
                Use Bearer Token
              </button>
              <button 
                className={`auth-toggle-btn ${authMethod === 'credentials' ? 'active' : ''}`}
                onClick={() => setAuthMethod('credentials')}
              >
                Use Client Credentials
              </button>
            </div>

            <form onSubmit={handleSubmit} className="token-form">
              {authMethod === 'token' ? (
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Enter your API token"
                  className="token-input"
                  required
                />
              ) : (
                <>
                  <input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="Enter your Client ID"
                    className="token-input"
                    required
                  />
                  <input
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="Enter your Client Secret"
                    className="token-input"
                    required
                  />
                </>
              )}
              <button type="submit" className="submit-button">
                Get Started
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="main-container">
          <div className="main-header">
            <img src="/images/4p6vr8j7vbom4axo7k0 2.png" alt="Reage AI Logo" className="logo" />
            <h1 className="title">Reage AI</h1>
          </div>
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'image' ? 'active' : ''}`}
              onClick={() => setActiveTab('image')}
            >
              Image Reage
            </button>
            <button
              className={`tab ${activeTab === 'video' ? 'active' : ''}`}
              onClick={() => setActiveTab('video')}
            >
              Video Reage
            </button>
          </div>
          <div className="content">
            {activeTab === 'image' ? (
              <div className="image-reage-form">
                <div className="image-input-group">
                  <h3>Image URL</h3>
                  <input
                    type="url"
                    placeholder="Enter image URL"
                    value={targetImage}
                    onChange={(e) => setTargetImage(e.target.value)}
                    className="url-input"
                  />
                </div>
                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    id="singleFaceCheckbox"
                    checked={isSingleFace}
                    onChange={(e) => setIsSingleFace(e.target.checked)}
                  />
                  <label htmlFor="singleFaceCheckbox">Single Face</label>
                </div>
                <div className="slider-container">
                  <h3>Reage Effect</h3>
                  <input
                    type="range"
                    min="-30"
                    max="30"
                    value={reageValue}
                    onChange={(e) => setReageValue(Number(e.target.value))}
                    className="reage-slider"
                  />
                  <p>Value: {reageValue}</p>
                </div>
                <button 
                  className="reage-button"
                  onClick={handleReage}
                  disabled={!targetImage || isLoading}
                >
                  Apply Reage
                </button>
              </div>
            ) : (
              <div className="video-reage-form">
                <div className="video-input-group">
                  <h3>Video URL</h3>
                  <input
                    type="url"
                    placeholder="Enter video URL"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    className="url-input"
                  />
                </div>
                <div className="image-input-group">
                  <h3>Image URL</h3>
                  <input
                    type="url"
                    placeholder="Enter image URL"
                    value={targetImage}
                    onChange={(e) => setTargetImage(e.target.value)}
                    className="url-input"
                  />
                </div>
                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    id="singleFaceCheckbox"
                    checked={isSingleFace}
                    onChange={(e) => setIsSingleFace(e.target.checked)}
                  />
                  <label htmlFor="singleFaceCheckbox">Single Face</label>
                </div>
                <div className="slider-container">
                  <h3>Reage Effect</h3>
                  <input
                    type="range"
                    min="-30"
                    max="30"
                    value={videoReageValue}
                    onChange={(e) => setVideoReageValue(Number(e.target.value))}
                    className="reage-slider"
                  />
                  <p>Value: {videoReageValue}</p>
                </div>
                <button 
                  className="reage-button"
                  onClick={handleVideoReage}
                  disabled={!videoUrl || isLoading}
                >
                  Apply Reage
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="loader-overlay">
          <div className="loader"></div>
          <p>Processing...</p>
        </div>
      )}

      {showVideoResultPopup && videoResult && (
        <div className="result-popup-overlay">
          <div className="result-popup">
            <h2>Video Result</h2>
            <div className="result-video-container">
              <video controls src={videoResult}>
                Your browser does not support the video tag.
              </video>
            </div>
            <div className="result-actions">
              <button className="download-button" onClick={handleVideoDownload}>
                Download
              </button>
              <button className="close-popup-button" onClick={() => setShowVideoResultPopup(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showImageResultPopup && swapResult && (
        <div className="result-popup-overlay">
          <div className="result-popup">
            <h2>Result</h2>
            <div className="result-image-container">
              <img src={swapResult} alt="Face Swap Result" />
            </div>
            <div className="result-actions">
              <button className="download-button" onClick={handleDownload}>
                Download
              </button>
              <button className="close-popup-button" onClick={() => setShowImageResultPopup(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
