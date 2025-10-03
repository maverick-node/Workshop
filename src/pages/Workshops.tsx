import { useEffect, useMemo, useState } from "react";
import Header from "@/components/layout/Header";
import WorkshopCard from "@/components/workshop/WorkshopCard";
import WorkshopFilters from "@/components/workshop/WorkshopFilters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, Calendar, Award } from "lucide-react";
import { apiGet, getSession, type Workshop } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader as DialogHdr, DialogTitle as DialogTtl } from "@/components/ui/dialog";
import UserQRCode from "@/components/qr/UserQRCode";

const Workshops = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    category: "",
    trainer: "",
    date: "",
    location: "",
  });

  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userReservations, setUserReservations] = useState<Record<string, boolean>>({});
  const [myBookingsOpen, setMyBookingsOpen] = useState(false);
  const [qrCodeOpen, setQrCodeOpen] = useState(false);
  const [selectedWorkshopForQR, setSelectedWorkshopForQR] = useState<Workshop | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await apiGet<Workshop[]>("/workshops");
        if (active) setWorkshops(data);
        const user = getSession();
        if (user) {
          const res = await apiGet<Array<{ id: string; workshopId: string }>>(`/reservations?userId=${user.id}`);
          if (active) {
            const map: Record<string, boolean> = {};
            res.forEach(r => { map[r.workshopId] = true; });
            setUserReservations(map);
          }
        } else if (active) {
          setUserReservations({});
        }
      } catch (e) {
        if (active) setError("Failed to load workshops");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleFilter = (filterType: string, value: string) => {
    setFilters(prev => ({ ...prev, [filterType]: value }));
  };

  const clearFilters = () => {
    setSearchQuery("");
    setFilters({
      category: "",
      trainer: "",
      date: "",
      location: "",
    });
  };

  // Filter workshops based on search and filters
  const filteredWorkshops = useMemo(() => workshops.filter(workshop => {
    const matchesSearch = workshop.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         workshop.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = !filters.category || workshop.category === filters.category;
    const matchesTrainer = !filters.trainer || workshop.trainer === filters.trainer;
    const matchesLocation = !filters.location || workshop.location === filters.location;
    
    return matchesSearch && matchesCategory && matchesTrainer && matchesLocation;
  }), [workshops, searchQuery, filters]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/10 to-accent/20 py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
              Professional Skills
              <span className="text-primary block">Development</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Transform your career with expert-led workshops designed to build essential soft skills and leadership capabilities.
            </p>
            
            {/* Quick Stats */}
            <div className="flex flex-wrap justify-center gap-6 mt-12">
              <div className="flex items-center space-x-2 bg-background/80 backdrop-blur-sm rounded-lg px-4 py-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">95% Success Rate</span>
              </div>
              <div className="flex items-center space-x-2 bg-background/80 backdrop-blur-sm rounded-lg px-4 py-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">150+ Participants</span>
              </div>
              <div className="flex items-center space-x-2 bg-background/80 backdrop-blur-sm rounded-lg px-4 py-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">30+ Workshops</span>
              </div>
              <div className="flex items-center space-x-2 bg-background/80 backdrop-blur-sm rounded-lg px-4 py-2">
                <Award className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Certified Training</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Workshops Section */}
      <section className="py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-4">Available Workshops</h2>
            <div className="flex items-center space-x-4">
              <Badge variant="secondary" className="text-sm">
                {filteredWorkshops.length} workshops found
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const user = getSession();
                  if (!user) { window.location.href = "/login"; return; }
                  setMyBookingsOpen(true);
                }}
              >
                My bookings
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const user = getSession();
                  if (!user) { window.location.href = "/login"; return; }
                  setQrCodeOpen(true);
                }}
              >
                My QR Code
              </Button>
              {(searchQuery || Object.values(filters).some(f => f)) && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear all filters
                </Button>
              )}
            </div>
          </div>

          <WorkshopFilters
            onSearch={handleSearch}
            onFilterCategory={(category) => handleFilter("category", category)}
            onFilterTrainer={(trainer) => handleFilter("trainer", trainer)}
            onFilterDate={(date) => handleFilter("date", date)}
            onFilterLocation={(location) => handleFilter("location", location)}
            onClearFilters={clearFilters}
          />

          {loading && <div className="text-muted-foreground">Loading workshops...</div>}
          {error && <div className="text-destructive">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWorkshops.map((workshop) => (
              <WorkshopCard key={workshop.id} {...workshop} reserved={!!userReservations[workshop.id]} onChanged={async () => {
                const user = getSession();
                if (user) {
                  const res = await apiGet<Array<{ id: string; workshopId: string }>>(`/reservations?userId=${user.id}`);
                  const map: Record<string, boolean> = {};
                  res.forEach(r => { map[r.workshopId] = true; });
                  setUserReservations(map);
                }
              }} />
            ))}
          </div>

          {filteredWorkshops.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">No workshops found matching your criteria.</p>
              <Button variant="outline" className="mt-4" onClick={clearFilters}>
                View all workshops
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* My Bookings Dialog */}
      <Dialog open={myBookingsOpen} onOpenChange={setMyBookingsOpen}>
        <DialogContent>
          <DialogHdr>
            <DialogTtl>My Booked Workshops</DialogTtl>
          </DialogHdr>
          <div className="space-y-3 max-h-[60vh] overflow-auto">
            {workshops.filter(w => userReservations[w.id]).length > 0 ? (
              workshops.filter(w => userReservations[w.id]).map(w => (
                <div key={w.id} className="border-b border-border pb-2 last:border-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-card-foreground">{w.title}</p>
                      <p className="text-sm text-muted-foreground">{w.date} • {w.trainer} • {w.location}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedWorkshopForQR(w);
                        setQrCodeOpen(true);
                      }}
                    >
                      Get QR Code
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">You have not booked any workshops yet.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={qrCodeOpen} onOpenChange={setQrCodeOpen}>
        <DialogContent>
          <DialogHdr>
            <DialogTtl>My QR Code</DialogTtl>
          </DialogHdr>
          <div className="space-y-4">
            {!selectedWorkshopForQR ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Select a workshop to generate QR code:</p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {workshops.filter(w => userReservations[w.id]).map(w => (
                    <div
                      key={w.id}
                      className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedWorkshopForQR(w)}
                    >
                      <div className="font-medium">{w.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {w.date} • {w.trainer} • {w.location}
                      </div>
                      <div className="text-xs text-green-600 mt-1">✓ Booked</div>
                    </div>
                  ))}
                </div>
                {workshops.filter(w => userReservations[w.id]).length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">You have not booked any workshops yet.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-lg">{selectedWorkshopForQR.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedWorkshopForQR.date} • {selectedWorkshopForQR.trainer}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedWorkshopForQR(null)}
                  >
                    Change Workshop
                  </Button>
                </div>
                <UserQRCode workshopId={selectedWorkshopForQR.id} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Workshops;