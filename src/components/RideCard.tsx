import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, MapPin, Clock, Car } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface Ride {
  id: string;
  event_id: string;
  departure_time: string;
  travel_mode: string;
  meeting_point: string | null;
  driver?: {
    name: string;
    photo: string | null;
  };
  events: {
    name: string;
    destination: string;
    city: string;
    date_time: string;
  };
}

interface RideCardProps {
  ride: Ride;
}

export const RideCard = ({ ride }: RideCardProps) => {
  const navigate = useNavigate();
  const isCarpool = ride.travel_mode === 'Carpool (Student Driver)';

  return (
    <Card 
      className="cursor-pointer hover:border-accent transition-colors"
      onClick={() => navigate(`/events/${ride.event_id}`)}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-xl font-semibold text-primary">{ride.events.name}</h3>
          <Badge variant={ride.travel_mode.includes('Rideshare') ? 'default' : 'secondary'}>
            {isCarpool ? 'Carpool' : 'Rideshare'}
          </Badge>
        </div>
        
        {isCarpool && ride.driver && (
          <div className="mb-3 p-2 bg-accent/10 rounded-md">
            <p className="text-xs text-muted-foreground mb-1">Driver</p>
            <p className="text-sm font-medium">{ride.driver.name}</p>
          </div>
        )}
        
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{format(new Date(ride.events.date_time), 'EEEE, MMM d')}</span>
          </div>
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>Departs at {format(new Date(ride.departure_time), 'h:mm a')}</span>
          </div>
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span>{ride.events.destination}, {ride.events.city}</span>
          </div>

          {ride.meeting_point && (
            <div className="flex items-center gap-2 text-primary font-medium">
              <Car className="w-4 h-4" />
              <span>Meeting at: {ride.meeting_point}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};