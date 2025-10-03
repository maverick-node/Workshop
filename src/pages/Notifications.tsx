import Header from "@/components/layout/Header";
import { useEffect, useMemo, useState } from "react";
import { apiGet, type Workshop } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Reservation = { id: string; userId: string; workshopId: string; createdAt: string };
type UserLite = { id: string; name: string; email: string };

const Notifications = () => {
  const [users, setUsers] = useState<UserLite[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await apiGet<{ users: UserLite[]; workshops: Workshop[]; reservations: Reservation[] }>("/admin/overview");
        if (!active) return;
        setUsers(data.users);
        setWorkshops(data.workshops);
        setReservations(data.reservations);
      } catch {
        if (active) setError("Failed to load notifications");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Live append via SSE
  useEffect(() => {
    const es = new EventSource(`${import.meta.env.VITE_API_BASE || '/api'}/events`);
    es.addEventListener("reservation", (evt: MessageEvent) => {
      try {
        const e = JSON.parse(evt.data || "{}");
        setReservations(prev => [{ id: e.id, userId: e.userId, workshopId: e.workshopId, createdAt: e.createdAt }, ...prev]);
        setUsers(prev => prev.some(u => u.id === e.userId) ? prev : [{ id: e.userId, name: e.userName || "", email: e.userEmail || "" }, ...prev]);
        setWorkshops(prev => prev.some(w => w.id === e.workshopId) ? prev : [{ id: e.workshopId, title: e.workshopTitle || "", description: "", trainer: "", date: "", time: "", duration: "", location: "", availableSeats: 0, totalSeats: 0, category: "" }, ...prev]);
      } catch {}
    });
    es.addEventListener("reservation_cancelled", (evt: MessageEvent) => {
      try {
        const e = JSON.parse(evt.data || "{}");
        // Represent cancellation as a negative entry with same shape but special id suffix
        setReservations(prev => [{ id: `${e.id}-cancel`, userId: e.userId, workshopId: e.workshopId, createdAt: e.createdAt }, ...prev]);
        setUsers(prev => prev.some(u => u.id === e.userId) ? prev : [{ id: e.userId, name: e.userName || "", email: e.userEmail || "" }, ...prev]);
        setWorkshops(prev => prev.some(w => w.id === e.workshopId) ? prev : [{ id: e.workshopId, title: e.workshopTitle || "", description: "", trainer: "", date: "", time: "", duration: "", location: "", availableSeats: 0, totalSeats: 0, category: "" }, ...prev]);
      } catch {}
    });
    return () => { es.close(); };
  }, []);

  const rows = useMemo(() => reservations
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(r => {
      const user = users.find(u => u.id === r.userId);
      const workshop = workshops.find(w => w.id === r.workshopId);
      return {
        id: r.id,
        when: new Date(r.createdAt).toLocaleString(),
        userName: user?.name || "Unknown",
        userEmail: user?.email || "",
        workshopTitle: workshop?.title || "Unknown",
        workshopDate: workshop?.date || "",
        trainer: workshop?.trainer || "",
      };
    }), [reservations, users, workshops]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Notifications - Recent Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && <div className="text-muted-foreground">Loading...</div>}
            {error && <div className="text-destructive">{error}</div>}
            <div className="divide-y divide-border">
              {rows.map(n => (
                <div key={n.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-card-foreground text-sm"><strong>{n.userName}</strong> ({n.userEmail}) booked <strong>{n.workshopTitle}</strong></p>
                    <p className="text-xs text-muted-foreground">{n.workshopDate} • {n.trainer}</p>
                  </div>
                  <div className="text-xs text-muted-foreground">{n.when}</div>
                </div>
              ))}
              {rows.length === 0 && !loading && !error && (
                <div className="text-sm text-muted-foreground">No bookings yet.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Notifications;


