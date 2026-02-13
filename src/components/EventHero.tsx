import { format } from "date-fns";
import { Calendar, MapPin, Clock } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical } from "lucide-react";

interface EventHeroProps {
  event: {
    id: string;
    name: string;
    description: string | null;
    destination: string;
    city: string;
    date_time: string;
    created_by: string;
  };
  isCreator: boolean;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export const EventHero = ({ event, isCreator, isAdmin, onEdit, onDelete }: EventHeroProps) => {
  const eventDateTime = new Date(event.date_time);
  
  return (
    <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/20 via-primary/10 to-background border border-primary/20">
      <div className="absolute inset-0 bg-[url('/src/assets/campanile-bay.jpg')] bg-cover bg-center opacity-10" />
      
      <div className="relative p-8 md:p-12">
        {(isCreator || isAdmin) && (
          <div className="absolute top-4 right-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="bg-background/80 backdrop-blur-sm" aria-label="Event options">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>Edit Event</DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  Delete Event
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        
        <h1 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">{event.name}</h1>
        
        <div className="flex flex-col md:flex-row gap-4 md:gap-8 mb-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-5 w-5" />
            <span className="text-lg">{format(eventDateTime, "EEEE, MMMM d, yyyy")}</span>
          </div>
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-5 w-5" />
            <span className="text-lg">{format(eventDateTime, "h:mm a")}</span>
          </div>
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-5 w-5" />
            <span className="text-lg">{event.destination}, {event.city}</span>
          </div>
        </div>
        
        {event.description && (
          <p className="text-muted-foreground text-lg max-w-3xl leading-relaxed">
            {event.description}
          </p>
        )}
      </div>
    </div>
  );
};
