import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Profile {
  id: string;
  name: string;
  photo: string | null;
}

interface CapacityVisualizationProps {
  members: Profile[];
  capacity: number;
  isDriver?: boolean;
  onSlotClick?: () => void;
  onMemberClick?: (userId: string) => void;
}

export const CapacityVisualization = ({
  members,
  capacity,
  isDriver = false,
  onSlotClick,
  onMemberClick,
}: CapacityVisualizationProps) => {
  const emptySlots = Math.max(0, capacity - members.length);
  const displayMembers = members.slice(0, 6);
  const remainingCount = Math.max(0, members.length - 6);
  
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {displayMembers.map((member) => (
        <button
          key={member.id}
          onClick={() => onMemberClick?.(member.id)}
          className="relative group"
        >
          <Avatar className="h-12 w-12 border-2 border-primary/20 hover:border-primary transition-all cursor-pointer">
            <AvatarImage src={member.photo || undefined} alt={member.name} />
            <AvatarFallback>{member.name.split(' ').map(n => n[0]).join('').toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-xs whitespace-nowrap bg-background/90 backdrop-blur-sm px-2 py-1 rounded border">
            {member.name}
          </div>
        </button>
      ))}
      
      {remainingCount > 0 && (
        <div className="h-12 w-12 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-sm text-muted-foreground">
          +{remainingCount}
        </div>
      )}
      
      {emptySlots > 0 && Array.from({ length: Math.min(emptySlots, 6 - displayMembers.length - (remainingCount > 0 ? 1 : 0)) }).map((_, i) => (
        <button
          key={`empty-${i}`}
          onClick={onSlotClick}
          disabled={!onSlotClick}
          className={cn(
            "h-12 w-12 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground/50 transition-all",
            onSlotClick && "hover:border-primary hover:bg-primary/5 cursor-pointer"
          )}
        >
          <UserPlus className="h-5 w-5" />
        </button>
      ))}
    </div>
  );
};
