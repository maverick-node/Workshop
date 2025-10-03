import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import QRCode from "qrcode";
import { apiPost } from "@/lib/api";
import { QrCode, RefreshCw, Copy, Download, Users } from "lucide-react";
import { type Workshop } from "@/lib/api";

interface AdminQRDisplayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workshop: Workshop | null;
}

const AdminQRDisplay = ({ open, onOpenChange, workshop }: AdminQRDisplayProps) => {
  const [qrData, setQrData] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attendanceCount, setAttendanceCount] = useState<number>(0);
  const [lastScannedBy, setLastScannedBy] = useState<string>("");
  const [showScanNotification, setShowScanNotification] = useState(false);

  useEffect(() => {
    if (open && workshop) {
      generateQR();
    }
  }, [open, workshop]);

  // Listen for QR used events via SSE
  useEffect(() => {
    if (!open || !workshop) return;

    const eventSource = new EventSource(`${import.meta.env.VITE_API_BASE || '/api'}/events`);
    
    eventSource.addEventListener("qr_used", (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.workshopId === workshop.id) {
          console.log(`QR scanned by ${data.userName}, generating new QR...`);
          setLastScannedBy(data.userName);
          setShowScanNotification(true);
          // Hide notification after 3 seconds
          setTimeout(() => setShowScanNotification(false), 3000);
          generateQR();
        }
      } catch (error) {
        console.error("Error parsing QR used event:", error);
      }
    });

    return () => {
      eventSource.close();
    };
  }, [open, workshop]);

  const generateQR = async () => {
    if (!workshop || generating) return;
    
    setGenerating(true);
    setError(null);
    
    try {
      const response = await apiPost<{ 
        token: string; 
        attendanceCount?: number;
      }>("/qr/generate-workshop", {
        workshopId: workshop.id
      });
      
      const qrString = JSON.stringify({
        token: response.token,
        workshopId: workshop.id,
        workshopTitle: workshop.title,
        timestamp: Date.now()
      });

      const qrCodeDataURL = await QRCode.toDataURL(qrString, {
        width: 256,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF"
        },
        errorCorrectionLevel: 'M'
      });
      
      setQrData(qrCodeDataURL);
      setAttendanceCount(response.attendanceCount || 0);
    } catch (err: any) {
      console.error("Workshop QR generation error:", err);
      setError(err?.message || "Failed to generate QR code");
    } finally {
      setGenerating(false);
    }
  };


  const handleCopyQR = async () => {
    if (!workshop) return;
    
    try {
      const qrResponse = await apiPost<{ token: string; attendanceCount?: number }>("/qr/generate-workshop", {
        workshopId: workshop.id
      });
      
      const qrData = JSON.stringify({
        token: qrResponse.token,
        workshopId: workshop.id,
        workshopTitle: workshop.title,
        timestamp: Date.now()
      });
      
      await navigator.clipboard.writeText(qrData);
      
    } catch (error) {
      console.error("Failed to copy QR data:", error);
    }
  };

  const handleDownloadQR = () => {
    if (!qrData) return;
    
    const link = document.createElement('a');
    link.href = qrData;
    link.download = `workshop-${workshop?.title?.replace(/[^a-z0-9]/gi, '_')}-qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isLoading = !workshop || generating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Workshop QR Code
            {workshop && (
              <Badge variant="outline" className="ml-2">
                {workshop.title}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {workshop && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{workshop.title}</CardTitle>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{workshop.date}</span>
                  <span>{workshop.location}</span>
                  <span>{workshop.trainer}</span>
                </div>
              </CardHeader>
            </Card>
          )}

          {/* QR Code Display */}
          <Card className="flex-shrink-0">
            <CardContent className="p-6">
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Generating QR code...</p>
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-destructive mb-4">{error}</p>
                  <Button onClick={generateQR} variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                </div>
              ) : qrData ? (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <img 
                      src={qrData} 
                      alt="Workshop QR Code" 
                      className="border rounded-lg"
                    />
                  </div>

                  {/* Scan Notification */}
                  {showScanNotification && (
                    <div className="text-center">
                      <Badge variant="secondary" className="mb-2">
                        Check-in successful!
                      </Badge>
                      <p className="text-sm text-green-600">
                        QR scanned by {lastScannedBy}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Generating new QR code...
                      </p>
                    </div>
                  )}

                  {/* Attendance Stats */}
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{attendanceCount} attendees verified</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 justify-center">
                    <Button
                      onClick={generateQR}
                      disabled={generating}
                      variant="outline"
                      size="sm"
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 ${generating ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                    <Button
                      onClick={handleCopyQR}
                      variant="outline"
                      size="sm"
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy Data
                    </Button>
                    <Button
                      onClick={handleDownloadQR}
                      variant="outline"
                      size="sm"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Instructions for Attendees:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Select the workshop you're attending</li>
              <li>• Use your phone's camera to scan this QR code</li>
              <li>• Or use the manual entry option in the app</li>
              <li>• Each QR code is single-use and regenerates automatically after scanning</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminQRDisplay;
