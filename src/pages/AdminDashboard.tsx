import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StatsCard from "@/components/stats/StatsCard";
import { 
  Users, 
  Calendar, 
  TrendingUp, 
  UserCheck, 
  Plus, 
  FileText, 
  Download,
  BarChart3,
  Settings,
  Bell,
  CheckCircle
} from "lucide-react";
import { apiGet, apiPost, apiPut, type Workshop, getSession } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader as DialogHdr, DialogTitle as DialogTtl } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import AdminQRDisplay from "@/components/qr/AdminQRDisplay";

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [reservations, setReservations] = useState<Array<{ id: string; userId: string; workshopId: string; createdAt: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attendeesOpen, setAttendeesOpen] = useState(false);
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string | null>(null);
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState<Workshop | null>(null);
  const [qrDisplayOpen, setQrDisplayOpen] = useState(false);
  const [selectedWorkshopForDisplay, setSelectedWorkshopForDisplay] = useState<Workshop | null>(null);
  const [attendance, setAttendance] = useState<Array<{ id: string; userId: string; workshopId: string; checkedInAt: string }>>([]);

  function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
    const escapeCell = (value: unknown) => {
      if (value == null) return "";
      const str = String(value);
      if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
      return str;
    };
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => escapeCell((r as any)[h])).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const handleExportParticipants = () => {
    const rows = users.map(u => ({
      userId: u.id,
      name: u.name,
      email: u.email,
      workshopCount: (userIdToWorkshops[u.id]?.length || 0)
    }));
    // Excel-compatible
    downloadCsv("participants.xls", rows);
  };

  const handleExportReports = () => {
    const rows = reservations.map(r => {
      const user = users.find(u => u.id === r.userId);
      const workshop = workshops.find(w => w.id === r.workshopId);
      return {
        reservationId: r.id,
        userName: user?.name || "",
        userEmail: user?.email || "",
        workshopTitle: workshop?.title || "",
        workshopDate: workshop?.date || "",
        trainer: workshop?.trainer || "",
        createdAt: r.createdAt
      };
    });
    // Excel-compatible
    downloadCsv("registrations_report.xls", rows);
  };

  const stats = useMemo(() => [
    {
      title: "Total Participants",
      value: String(users.length),
      description: "Registered users",
      icon: Users,
      trend: { value: 0, isPositive: true }
    },
    {
      title: "Workshops",
      value: String(workshops.length),
      description: "Total workshops",
      icon: Calendar,
      trend: { value: 0, isPositive: true }
    },
    {
      title: "Reservations",
      value: String(reservations.length),
      description: "Total bookings",
      icon: UserCheck,
      trend: { value: 0, isPositive: true }
    },
    {
      title: "Capacity Used",
      value: `${Math.round((workshops.reduce((acc, w) => acc + (w.totalSeats - w.availableSeats), 0) / Math.max(1, workshops.reduce((acc, w) => acc + w.totalSeats, 0))) * 100)}%`,
      description: "Across all workshops",
      icon: TrendingUp,
      trend: { value: 0, isPositive: true }
    }
  ], [users.length, workshops, reservations.length]);

  useEffect(() => {
    const session = getSession();
    if (!session || session.role !== "admin") {
      window.location.href = "/login";
      return;
    }
    let active = true;
    (async () => {
      try {
        const data = await apiGet<{ users: typeof users; workshops: Workshop[]; reservations: typeof reservations; attendance: typeof attendance }>("/admin/overview");
        if (!active) return;
        const prevReservationCount = reservations.length;
        setUsers(data.users);
        setWorkshops(data.workshops);
        setReservations(data.reservations);
        setAttendance(data.attendance || []);
        if (prevReservationCount && data.reservations.length > prevReservationCount) {
          toast({ title: "New booking", description: "A new reservation has been made." });
        }
      } catch (e) {
        if (active) setError("Failed to load admin data");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Realtime notifications via SSE
  useEffect(() => {
    const es = new EventSource(`${import.meta.env.VITE_API_BASE || '/api'}/events`);
    es.addEventListener("reservation", () => {
      toast({ title: "New booking", description: "A new reservation has been made." });
      // Refresh admin data
      (async () => {
        try {
          const data = await apiGet<{ users: typeof users; workshops: Workshop[]; reservations: typeof reservations; attendance: typeof attendance }>("/admin/overview");
          setUsers(data.users);
          setWorkshops(data.workshops);
          setReservations(data.reservations);
          setAttendance(data.attendance || []);
        } catch {}
      })();
    });
    es.addEventListener("attendance", (evt: MessageEvent) => {
      try {
        const data = JSON.parse(evt.data || "{}");
        toast({ title: "Check-in successful", description: `${data.userName} checked in!` });
        // Refresh admin data
        (async () => {
          try {
            const data = await apiGet<{ users: typeof users; workshops: Workshop[]; reservations: typeof reservations; attendance: typeof attendance }>("/admin/overview");
            setUsers(data.users);
            setWorkshops(data.workshops);
            setReservations(data.reservations);
            setAttendance(data.attendance || []);
          } catch {}
        })();
      } catch {}
    });
    return () => { es.close(); };
  }, [toast]);

  const workshopIdToRegistrations = useMemo(() => {
    const map: Record<string, Array<{ id: string; name: string; email: string; verified: boolean }>> = {};
    reservations.forEach(r => {
      const u = users.find(u => u.id === r.userId);
      if (!u) return;
      if (!map[r.workshopId]) map[r.workshopId] = [];
      const isVerified = attendance.some(a => a.userId === r.userId && a.workshopId === r.workshopId);
      map[r.workshopId].push({ id: u.id, name: u.name, email: u.email, verified: isVerified });
    });
    return map;
  }, [reservations, users, attendance]);

  const userIdToWorkshops = useMemo(() => {
    const map: Record<string, Array<{ workshop: Workshop; verified: boolean }>> = {};
    reservations.forEach(r => {
      const w = workshops.find(w => w.id === r.workshopId);
      if (!w) return;
      if (!map[r.userId]) map[r.userId] = [];
      const isVerified = attendance.some(a => a.userId === r.userId && a.workshopId === r.workshopId);
      map[r.userId].push({ workshop: w, verified: isVerified });
    });
    return map;
  }, [reservations, workshops, attendance]);

  const recentWorkshops = [
    {
      id: "1",
      title: "Advanced Leadership Skills",
      date: "Dec 15, 2024",
      participants: "15/15",
      status: "Full",
      trainer: "Sarah Johnson"
    },
    {
      id: "2",
      title: "Effective Communication",
      date: "Dec 18, 2024",
      participants: "10/12",
      status: "Available",
      trainer: "Michael Chen"
    },
    {
      id: "3",
      title: "Project Management",
      date: "Dec 20, 2024",
      participants: "20/20",
      status: "Full",
      trainer: "Emily Rodriguez"
    },
    {
      id: "4",
      title: "Team Building",
      date: "Dec 22, 2024",
      participants: "4/16",
      status: "Available",
      trainer: "David Thompson"
    }
  ];

  const recentParticipants = [
    {
      id: "1",
      name: "John Smith",
      email: "john@example.com",
      workshop: "Leadership Skills",
      registeredAt: "2 hours ago"
    },
    {
      id: "2",
      name: "Sarah Davis",
      email: "sarah@example.com",
      workshop: "Communication",
      registeredAt: "4 hours ago"
    },
    {
      id: "3",
      name: "Mike Johnson",
      email: "mike@example.com",
      workshop: "Team Building",
      registeredAt: "6 hours ago"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background border-b border-border">
        <div className="flex h-16 items-center px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          </div>
          <div className="ml-auto flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => { window.location.href = "/"; }}>Back to Home</Button>
            <Button variant="outline" size="sm" onClick={() => { window.location.href = "/notifications"; }}>
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </Button>
            <Button variant="outline" size="sm" onClick={() => { window.location.href = "/settings"; }}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            <Button variant="outline" size="sm" onClick={() => { localStorage.removeItem("session_user"); window.location.href = "/"; }}>Logout</Button>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-4 p-4 sm:p-6 lg:p-8">
        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <StatsCard key={index} {...stat} />
          ))}
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="workshops">Workshops</TabsTrigger>
            <TabsTrigger value="participants">Participants</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              {/* Recent Workshops */}
              <Card className="col-span-4">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Recent Workshops</CardTitle>
                  <Button size="sm" onClick={() => {
                    setEditData({
                      id: "new",
                      title: "",
                      description: "",
                      trainer: "",
                      date: "",
                      time: "",
                      duration: "",
                      location: "",
                      availableSeats: 0,
                      totalSeats: 1,
                      category: "",
                    } as any);
                    setEditOpen(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Workshop
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {workshops.map((w) => (
                      <div key={w.id} className="border-b border-border pb-3 last:border-0">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-card-foreground">{w.title}</p>
                            <p className="text-sm text-muted-foreground">{w.date} • {w.trainer}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="text-sm font-medium">{(w.totalSeats - w.availableSeats)}/{w.totalSeats} booked</p>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedWorkshopId(w.id);
                                  setAttendeesOpen(true);
                                }}
                              >
                                View attendees
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedWorkshopForDisplay(w);
                                  setQrDisplayOpen(true);
                                }}
                              >
                                Display QR
                              </Button>
                            </div>
                          </div>
                        </div>
                        {/* Hide inline registrations list in overview per requirements */}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Hide recent registrations card per requirements */}
            </div>
          </TabsContent>

          <TabsContent value="workshops" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Workshop Management</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  className="grid gap-3 md:grid-cols-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const formData = new FormData(form);
                    const payload = {
                      title: String(formData.get("title") || ""),
                      description: String(formData.get("description") || ""),
                      trainer: String(formData.get("trainer") || ""),
                      date: String(formData.get("date") || ""),
                      time: String(formData.get("time") || ""),
                      duration: String(formData.get("duration") || ""),
                      location: String(formData.get("location") || ""),
                      totalSeats: Number(formData.get("totalSeats") || 0),
                      category: String(formData.get("category") || ""),
                    };
                    try {
                      // Validate date not in the past
                      const today = new Date();
                      const selected = new Date(`${payload.date}T00:00:00`);
                      if (isNaN(selected.getTime()) || selected < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
                        alert("Date cannot be in the past.");
                        return;
                      }
                      const created = await apiPost<Workshop>("/workshops", payload);
                      setWorkshops(prev => [created, ...prev]);
                      form.reset();
                    } catch {}
                  }}
                >
                  <input name="title" placeholder="Title" className="border rounded px-2 py-1" required />
                  <input name="trainer" placeholder="Trainer" className="border rounded px-2 py-1" required />
                  <input name="category" placeholder="Category" className="border rounded px-2 py-1" required />
                  <input name="date" type="date" className="border rounded px-2 py-1" required />
                  <input name="time" type="time" className="border rounded px-2 py-1" required />
                  <input name="duration" placeholder="Duration (e.g., 3 hours)" className="border rounded px-2 py-1" required />
                  <input name="location" placeholder="Location" className="border rounded px-2 py-1" required />
                  <input name="totalSeats" type="number" min="1" placeholder="Total Seats" className="border rounded px-2 py-1" required />
                  <input name="description" placeholder="Description" className="border rounded px-2 py-1 md:col-span-3" />
                  <div className="md:col-span-3">
                    <Button type="submit">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Workshop
                    </Button>
                  </div>
                </form>
                <div className="mt-6 space-y-2">
                  {workshops.map(w => (
                    <div key={w.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                      <div>
                        <p className="font-medium text-card-foreground">{w.title}</p>
                        <p className="text-sm text-muted-foreground">{w.date} • {w.trainer} • {w.category}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-sm text-muted-foreground">
                          {w.totalSeats - w.availableSeats}/{w.totalSeats} booked
                        </div>
                        <Button variant="outline" size="sm" onClick={() => { setEditData(w); setEditOpen(true); }}>Edit</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="participants" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Participant Management</CardTitle>
                <Button variant="outline" onClick={handleExportParticipants}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {users.map(u => (
                    <div key={u.id} className="border-b border-border pb-3 last:border-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-card-foreground">{u.name}</p>
                          <p className="text-sm text-muted-foreground">{u.email}</p>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {(userIdToWorkshops[u.id]?.length || 0)} registrations
                        </div>
                      </div>
                      {userIdToWorkshops[u.id] && (
                        <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground space-y-1">
                          {userIdToWorkshops[u.id].map(({ workshop, verified }) => (
                            <li key={workshop.id} className="flex items-center gap-2">
                              <span>{workshop.title} • {workshop.date} • {workshop.trainer}</span>
                              {verified && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <CheckCircle className="h-3 w-3 text-green-500" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Verified by QR check-in</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Analytics & Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground space-y-2">
                  {workshops.map(w => (
                    <div key={w.id} className="flex items-center justify-between">
                      <span className="text-card-foreground">{w.title}</span>
                      <span>{(w.totalSeats - w.availableSeats)}/{w.totalSeats} booked</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Reports & Exports
                </CardTitle>
                <Button variant="outline" onClick={handleExportReports}>
                  <Download className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground space-y-2">
                  {workshops.map(w => (
                    <div key={w.id} className="flex items-center justify-between">
                      <span className="text-card-foreground">{w.title}</span>
                      <span>{(w.totalSeats - w.availableSeats)}/{w.totalSeats} booked</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        {loading && <div className="text-muted-foreground">Loading admin data...</div>}
        {error && <div className="text-destructive">{error}</div>}
        <Dialog open={attendeesOpen} onOpenChange={setAttendeesOpen}>
          <DialogContent>
            <DialogHdr>
              <DialogTtl>Attendees</DialogTtl>
            </DialogHdr>
            <div className="max-h-[60vh] overflow-auto">
              {selectedWorkshopId && workshopIdToRegistrations[selectedWorkshopId] && workshopIdToRegistrations[selectedWorkshopId].length > 0 ? (
                <ul className="space-y-2">
                  {workshopIdToRegistrations[selectedWorkshopId].map(u => (
                    <li key={u.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-card-foreground">{u.name}</span>
                        {u.verified && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Verified by QR check-in</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      <span className="text-muted-foreground text-sm">{u.email}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">No attendees yet.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Workshop Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHdr>
              <DialogTtl>Edit Workshop</DialogTtl>
            </DialogHdr>
            {editData && (
              <form className="grid gap-3" onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const formData = new FormData(form);
                const payload = {
                  title: String(formData.get("title") || editData.title),
                  description: String(formData.get("description") || editData.description),
                  trainer: String(formData.get("trainer") || editData.trainer),
                  date: String(formData.get("date") || editData.date),
                  time: String(formData.get("time") || editData.time),
                  duration: String(formData.get("duration") || editData.duration),
                  location: String(formData.get("location") || editData.location),
                  totalSeats: Number(formData.get("totalSeats") || editData.totalSeats),
                  category: String(formData.get("category") || editData.category),
                };
                // prevent past dates
                const today = new Date();
                const selected = new Date(`${payload.date}T00:00:00`);
                if (isNaN(selected.getTime()) || selected < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
                  alert("Date cannot be in the past.");
                  return;
                }
                try {
                  if (editData.id === "new") {
                    const created = await apiPost<Workshop>("/workshops", payload);
                    setWorkshops(prev => [created, ...prev]);
                  } else {
                    const updated = await apiPut<Workshop>(`/workshops/${editData.id}`, payload);
                    setWorkshops(prev => prev.map(w => w.id === updated.id ? updated : w));
                  }
                  setEditOpen(false);
                } catch (e: any) {
                  toast({ title: "Update failed", description: String(e?.message || e), variant: "destructive" as any });
                }
              }}>
                <input name="title" defaultValue={editData.title} placeholder="Title" className="border rounded px-2 py-1" required />
                <input name="trainer" defaultValue={editData.trainer} placeholder="Trainer" className="border rounded px-2 py-1" required />
                <input name="category" defaultValue={editData.category} placeholder="Category" className="border rounded px-2 py-1" required />
                <input name="date" type="date" defaultValue={editData.date} className="border rounded px-2 py-1" required />
                <input name="time" type="time" defaultValue={editData.time} className="border rounded px-2 py-1" required />
                <input name="duration" defaultValue={editData.duration} placeholder="Duration" className="border rounded px-2 py-1" required />
                <input name="location" defaultValue={editData.location} placeholder="Location" className="border rounded px-2 py-1" required />
                <input name="totalSeats" type="number" min="1" defaultValue={editData.totalSeats} placeholder="Total Seats" className="border rounded px-2 py-1" required />
                <input name="description" defaultValue={editData.description} placeholder="Description" className="border rounded px-2 py-1" />
                <div>
                  <Button type="submit">{editData.id === "new" ? "Create Workshop" : "Save Changes"}</Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Admin QR Display Dialog */}
        <AdminQRDisplay
          open={qrDisplayOpen}
          onOpenChange={setQrDisplayOpen}
          workshop={selectedWorkshopForDisplay}
        />
      </div>
    </div>
  );
};

export default AdminDashboard;