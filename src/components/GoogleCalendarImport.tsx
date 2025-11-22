import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Calendar } from "lucide-react";

interface GoogleEvent {
    summary?: string;
    start?: {
        dateTime?: string;
        date?: string;
    };
    location?: string;
    description?: string;
}

export interface ParsedEvent {
    id: string;
    name: string;
    dateTime: Date;
    destination: string;
    city: string;
    description: string;
    selected: boolean;
}

interface GoogleCalendarImportProps {
    onEventsFetched: (events: ParsedEvent[]) => void;
}

export const GoogleCalendarImport = ({ onEventsFetched }: GoogleCalendarImportProps) => {
    const [loading, setLoading] = useState(false);
    const [hasToken, setHasToken] = useState(false);

    useEffect(() => {
        checkToken();
    }, []);

    const checkToken = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.provider_token) {
            setHasToken(true);
            // Automatically fetch if we just came back from auth?
            // Maybe let the user click "Fetch" to be sure.
        }
    };

    const handleConnect = async () => {
        try {
            setLoading(true);
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    scopes: 'https://www.googleapis.com/auth/calendar.readonly',
                    redirectTo: window.location.origin + '/events?action=google-import',
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                },
            });
            if (error) throw error;
        } catch (error) {
            toast.error((error as Error).message || "Failed to connect Google Calendar");
            setLoading(false);
        }
    };

    const handleFetchEvents = async () => {
        try {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.provider_token;

            if (!token) {
                setHasToken(false);
                toast.error("Session expired. Please reconnect.");
                return;
            }

            const now = new Date();
            const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

            const response = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now.toISOString()}&timeMax=${thirtyDaysFromNow.toISOString()}&singleEvents=true&orderBy=startTime`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) {
                if (response.status === 401) {
                    setHasToken(false);
                    throw new Error("Token expired. Please reconnect.");
                }
                throw new Error("Failed to fetch events from Google Calendar");
            }

            const data = await response.json();

            const parsedEvents = data.items
                .filter((item: GoogleEvent) => item.start?.dateTime) // Filter out all-day events if needed, or handle them
                .map((item: GoogleEvent) => {
                    const startDate = new Date(item.start!.dateTime || item.start!.date!);
                    const location = item.location || "";

                    // Simple city parsing logic (same as ImportCalendarDialog)
                    let city = "";
                    if (location) {
                        const parts = location.split(',').map((s: string) => s.trim());
                        if (parts.length >= 2) {
                            const lastPart = parts[parts.length - 1];
                            const isStateOrZip = /^[A-Z]{2}$|^\d{5}/.test(lastPart);
                            if (isStateOrZip && parts.length >= 3) {
                                city = parts[parts.length - 2];
                            } else if (parts.length >= 2) {
                                city = parts[1];
                            }
                        } else {
                            city = parts[0];
                        }
                    }

                    return {
                        id: crypto.randomUUID(),
                        name: item.summary || "Untitled Event",
                        dateTime: startDate,
                        destination: location,
                        city: city,
                        description: item.description || "",
                        selected: true,
                    };
                });

            onEventsFetched(parsedEvents);
            toast.success(`Found ${parsedEvents.length} events from Google Calendar`);
        } catch (error) {
            console.error('Google Calendar Error:', error);
            toast.error((error as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="p-4 bg-primary/10 rounded-full">
                <Calendar className="w-12 h-12 text-primary" />
            </div>
            <div className="text-center space-y-2 max-w-md">
                <h3 className="text-lg font-semibold">Import from Google Calendar</h3>
                <p className="text-sm text-muted-foreground">
                    Connect your Google Calendar to automatically find events and rides.
                    We'll fetch your events for the next 30 days.
                </p>
            </div>

            {hasToken ? (
                <Button onClick={handleFetchEvents} disabled={loading} size="lg">
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Fetching Events...
                        </>
                    ) : (
                        "Fetch Events"
                    )}
                </Button>
            ) : (
                <Button onClick={handleConnect} disabled={loading} size="lg" variant="outline">
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Connecting...
                        </>
                    ) : (
                        <>
                            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4 mr-2" />
                            Connect Google Calendar
                        </>
                    )}
                </Button>
            )}
        </div>
    );
};
