import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiPost, getSession } from "@/lib/api";
import { QrCode, Clock, User } from "lucide-react";

interface UserQRCodeProps {
  workshopId: string;
  className?: string;
}

const UserQRCode = ({ workshopId, className = "" }: UserQRCodeProps) => {
  const [qrData, setQrData] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      setError("Please log in to generate QR code");
      return;
    }
    setUser(session);
  }, []);

  const generateQR = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    console.log("Generating QR for user:", user.id, "workshop:", workshopId);
    
    try {
      const response = await apiPost<{ token: string; expiresAt: number }>("/qr/generate", {
        userId: user.id,
        workshopId
      });
      
      const qrString = JSON.stringify({
        token: response.token,
        workshopId,
        userId: user.id,
        timestamp: Date.now()
      });
      
      const qrCodeDataURL = await QRCode.toDataURL(qrString, {
        width: 200,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF"
        }
      });
      
      setQrData(qrCodeDataURL);
      setExpiresAt(response.expiresAt);
    } catch (err: any) {
      console.error("QR generation error:", err);
      if (err?.message?.includes("No reservation found")) {
        setError("You need to book this workshop first before generating a QR code");
      } else {
        setError(err?.message || "Failed to generate QR code");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      generateQR();
    }
  }, [user, workshopId]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!expiresAt) return;
    
    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, expiresAt - now);
      setTimeLeft(remaining);
      
      if (remaining <= 1000) {
        // Refresh QR code when it's about to expire
        generateQR();
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [expiresAt, user, workshopId]);

  const formatTime = (ms: number) => {
    const seconds = Math.ceil(ms / 1000);
    return `${seconds}s`;
  };

  if (!user) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Please log in to generate QR code</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          Check-in QR Code
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="text-destructive text-sm text-center space-y-2">
            <p>{error}</p>
            {error.includes("No reservation found") && (
              <p className="text-xs text-muted-foreground">
                Make sure you have booked this workshop first.
              </p>
            )}
          </div>
        )}
        
        {loading && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground mt-2">Generating QR code...</p>
          </div>
        )}
        
        {qrData && !loading && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <img src={qrData} alt="QR Code" className="border rounded-lg" />
            </div>
            
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <User className="h-4 w-4" />
                <span className="text-sm font-medium">{user.name}</span>
              </div>
              
              <div className="flex items-center justify-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="text-sm text-muted-foreground">
                  Expires in {formatTime(timeLeft)}
                </span>
              </div>
              
              <Badge 
                variant={timeLeft > 5000 ? "default" : timeLeft > 2000 ? "secondary" : "destructive"}
                className="text-xs"
              >
                {timeLeft > 5000 ? "Valid" : timeLeft > 2000 ? "Expiring Soon" : "Expired"}
              </Badge>
            </div>
            
            <div className="text-center">
              <button
                onClick={generateQR}
                className="text-sm text-primary hover:underline"
                disabled={loading}
              >
                Refresh QR Code
              </button>
            </div>
          </div>
        )}
        
        {!qrData && !loading && !error && (
          <div className="text-center">
            <button
              onClick={generateQR}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Generate QR Code
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UserQRCode;
