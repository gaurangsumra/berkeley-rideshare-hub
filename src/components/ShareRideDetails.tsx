import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Share2, Copy, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Profile {
  id: string;
  name: string;
  photo: string | null;
  program: string | null;
}

interface ShareRideDetailsProps {
  event: {
    name: string;
    destination: string;
    city: string;
  };
  ride: {
    departure_time: string;
    travel_mode: string;
    meeting_point: string | null;
  };
  members: Profile[];
  driver?: Profile | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const ShareRideDetails = ({ event, ride, members, driver, open: externalOpen, onOpenChange }: ShareRideDetailsProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const { toast } = useToast();
  
  // Use external control if provided, otherwise use internal state
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const generateShareText = () => {
    const departureTime = format(new Date(ride.departure_time), "EEEE, MMMM d 'at' h:mm a");
    const memberNames = members.map(m => m.name).join(", ");
    
    return `🚗 Ride Details - ${event.name}

📍 Destination: ${event.destination}, ${event.city}
🕐 Departure: ${departureTime}
🚙 Travel Mode: ${ride.travel_mode}
${ride.meeting_point ? `📌 Meeting Point: ${ride.meeting_point}` : ''}
${driver ? `👤 Driver: ${driver.name}` : ''}

👥 Ride Members (${members.length}):
${memberNames}

Shared for safety purposes from Berkeley Rides`;
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(generateShareText());
    toast({ title: "Copied to clipboard!" });
  };

  const handleShare = async () => {
    const shareData = {
      title: `Ride to ${event.name}`,
      text: generateShareText(),
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        toast({ title: "Shared successfully!" });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          handleCopyText();
        }
      }
    } else {
      handleCopyText();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!externalOpen && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            Share Details
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Ride Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg space-y-3">
            <div>
              <h3 className="font-semibold text-lg">{event.name}</h3>
              <p className="text-sm text-muted-foreground">
                {event.destination}, {event.city}
              </p>
            </div>

            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Departure:</span> {format(new Date(ride.departure_time), "EEEE, MMM d 'at' h:mm a")}</p>
              <p><span className="font-medium">Travel Mode:</span> {ride.travel_mode}</p>
              {ride.meeting_point && (
                <p><span className="font-medium">Meeting Point:</span> {ride.meeting_point}</p>
              )}
            </div>

            {driver && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={driver.photo || undefined} />
                  <AvatarFallback>{driver.name.split(' ').map(n => n[0]).join('').toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">Driver: {driver.name}</p>
                  <p className="text-xs text-muted-foreground">{driver.program}</p>
                </div>
              </div>
            )}

            <div className="pt-2 border-t">
              <p className="text-sm font-medium mb-2">Ride Members ({members.length})</p>
              <div className="flex flex-wrap gap-2">
                {members.map(member => (
                  <div key={member.id} className="flex items-center gap-1.5 bg-background rounded-full pl-1 pr-3 py-1">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={member.photo || undefined} />
                      <AvatarFallback className="text-xs">
                        {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs">{member.name.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleCopyText} variant="outline" className="flex-1">
              <Copy className="h-4 w-4 mr-2" />
              Copy Text
            </Button>
            <Button onClick={handleShare} className="flex-1">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Share these details with family or friends for safety purposes
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
