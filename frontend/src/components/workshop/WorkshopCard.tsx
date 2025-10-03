import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, MapPin, Users, User } from "lucide-react";
import { apiDelete, apiPost, getSession } from "@/lib/api";
import { useState } from "react";

interface WorkshopCardProps {
  id: string;
  title: string;
  description: string;
  trainer: string;
  date: string;
  time: string;
  duration: string;
  location: string;
  availableSeats: number;
  totalSeats: number;
  category: string;
  reserved?: boolean;
  onChanged?: () => void;
}

const WorkshopCard = ({
  id,
  title,
  description,
  trainer,
  date,
  time,
  duration,
  location,
  availableSeats,
  totalSeats,
  category,
  reserved = false,
  onChanged,
}: WorkshopCardProps) => {
  const [booking, setBooking] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [seats, setSeats] = useState(availableSeats);
  const getAvailabilityStatus = () => {
    const isExpired = new Date(date) < new Date(new Date().toDateString());
    if (isExpired) return { status: "expired", color: "workshop-expired", text: "Expired" };
    const percentage = (availableSeats / totalSeats) * 100;
    if (percentage === 0) return { status: "full", color: "workshop-full", text: "Full" };
    if (percentage <= 20) return { status: "limited", color: "workshop-limited", text: "Limited" };
    return { status: "available", color: "workshop-available", text: "Available" };
  };

  const availability = getAvailabilityStatus();

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] bg-workshop-card border border-border">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <Badge variant="secondary" className="text-xs font-medium mb-2">
            {category}
          </Badge>
          <Badge 
            variant={availability.status === "full" ? "destructive" : "secondary"}
            className={`text-xs font-medium ${
              availability.status === "available" ? "bg-success text-success-foreground" :
              availability.status === "limited" ? "bg-warning text-warning-foreground" : ""
            }`}
          >
            {availability.text}
          </Badge>
        </div>
        <h3 className="text-xl font-semibold text-card-foreground group-hover:text-primary transition-colors">
          {title}
        </h3>
        <p className="text-muted-foreground text-sm line-clamp-2">
          {description}
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center text-sm text-muted-foreground">
          <User className="h-4 w-4 mr-2" />
          <span>Trainer: {trainer}</span>
        </div>
        
        <div className="flex items-center text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4 mr-2" />
          <span>{date}</span>
        </div>
        
        <div className="flex items-center text-sm text-muted-foreground">
          <Clock className="h-4 w-4 mr-2" />
          <span>{time} ({duration})</span>
        </div>
        
        <div className="flex items-center text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 mr-2" />
          <span>{location}</span>
        </div>

        <div className="flex items-center text-sm text-muted-foreground">
          <Users className="h-4 w-4 mr-2" />
          <span>{seats} of {totalSeats} seats available</span>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2">
        {!reserved ? (
          <Button 
            className="w-full bg-primary hover:bg-primary-hover" 
            disabled={seats === 0 || booking || new Date(date) < new Date(new Date().toDateString())}
            onClick={async () => {
              const user = getSession();
              if (!user) {
                window.location.href = "/login";
                return;
              }
              if (new Date(date) < new Date(new Date().toDateString())) {
                return;
              }
              try {
                setBooking(true);
                const res = await apiPost<{ workshop: { availableSeats: number } }>("/reservations", { userId: user.id, workshopId: id });
                setSeats(res.workshop.availableSeats);
                onChanged && onChanged();
              } catch (e) {
                // no-op
              } finally {
                setBooking(false);
              }
            }}
          >
            {new Date(date) < new Date(new Date().toDateString()) ? "Expired" : seats === 0 ? "Fully Booked" : booking ? "Booking..." : "Book Now"}
          </Button>
        ) : (
          <Button 
            variant="outline"
            className="w-full"
            disabled={cancelling}
            onClick={async () => {
              const user = getSession();
              if (!user) {
                window.location.href = "/login";
                return;
              }
              try {
                setCancelling(true);
                const res = await apiDelete<{ workshop: { availableSeats: number } }>("/reservations", { userId: user.id, workshopId: id });
                setSeats(res.workshop.availableSeats);
                onChanged && onChanged();
              } catch (e) {
                // no-op
              } finally {
                setCancelling(false);
              }
            }}
          >
            {cancelling ? "Cancelling..." : "Cancel Reservation"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default WorkshopCard;