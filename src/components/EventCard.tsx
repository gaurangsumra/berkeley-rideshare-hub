import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, MapPin, Clock } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { EventComments } from "./EventComments";

interface Event {
  id: string;
  name: string;
  date_time: string;
  destination: string;
  city: string;
  description: string | null;
  ride_group_count?: number;
}

interface EventCardProps {
  event: Event;
}

export const EventCard = ({ event }: EventCardProps) => {
  const navigate = useNavigate();

  return (
    <Card 
      className="cursor-pointer hover:border-accent transition-colors"
      onClick={() => navigate(`/events/${event.id}`)}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-xl font-semibold text-primary">{event.name}</h3>
          {event.ride_group_count !== undefined && (
            <Badge variant="secondary" className="ml-2 shrink-0">
              {event.ride_group_count} {event.ride_group_count === 1 ? 'group' : 'groups'}
            </Badge>
          )}
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{format(new Date(event.date_time), 'EEEE, MMMM d, yyyy')}</span>
          </div>
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{format(new Date(event.date_time), 'h:mm a')}</span>
          </div>
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <a 
              href={`https://www.google.com/maps?q=${encodeURIComponent(`${event.destination}, ${event.city}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="hover:text-primary hover:underline transition-colors"
            >
              {event.destination}, {event.city}
            </a>
          </div>
        </div>

        {event.description && (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
            {event.description}
          </p>
        )}

        <EventComments eventId={event.id} />
      </CardContent>
    </Card>
  );
};