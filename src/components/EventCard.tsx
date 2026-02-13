import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, MapPin, Clock } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface Event {
  title: {
    params: {
      ENCODING: string;
    };
    val: string;
  };
  startDate: string;
  endDate: string;
  location: string;
  description: string;
  url: string;
  uid: string;
}

interface EventCardProps {
  event: Event;
  isPastEvent?: boolean;
}

export const EventCard = ({ event, isPastEvent = false }: EventCardProps) => {
  const navigate = useNavigate();

  return (
    <Card
      className={`cursor-pointer hover:border-accent transition-colors ${isPastEvent ? 'opacity-60 grayscale' : ''}`}
      onClick={() => navigate(`/haas-events/${event.uid}`)}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold text-primary">{event.title.val}</h3>
            {isPastEvent && (
              <Badge variant="secondary" className="text-xs">Past Event</Badge>
            )}
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{format(new Date(event.startDate), 'EEEE, MMMM d, yyyy')}</span>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{format(new Date(event.startDate), 'h:mm a')}</span>
          </div>

          {event.location && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4" />
              {event.location === "Location Unknown" ? (
                <span>{event.location}</span>
              ) : (
                <a
                  href={`https://www.google.com/maps?q=${encodeURIComponent(event.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-primary hover:underline transition-colors"
                >
                  {event.location}
                </a>
              )}
            </div>
          )}
        </div>

        {event.description && (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
            {event.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
