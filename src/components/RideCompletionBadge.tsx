import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RideCompletionBadgeProps {
  isCompleted: boolean;
}

export const RideCompletionBadge = ({ isCompleted }: RideCompletionBadgeProps) => {
  if (!isCompleted) return null;

  return (
    <Badge variant="default" className="bg-green-500 hover:bg-green-600">
      <CheckCircle2 className="h-3 w-3 mr-1" />
      Completed
    </Badge>
  );
};
