import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import { apiGet, apiPut, type Workshop } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader as DialogHdr, DialogTitle as DialogTtl } from "@/components/ui/dialog";

const Settings = () => {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState<Workshop | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await apiGet<Workshop[]>("/workshops");
        if (active) setWorkshops(data);
      } catch {
        if (active) setError("Failed to load workshops");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-4">Settings</h1>
        <Card>
          <CardHeader>
            <CardTitle>Manage Workshops</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && <div className="text-muted-foreground">Loading workshops...</div>}
            {error && <div className="text-destructive">{error}</div>}
            <div className="space-y-2">
              {workshops.map(w => (
                <div key={w.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                  <div>
                    <p className="font-medium text-card-foreground">{w.title}</p>
                    <p className="text-sm text-muted-foreground">{w.date} • {w.time} • {w.trainer} • {w.category}</p>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{w.totalSeats - w.availableSeats}/{w.totalSeats} booked</span>
                    <Button variant="outline" size="sm" onClick={() => { setEditData(w); setEditOpen(true); }}>Edit</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

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
              // date guard
              const today = new Date();
              const selected = new Date(`${payload.date}T00:00:00`);
              if (isNaN(selected.getTime()) || selected < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
                alert("Date cannot be in the past.");
                return;
              }
              try {
                const updated = await apiPut<Workshop>(`/workshops/${editData.id}`, payload);
                setWorkshops(prev => prev.map(w => w.id === updated.id ? updated : w));
                setEditOpen(false);
              } catch (err: any) {
                alert(err?.message || "Failed to update workshop");
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
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;


