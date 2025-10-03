import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiPost } from "@/lib/api";
import { QrCode, Camera, CheckCircle, XCircle, User, Calendar, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QRScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workshopId: string;
  workshopTitle?: string;
}

const QRScanner = ({ open, onOpenChange, workshopId, workshopTitle }: QRScannerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<string>("");
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInResult, setCheckInResult] = useState<any>(null);
  const [cameraError, setCameraError] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [open]);

  const startCamera = async () => {
    setCameraError("");
    try {
      if (!('mediaDevices' in navigator) || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        throw new Error("Camera APIs not supported in this browser");
      }
      if (!window.isSecureContext) {
        // getUserMedia requires HTTPS or localhost
        throw new Error("Camera requires HTTPS (or localhost). Open the app over HTTPS.");
      }

      // Try ideal back camera first
      const tryConstraints = async (constraints: MediaStreamConstraints) => {
        return await navigator.mediaDevices.getUserMedia(constraints);
      };

      let mediaStream: MediaStream | null = null;
      const constraintChain: MediaStreamConstraints[] = [
        { video: { facingMode: { ideal: "environment" } } as MediaTrackConstraints },
        { video: { facingMode: "environment" } as MediaTrackConstraints },
        { video: true }
      ];

      for (const c of constraintChain) {
        try {
          mediaStream = await tryConstraints(c);
          if (mediaStream) break;
        } catch {
          // try next constraint
        }
      }

      // If still no stream, try selecting a back camera via enumerateDevices
      if (!mediaStream) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        const backCam = videoInputs.find(d => /back|rear|environment/i.test(d.label));
        const chosen = backCam || videoInputs[0];
        if (!chosen) {
          throw new Error("No camera devices found");
        }
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: chosen.deviceId } } });
      }

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        try { await videoRef.current.play(); } catch {}
      }
    } catch (error: any) {
      console.error("Error accessing camera:", error);
      const message = String(error?.message || error || "Unable to access camera");
      setCameraError(message);
      toast({
        title: "Camera Error",
        description: message,
        variant: "destructive"
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    if (videoRef.current) {
      try {
        (videoRef.current as any).srcObject = null;
      } catch {}
    }
    setStream(null);
  };

  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    
    if (!context) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    
    // Simple QR code detection (in a real app, you'd use a proper QR library)
    // For now, we'll simulate scanning
    const qrData = prompt("Enter QR code data (for demo purposes):");
    if (qrData) {
      handleQRResult(qrData);
    }
  };

  const handleQRResult = async (qrData: string) => {
    try {
      const parsed = JSON.parse(qrData);
      const { token } = parsed;
      
      if (!token) {
        throw new Error("Invalid QR code format");
      }
      
      setLastResult(qrData);
      setCheckingIn(true);
      
      const response = await apiPost<{ success: boolean; user: { id: string; name: string; email: string }; workshopId: string; checkedInAt: string }>("/qr/validate", { token });
      
      setCheckInResult(response);
      toast({
        title: "Check-in Successful",
        description: `${response.user.name} has been checked in!`,
      });
      
      // Reset after 3 seconds
      setTimeout(() => {
        setCheckInResult(null);
        setLastResult("");
      }, 3000);
      
    } catch (error: any) {
      console.error("QR validation error:", error);
      toast({
        title: "Check-in Failed",
        description: error?.message || "Invalid QR code",
        variant: "destructive"
      });
      setCheckInResult({ error: error?.message || "Invalid QR code" });
    } finally {
      setCheckingIn(false);
    }
  };

  const startScanning = () => {
    setScanning(true);
    setLastResult("");
    setCheckInResult(null);
    
    // Simulate continuous scanning
    const interval = setInterval(() => {
      if (scanning) {
        scanQRCode();
      } else {
        clearInterval(interval);
      }
    }, 1000);
  };

  const stopScanning = () => {
    setScanning(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QR Check-in Scanner
            {workshopTitle && (
              <Badge variant="outline" className="ml-2">
                {workshopTitle}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Camera Feed */}
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              className="w-full h-64 object-cover"
              playsInline
              muted
              autoPlay
            />
            <canvas
              ref={canvasRef}
              className="hidden"
            />
            
            {!stream && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
                <div className="text-center">
                  <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Camera not available</p>
                  {cameraError && (
                    <p className="mt-2 text-xs opacity-80 px-4">{cameraError}</p>
                  )}
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <Button size="sm" variant="outline" onClick={startCamera}>Retry</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Controls */}
          <div className="flex gap-2">
            {!scanning ? (
              <Button onClick={startScanning} className="flex-1">
                <Camera className="h-4 w-4 mr-2" />
                Start Scanning
              </Button>
            ) : (
              <Button onClick={stopScanning} variant="outline" className="flex-1">
                Stop Scanning
              </Button>
            )}
          </div>
          
          {/* Manual QR Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Or enter QR data manually:</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Paste QR code data here"
                className="flex-1 px-3 py-2 border rounded-md text-sm"
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    const value = (e.target as HTMLInputElement).value;
                    if (value) {
                      handleQRResult(value);
                      (e.target as HTMLInputElement).value = "";
                    }
                  }
                }}
              />
              <Button
                size="sm"
                onClick={() => {
                  const input = document.querySelector('input[placeholder="Paste QR code data here"]') as HTMLInputElement;
                  if (input?.value) {
                    handleQRResult(input.value);
                    input.value = "";
                  }
                }}
              >
                Check In
              </Button>
            </div>
          </div>
          
          {/* Status */}
          {checkingIn && (
            <div className="flex items-center justify-center gap-2 text-primary">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              <span className="text-sm">Checking in...</span>
            </div>
          )}
          
          {/* Result */}
          {checkInResult && (
            <div className={`p-4 rounded-lg border ${
              checkInResult.error 
                ? "border-destructive bg-destructive/10" 
                : "border-green-500 bg-green-50"
            }`}>
              {checkInResult.error ? (
                <div className="flex items-center gap-2 text-destructive">
                  <XCircle className="h-5 w-5" />
                  <div>
                    <p className="font-medium">Check-in Failed</p>
                    <p className="text-sm">{checkInResult.error}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 text-green-700">
                  <CheckCircle className="h-5 w-5 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium">Check-in Successful!</p>
                    <div className="flex items-center gap-3 mt-2">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={`https://ui-avatars.com/api/?name=${encodeURIComponent(checkInResult.user.name)}&background=random`} />
                        <AvatarFallback>
                          {checkInResult.user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span className="text-sm font-medium">{checkInResult.user.name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Mail className="h-4 w-4" />
                          <span className="text-sm text-muted-foreground">{checkInResult.user.email}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="h-4 w-4" />
                          <span className="text-sm text-muted-foreground">
                            {new Date(checkInResult.checkedInAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QRScanner;
