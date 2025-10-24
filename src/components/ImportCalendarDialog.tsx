import { useState, useEffect } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Calendar, Loader2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

interface ParsedEvent {
  id: string;
  name: string;
  dateTime: Date;
  destination: string;
  city: string;
  description: string;
  selected: boolean;
}

interface ImportCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventsImported: () => void;
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

export function ImportCalendarDialog({ open, onOpenChange, onEventsImported }: ImportCalendarDialogProps) {
  const [parsedEvents, setParsedEvents] = useState<ParsedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [importSource, setImportSource] = useState<'google' | 'file'>('google');
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(true);

  // Check Google Calendar connection status when dialog opens
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setCheckingConnection(false);
          return;
        }

        const { data, error } = await supabase
          .from('calendar_tokens')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('provider', 'google')
          .maybeSingle();

        setIsGoogleConnected(!!data && !error);
      } catch (error) {
        console.error('Error checking connection:', error);
      } finally {
        setCheckingConnection(false);
      }
    };

    if (open) {
      checkConnection();
    }
  }, [open]);

  // Handle Google OAuth authentication
  const handleGoogleAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in first');
        return;
      }

      // Get auth URL from edge function
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { userId: session.user.id }
      });

      if (error) throw error;

      // Open popup for OAuth
      const popup = window.open(
        data.authUrl,
        'Google Calendar Authorization',
        'width=600,height=700,left=200,top=100'
      );

      // Listen for OAuth callback
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'CALENDAR_AUTH_SUCCESS') {
          toast.success('Google Calendar connected successfully!');
          setIsGoogleConnected(true);
          popup?.close();
          window.removeEventListener('message', handleMessage);
        } else if (event.data.type === 'CALENDAR_AUTH_ERROR') {
          toast.error('Failed to connect Google Calendar');
          popup?.close();
          window.removeEventListener('message', handleMessage);
        }
      };

      window.addEventListener('message', handleMessage);

    } catch (error: any) {
      toast.error(error.message || 'Failed to initiate Google Calendar connection');
    }
  };

  // Fetch Google Calendar events
  const handleFetchGoogleEvents = async () => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-fetch');

      if (error) throw error;

      const events = data.events || [];

      if (events.length === 0) {
        toast.info('No events found in your Google Calendar for the next 2 weeks');
        return;
      }

      // Transform to ParsedEvent format
      const parsed: ParsedEvent[] = events.map((event: any) => {
        const location = event.destination || '';
        const parsedCity = parseCity(location);
        
        return {
          id: crypto.randomUUID(),
          name: event.name,
          dateTime: new Date(event.dateTime),
          destination: location,
          city: parsedCity,
          description: event.description,
          selected: true,
        };
      });

      setParsedEvents(parsed);
      toast.success(`Found ${parsed.length} event(s) in your Google Calendar`);

    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch Google Calendar events');
    } finally {
      setLoading(false);
    }
  };

  // Disconnect Google Calendar
  const handleDisconnectGoogle = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from('calendar_tokens')
        .delete()
        .eq('user_id', session.user.id)
        .eq('provider', 'google');

      if (error) throw error;

      setIsGoogleConnected(false);
      setParsedEvents([]);
      toast.success('Google Calendar disconnected');

    } catch (error: any) {
      toast.error('Failed to disconnect Google Calendar');
    }
  };


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
      const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      
      const parsed: ParsedEvent[] = vevents
        .map(vevent => {
          try {
            const event = new ICAL.Event(vevent);
            const startDate = event.startDate.toJSDate();
            
            if (startDate < now || startDate > twoWeeksFromNow) {
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
        toast.info("No events found in the next 2 weeks");
      } else {
        toast.success(`Found ${parsed.length} event(s) in the next 2 weeks`);
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
      
      const eventsToInsert = selectedEvents.map(event => ({
        name: event.name,
        date_time: event.dateTime.toISOString(),
        destination: event.destination || event.city,
        city: event.city,
        description: event.description || null,
        created_by: session.user.id,
      }));
      
      const { error } = await supabase
        .from('events')
        .insert(eventsToInsert);
      
      if (error) throw error;
      
      toast.success(`Successfully imported ${selectedEvents.length} event(s)!`);
      setParsedEvents([]);
      onOpenChange(false);
      onEventsImported();
    } catch (error: any) {
      toast.error(error.message || "Failed to import events");
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
            Connect your Google Calendar or upload an .ics file
          </DialogDescription>
        </DialogHeader>

        <Tabs value={importSource} onValueChange={(v) => setImportSource(v as 'google' | 'file')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="google">
              <Calendar className="w-4 h-4 mr-2" />
              Google Calendar
            </TabsTrigger>
            <TabsTrigger value="file">
              <Upload className="w-4 h-4 mr-2" />
              Upload .ics File
            </TabsTrigger>
          </TabsList>

          {/* Google Calendar Tab */}
          <TabsContent value="google" className="space-y-4 mt-4">
            {checkingConnection ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : isGoogleConnected ? (
              <>
                <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-900 dark:text-green-100">
                      Google Calendar Connected
                    </span>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleDisconnectGoogle}>
                    Disconnect
                  </Button>
                </div>
                
                {parsedEvents.length === 0 ? (
                  <div className="text-center p-8">
                    <Button onClick={handleFetchGoogleEvents} disabled={loading} size="lg">
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Fetching Events...
                        </>
                      ) : (
                        <>
                          <Calendar className="w-4 h-4 mr-2" />
                          Fetch Events from Google Calendar
                        </>
                      )}
                    </Button>
                    <p className="text-sm text-muted-foreground mt-2">
                      This will import events from the next 2 weeks
                    </p>
                  </div>
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
                          }}
                          disabled={importing}
                        >
                          Clear
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
              </>
            ) : (
              <div className="text-center p-8 border-2 border-dashed rounded-lg">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                  <svg className="w-8 h-8" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2">Connect Google Calendar</h3>
                <p className="text-muted-foreground mb-4">
                  Import events directly from your Google Calendar
                </p>
                <Button onClick={handleGoogleAuth} size="lg">
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Connect Google Calendar
                </Button>
              </div>
            )}
          </TabsContent>

          {/* File Upload Tab */}
          <TabsContent value="file" className="mt-4">
            {parsedEvents.length === 0 ? (
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                  dragActive ? 'border-primary bg-muted' : 'border-muted-foreground/25'
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
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
