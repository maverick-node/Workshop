import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Filter, CalendarDays, MapPin, User } from "lucide-react";

interface WorkshopFiltersProps {
  onSearch: (query: string) => void;
  onFilterCategory: (category: string) => void;
  onFilterTrainer: (trainer: string) => void;
  onFilterDate: (date: string) => void;
  onFilterLocation: (location: string) => void;
  onClearFilters: () => void;
}

const WorkshopFilters = ({
  onSearch,
  onFilterCategory,
  onFilterTrainer,
  onFilterDate,
  onFilterLocation,
  onClearFilters,
}: WorkshopFiltersProps) => {
  const categories = [
    "Leadership",
    "Communication",
    "Project Management",
    "Team Building",
    "Problem Solving",
    "Time Management",
    "Negotiation",
    "Public Speaking"
  ];

  const trainers = [
    "Sarah Johnson",
    "Michael Chen",
    "Emily Rodriguez",
    "David Thompson",
    "Lisa Anderson"
  ];

  const locations = [
    "Conference Room A",
    "Training Center",
    "Main Auditorium",
    "Workshop Space",
    "Online"
  ];

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search workshops..."
              className="pl-10"
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>

          {/* Filter Row */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Filters:</span>
            </div>

            <Select onValueChange={onFilterCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select onValueChange={onFilterTrainer}>
              <SelectTrigger className="w-[180px]">
                <User className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Trainer" />
              </SelectTrigger>
              <SelectContent>
                {trainers.map((trainer) => (
                  <SelectItem key={trainer} value={trainer}>
                    {trainer}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select onValueChange={onFilterDate}>
              <SelectTrigger className="w-[180px]">
                <CalendarDays className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this-week">This Week</SelectItem>
                <SelectItem value="next-week">Next Week</SelectItem>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="next-month">Next Month</SelectItem>
              </SelectContent>
            </Select>

            <Select onValueChange={onFilterLocation}>
              <SelectTrigger className="w-[180px]">
                <MapPin className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location} value={location}>
                    {location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={onClearFilters}>
              Clear All
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkshopFilters;