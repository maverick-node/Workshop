import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiGet, apiPost, getSession } from "@/lib/api";
import { QrCode, Camera, CheckCircle, XCircle, User, Calendar, Mail, BookOpen, Copy } from "lucide-react";
import QrReader from "react-qr-scanner";
import { type Workshop } from "@/lib/api";

interface UserQRScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const UserQRScanner = ({ open, onOpenChange }: UserQRScannerProps) => {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [selectedWorkshop, setSelectedWorkshop] = useState<Workshop | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string>("");
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInResult, setCheckInResult] = useState<any>(null);
  const [user] = useState(() => getSession());

  useEffect(() => {
    if (open) {
      loadWorkshops();
    }
  }, [open]);

  const loadWorkshops = async () => {
    try {
      const workshops = await apiGet<Workshop[]>("/workshops");
      // Filter workshops that have reservations for current user
      if (user) {
        const reservations = await apiGet<Array<{ workshopId: string }>>(`/reservations?userId=${user.id}`);
        const reservedWorkshopIds = reservations.map(r => r.workshopId);
        setWorkshops(workshops.filter(w => reservedWorkshopIds.includes(w.id)));
      }
    } catch (error) {
      console.error("Failed to load workshops:", error);
    }
  };

  const startScanning = () => {
    setScanning(true);
    setCheckInResult(null);
    setCameraError("");
  };

  const stopScanning = () => {
    setScanning(false);
  };

  const handleQRResult = async (qrData: string) => {
    
    try {
      const parsed = JSON.parse(qrData);
      const { token } = parsed;
      
      if (!token) {
        throw new Error("Invalid QR code format");
      }
      
      setCheckingIn(true);
      
      const response = await apiPost<{ 
        success: boolean; 
        user: { id: string; name: string; email: string }; 
        workshopId: string; 
        checkedInAt: string 
      }>("/qr/validate-workshop", { 
        token,
        workshopId: selectedWorkshop!.id,
        userId: user!.id
      });
      
      setCheckInResult(response);
      
      // Reset after 3 seconds
      setTimeout(() => {
        setCheckInResult(null);
      }, 3000);
      
    } catch (error: any) {
      console.error("QR validation error:", error);
      setCheckInResult({ 
        error: error?.message || "Invalid QR code" 
      });
      
      setTimeout(() => {
        setCheckInResult(null);
      }, 3000);
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCopyLink = async () => {
    if (!selectedWorkshop) return;
    
    try {
      // Generate QR code link for sharing
      const qrResponse = await apiPost<{ token: string; expiresAt: number }>("/qr/generate-workshop", {
        workshopId: selectedWorkshop.id
      });
      
      const qrData = JSON.stringify({
        token: qrResponse.token,
        workshopId: selectedWorkshop.id,
        timestamp: Date.now()
      });
      
      await navigator.clipboard.writeText(qrData);
      
    } catch (error) {
      console.error("Failed to copy QR link:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Workshop Check-in Scanner
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Workshop Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select your workshop:</label>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {workshops.map((workshop) => (
                <div
                  key={workshop.id}
                  className={`p-2 border rounded-lg cursor-pointer transition-colors ${
                    selectedWorkshop?.id === workshop.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => {
                    setSelectedWorkshop(workshop);
                    stopScanning();
                  }}
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    <span className="text-sm font-medium">{workshop.title}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {workshop.date} • {workshop.location}
                  </div>
                </div>
              ))}
              {workshops.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-4">
                  No registered workshops found
                </div>
              )}
            </div>
          </div>

          {selectedWorkshop && (
            <>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {selectedWorkshop.title}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyLink}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Share
                </Button>
              </div>

              {/* Camera Feed / QR Reader */}
              <div className="relative bg-black rounded-lg overflow-hidden">
                {scanning ? (
                  <div className="w-full h-64">
                    <QrReader
                      delay={300}
                      className="w-full h-full object-cover"
                      constraints={{ video: { facingMode: "environment" } } as any}
                      onError={(err: any) => {
                        console.error("QR Reader error:", err);
                        setCameraError(String(err?.message || err));
                        setScanning(false);
                      }}
                      onScan={(data: any) => {
                        const value = typeof data === "string" ? data : (data?.text || data?.rawValue || null);
                        if (value && !checkingIn) {
                          handleQRResult(value);
                        }
                      }}
                      style={{ width: "100%", height: "100%" } as any}
                    />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
                    <div className="text-center">
                      <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Ready to scan</p>
                      {cameraError && (
                        <p className="mt-2 text-xs opacity-80 px-4">{cameraError}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Controls */}
              <div className="flex gap-2">
                {!scanning ? (
                  <Button onClick={startScanning} className="flex-1" disabled={cameraError !== ""}>
                    <Camera className="h-4 w-4 mr-2" />
                    Start Scanning
                  </Button>
                ) : (
                  <Button onClick={stopScanning} variant="outline" className="flex-1">
                    Stop Scanning
                  </Button>
                )}
                <Button onClick={() => setSelectedWorkshop(null)} variant="ghost">
                  Change Workshop
                </Button>
              </div>
            </>
          )}
          
          {/* Manual QR Input */}
          {selectedWorkshop && (
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
          )}
          
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
                          {checkInResult.user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
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

          {!user && (
            <div className="text-center text-sm text-muted-foreground py-4">
              Please log in to scan QR codes
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserQRScanner;
