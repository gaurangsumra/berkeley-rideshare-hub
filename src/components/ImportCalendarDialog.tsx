import { useState } from "react";
import ICAL from "ical.js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, Calendar, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GoogleCalendarImport, ParsedEvent } from "./GoogleCalendarImport";

interface ImportCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventsImported: () => void;
  defaultTab?: 'file' | 'google';
}

const parseCity = (locationString: string): string => {
  if (!locationString) return "";

  const parts = locationString.split(',').map(s => s.trim());

  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    const isStateOrZip = /^[A-Z]{2}$|^\d{5}/.test(lastPart);

    if (isStateOrZip && parts.length >= 3) {
      return parts[parts.length - 2];
    } else if (parts.length >= 2) {
      return parts[1];
    }
  }

  return parts[0] || "";
};

export function ImportCalendarDialog({ open, onOpenChange, onEventsImported, defaultTab = 'file' }: ImportCalendarDialogProps) {
  const [parsedEvents, setParsedEvents] = useState<ParsedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.ics') && !file.name.endsWith('.ical')) {
      toast.error("Please upload a valid .ics or .ical file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setLoading(true);

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const icalData = e.target?.result as string;
        parseCalendarEvents(icalData);
      };
      reader.onerror = () => {
        toast.error("Failed to read file");
        setLoading(false);
      };
      reader.readAsText(file);
    } catch (error) {
      toast.error("Failed to process file");
      setLoading(false);
    }
  };

  const parseCalendarEvents = (icalData: string) => {
    try {
      const jcalData = ICAL.parse(icalData);
      const comp = new ICAL.Component(jcalData);
      const vevents = comp.getAllSubcomponents('vevent');

      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const parsed: ParsedEvent[] = vevents
        .map(vevent => {
          try {
            const event = new ICAL.Event(vevent);
            const startDate = event.startDate.toJSDate();

            if (startDate < now || startDate > thirtyDaysFromNow) {
              return null;
            }

            const location = event.location || "";
            const parsedCity = parseCity(location);

            return {
              id: crypto.randomUUID(),
              name: event.summary || "Untitled Event",
              dateTime: startDate,
              destination: location,
              city: parsedCity,
              description: event.description || "",
              selected: true,
            };
          } catch (err) {
            return null;
          }
        })
        .filter(e => e !== null) as ParsedEvent[];

      setParsedEvents(parsed);

      if (parsed.length === 0) {
        toast.info("No events found in the next 30 days");
      } else {
        toast.success(`Found ${parsed.length} event(s) in the next 30 days`);
      }
    } catch (error) {
      toast.error("Failed to parse calendar file. Please check the file format.");
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const updateEventCity = (id: string, city: string) => {
    setParsedEvents(events =>
      events.map(e => e.id === id ? { ...e, city } : e)
    );
  };

  const toggleEventSelection = (id: string) => {
    setParsedEvents(events =>
      events.map(e => e.id === id ? { ...e, selected: !e.selected } : e)
    );
  };

  const handleImport = async () => {
    const selectedEvents = parsedEvents.filter(e => e.selected);

    if (selectedEvents.length === 0) {
      toast.error("Please select at least one event to import");
      return;
    }

    const missingCity = selectedEvents.some(e => !e.city.trim());
    if (missingCity) {
      toast.error("Please enter a city for all selected events");
      return;
    }

    setImporting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      let importedCount = 0;
      let linkedCount = 0;

      for (const event of selectedEvents) {
        // 1. Check if a similar event exists
        // Match by City and Date (within 1 hour?) and Name (fuzzy?)
        // For now, let's match by City and Date (exact) and Name (ilike)
        // Or just City and Date is risky.
        // Let's try to find an event with same City and Date (+/- 2 hours) and similar name?
        // Supabase doesn't support complex fuzzy matching easily without extensions.
        // Let's do exact match on Date and City, and case-insensitive match on Name.

        const { data: existingEvents } = await supabase
          .from('events')
          .select('id, name')
          .eq('city', event.city)
          .eq('date_time', event.dateTime.toISOString()) // Exact time match from ICS might be hard if timezones differ slightly.
          // Maybe use a range?
          // ICS dates are usually precise.
          // Let's try exact match first.
          .ilike('name', event.name)
          .maybeSingle();

        if (existingEvents) {
          // Link to existing event
          const { error: accessError } = await supabase
            .from('event_access')
            .insert({
              user_id: session.user.id,
              event_id: existingEvents.id
            });

          if (!accessError) {
            linkedCount++;
          } else {
            // If error is duplicate key (already has access), that's fine.
            if (accessError.code !== '23505') {
              // Non-duplicate error linking event
            }
          }
        } else {
          // Create new event
          const { data: newEvent, error: createError } = await supabase
            .from('events')
            .insert({
              name: event.name,
              date_time: event.dateTime.toISOString(),
              destination: event.destination || event.city,
              city: event.city,
              description: event.description || null,
              created_by: session.user.id,
            })
            .select('id')
            .single();

          if (createError) throw createError;

          // Also grant access to creator (redundant but good for queries)
          if (newEvent) {
            await supabase.from('event_access').insert({
              user_id: session.user.id,
              event_id: newEvent.id
            });
          }

          importedCount++;
        }
      }

      toast.success(`Imported ${importedCount} new events and linked ${linkedCount} existing events!`);
      setParsedEvents([]);
      onOpenChange(false);
      onEventsImported();
    } catch (error) {
      toast.error((error as Error).message || "Failed to import events");
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = parsedEvents.filter(e => e.selected).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Calendar Events</DialogTitle>
          <DialogDescription>
            Upload an .ics file to import your events
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {parsedEvents.length === 0 ? (
            <Tabs defaultValue={defaultTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="file">Upload .ICS File</TabsTrigger>
                <TabsTrigger value="google">Google Calendar</TabsTrigger>
              </TabsList>

              <TabsContent value="file">
                <div
                  className={`mt-4 border-2 border-dashed rounded-lg p-12 text-center transition-colors ${dragActive ? 'border-primary bg-muted' : 'border-muted-foreground/25'
                    }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  {loading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-12 h-12 text-muted-foreground animate-spin" />
                      <p className="text-muted-foreground">Parsing calendar...</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-foreground mb-2">Drop your .ics file here or click to upload</p>
                      <p className="text-sm text-muted-foreground mb-4">Maximum file size: 5MB</p>
                      <input
                        type="file"
                        accept=".ics,.ical"
                        onChange={handleFileInput}
                        className="hidden"
                        id="calendar-file"
                      />
                      <label htmlFor="calendar-file">
                        <Button type="button" variant="outline" asChild>
                          <span>
                            <Calendar className="w-4 h-4 mr-2" />
                            Select File
                          </span>
                        </Button>
                      </label>
                    </>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="google">
                <GoogleCalendarImport onEventsFetched={setParsedEvents} />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        <th className="w-12 p-3"></th>
                        <th className="text-left p-3 font-medium">Event Name</th>
                        <th className="text-left p-3 font-medium">Date & Time</th>
                        <th className="text-left p-3 font-medium">Location</th>
                        <th className="text-left p-3 font-medium">City</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedEvents.map((event) => (
                        <tr key={event.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="p-3">
                            <Checkbox
                              checked={event.selected}
                              onCheckedChange={() => toggleEventSelection(event.id)}
                            />
                          </td>
                          <td className="p-3">
                            <div className="font-medium">{event.name}</div>
                          </td>
                          <td className="p-3">
                            <div className="text-sm">
                              {format(event.dateTime, "MMM d, yyyy")}
                              <br />
                              {format(event.dateTime, "h:mm a")}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="text-sm max-w-xs truncate">
                              {event.destination || "-"}
                            </div>
                          </td>
                          <td className="p-3">
                            <Input
                              value={event.city}
                              onChange={(e) => updateEventCity(event.id, e.target.value)}
                              placeholder="Enter city"
                              className="w-full min-w-[150px]"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <div className="text-sm text-muted-foreground">
                  {selectedCount} event(s) selected
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setParsedEvents([]);
                      onOpenChange(false);
                    }}
                    disabled={importing}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={importing || selectedCount === 0}
                  >
                    {importing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      `Import ${selectedCount} Event(s)`
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
