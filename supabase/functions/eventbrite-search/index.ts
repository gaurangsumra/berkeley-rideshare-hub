import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Bay Area locations to search
const BAY_AREA_LOCATIONS = [
  'Berkeley, CA',
  'San Francisco, CA',
  'Palo Alto, CA',
  'San Jose, CA',
  'Oakland, CA',
  'Mountain View, CA',
  'Sunnyvale, CA',
  'Santa Clara, CA',
  'Fremont, CA',
  'Redwood City, CA'
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get('EVENTBRITE_PRIVATE_TOKEN');
    
    if (!token) {
      console.error('EVENTBRITE_PRIVATE_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Eventbrite integration not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate date range: today to 30 days from now
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    console.log('Auto-importing Bay Area events:', { 
      locations: BAY_AREA_LOCATIONS.length,
      startDate: startDate.toISOString(), 
      endDate: endDate.toISOString() 
    });

    // Fetch events from all Bay Area locations in parallel
    const fetchEventsForLocation = async (location: string) => {
      const params = new URLSearchParams({
        'location.address': location,
        'location.within': '25mi',
        'start_date.range_start': startDate.toISOString(),
        'start_date.range_end': endDate.toISOString(),
        'expand': 'venue',
        'page': '1',
      });

      const url = `https://www.eventbriteapi.com/v3/events/search/?${params.toString()}`;

      console.log(`Fetching events for ${location}`);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`Error fetching ${location}:`, response.status);
        return [];
      }

      const data = await response.json();
      console.log(`${location}: ${data.events?.length || 0} events found`);
      return data.events || [];
    };

    // Fetch all locations in parallel
    const locationPromises = BAY_AREA_LOCATIONS.map(location => 
      fetchEventsForLocation(location)
    );

    const results = await Promise.allSettled(locationPromises);
    
    // Extract successful results
    const allEvents = results
      .filter((r): r is PromiseFulfilledResult<any[]> => r.status === 'fulfilled')
      .flatMap(r => r.value);

    console.log(`Total events fetched: ${allEvents.length}`);

    // Deduplicate by event ID
    const uniqueEventsMap = new Map();
    allEvents.forEach(event => {
      if (!uniqueEventsMap.has(event.id)) {
        uniqueEventsMap.set(event.id, event);
      }
    });
    const uniqueEvents = Array.from(uniqueEventsMap.values());

    console.log(`After deduplication: ${uniqueEvents.length} unique events`);

    // Filter out online events
    const filteredEvents = uniqueEvents.filter((event: any) => {
      // Must have a venue
      if (!event.venue) {
        return false;
      }

      // Must have a physical address
      if (!event.venue.address) {
        return false;
      }

      const city = event.venue?.address?.city?.toLowerCase() || '';
      const venueName = event.venue?.name?.toLowerCase() || '';

      // Exclude if city is "Online" or empty
      if (city === 'online' || city === '') {
        return false;
      }

      // Exclude if venue name contains "online"
      if (venueName.includes('online')) {
        return false;
      }

      return true;
    });

    console.log(`After filtering: ${filteredEvents.length} in-person events`);

    // Sort by date and limit to 100
    const sortedEvents = filteredEvents.sort((a: any, b: any) => {
      const dateA = new Date(a.start?.local || a.start?.utc);
      const dateB = new Date(b.start?.local || b.start?.utc);
      return dateA.getTime() - dateB.getTime();
    });

    const finalEvents = sortedEvents.slice(0, 100);

    console.log(`Final result: ${finalEvents.length} events (limit 100)`);

    // Transform events to our format
    const transformedEvents = finalEvents.map((event: any) => ({
      eventbrite_id: event.id,
      name: event.name?.text || 'Untitled Event',
      date_time: event.start?.local || event.start?.utc,
      destination: event.venue?.address?.localized_address_display || 
                   `${event.venue?.address?.address_1 || ''}, ${event.venue?.address?.city || ''}`.trim(),
      city: event.venue?.address?.city || '',
      description: event.description?.text || event.summary || null,
      image_url: event.logo?.url || null,
      url: event.url || null,
    }));

    return new Response(
      JSON.stringify({ events: transformedEvents }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in eventbrite-search function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
